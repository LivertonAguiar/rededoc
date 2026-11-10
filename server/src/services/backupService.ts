import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { db, dataDir, dbFileName, dbPath, walCheckpoint, runIntegrityCheck } from '../db/database.js';
import { rebuildSearchIndex } from './searchService.js';

export interface BackupSnapshotInfo {
  filename: string;
  path: string;
  type: 'automated' | 'manual' | 'pre-restore' | 'pre-import';
  label?: string;
  created_at: string;
  size_bytes: number;
  size_formatted: string;
  sha256: string;
  integrity: string;
  counts?: {
    clients: number;
    equipments: number;
    credentials: number;
    users: number;
    service_orders: number;
    articles: number;
  };
}

export const backupsDir = path.join(dataDir, 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function calculateFileSha256(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Cria um snapshot atômico e íntegro do banco SQLite utilizando VACUUM INTO.
 * Não bloqueia leituras nem escritas do sistema.
 */
export function createDatabaseSnapshot(options: {
  type?: 'automated' | 'manual' | 'pre-restore' | 'pre-import';
  label?: string;
} = {}): BackupSnapshotInfo {
  const type = options.type || 'manual';
  const label = options.label || (
    type === 'automated' ? 'Rotina Automática de Proteção' :
    type === 'pre-restore' ? 'Ponto de Segurança Pré-Restauração' :
    type === 'pre-import' ? 'Ponto de Segurança Pré-Importação' :
    'Ponto de Restauração Manual'
  );

  // Executa checkpoint prévio para consolidar alterações do WAL
  walCheckpoint('PASSIVE');

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
  const filename = `itfy_snapshot_${timestamp}_${type}.sqlite`;
  const snapshotPath = path.join(backupsDir, filename);
  const metadataPath = path.join(backupsDir, `${filename}.json`);

  // Executa o VACUUM INTO nativo do SQLite
  const escapedPath = snapshotPath.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escapedPath}';`);

  if (!fs.existsSync(snapshotPath)) {
    throw new Error('Falha crítica: Arquivo de snapshot não foi gerado pelo SQLite.');
  }

  const stat = fs.statSync(snapshotPath);
  const sha256 = calculateFileSha256(snapshotPath);

  // Verifica a integridade do arquivo gerado
  let integrity = 'ok';
  try {
    const testDb = new DatabaseSync(snapshotPath);
    const row = (testDb.prepare('PRAGMA quick_check(1);') as any).get() as { quick_check?: string } | undefined;
    integrity = row?.quick_check || 'ok';
    testDb.close();
  } catch (err: any) {
    integrity = `Erro: ${err?.message || 'Falha ao validar arquivo'}`;
  }

  // Coleta contadores de entidades do banco ativo
  let counts = {
    clients: 0,
    equipments: 0,
    credentials: 0,
    users: 0,
    service_orders: 0,
    articles: 0
  };
  try {
    counts = {
      clients: (db.prepare('SELECT COUNT(*) as c FROM clients').get() as any)?.c || 0,
      equipments: (db.prepare('SELECT COUNT(*) as c FROM equipments').get() as any)?.c || 0,
      credentials: (db.prepare('SELECT COUNT(*) as c FROM credentials').get() as any)?.c || 0,
      users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0,
      service_orders: (db.prepare('SELECT COUNT(*) as c FROM service_orders').get() as any)?.c || 0,
      articles: (db.prepare('SELECT COUNT(*) as c FROM articles').get() as any)?.c || 0
    };
  } catch {}

  const snapshotInfo: BackupSnapshotInfo = {
    filename,
    path: snapshotPath,
    type,
    label,
    created_at: now.toISOString(),
    size_bytes: stat.size,
    size_formatted: formatBytes(stat.size),
    sha256,
    integrity,
    counts
  };

  // Salva manifesto JSON companheiro
  fs.writeFileSync(metadataPath, JSON.stringify(snapshotInfo, null, 2), 'utf-8');

  console.log(`[BackupService] Snapshot "${filename}" gerado com sucesso [${snapshotInfo.size_formatted}, SHA256: ${sha256.slice(0, 10)}...]`);

  // Aplica política de retenção para evitar esgotamento de disco
  pruneOldSnapshots();

  return snapshotInfo;
}

/**
 * Remove snapshots automáticos antigos mantendo os últimos N (padrão 14).
 * Pontos manuais e pré-restauração são sempre preservados.
 */
export function pruneOldSnapshots(maxAutomatedToKeep: number = 14): void {
  try {
    const snapshots = listSnapshots();
    const automated = snapshots.filter(s => s.type === 'automated');

    if (automated.length > maxAutomatedToKeep) {
      const toRemove = automated.slice(maxAutomatedToKeep);
      for (const item of toRemove) {
        try {
          if (fs.existsSync(item.path)) fs.unlinkSync(item.path);
          const meta = path.join(backupsDir, `${item.filename}.json`);
          if (fs.existsSync(meta)) fs.unlinkSync(meta);
          console.log(`[BackupService] Rotação: Snapshot automático antigo removido: ${item.filename}`);
        } catch (e) {
          console.warn(`[BackupService] Erro ao remover snapshot antigo ${item.filename}:`, e);
        }
      }
    }
  } catch (err) {
    console.error('[BackupService] Erro na rotação de snapshots:', err);
  }
}

/**
 * Lista todos os snapshots disponíveis ordenados do mais recente para o mais antigo.
 */
export function listSnapshots(): BackupSnapshotInfo[] {
  if (!fs.existsSync(backupsDir)) return [];

  const files = fs.readdirSync(backupsDir);
  const sqliteFiles = files.filter(f => f.endsWith('.sqlite'));

  const list: BackupSnapshotInfo[] = [];

  for (const filename of sqliteFiles) {
    const fullPath = path.join(backupsDir, filename);
    const metaPath = path.join(backupsDir, `${filename}.json`);

    if (fs.existsSync(metaPath)) {
      try {
        const raw = fs.readFileSync(metaPath, 'utf-8');
        const parsed = JSON.parse(raw);
        list.push({
          ...parsed,
          filename,
          path: fullPath
        });
        continue;
      } catch {}
    }

    // Se o manifesto json não existir, constrói os metadados a partir do arquivo
    try {
      const stat = fs.statSync(fullPath);
      const sha256 = calculateFileSha256(fullPath);
      let type: BackupSnapshotInfo['type'] = 'manual';
      if (filename.includes('_automated')) type = 'automated';
      else if (filename.includes('_pre-restore')) type = 'pre-restore';
      else if (filename.includes('_pre-import')) type = 'pre-import';

      const info: BackupSnapshotInfo = {
        filename,
        path: fullPath,
        type,
        created_at: stat.mtime.toISOString(),
        size_bytes: stat.size,
        size_formatted: formatBytes(stat.size),
        sha256,
        integrity: 'ok'
      };
      fs.writeFileSync(metaPath, JSON.stringify(info, null, 2), 'utf-8');
      list.push(info);
    } catch {}
  }

  // Ordena decrescente por data de criação
  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Obtém o caminho absoluto seguro de um snapshot validado contra Path Traversal.
 */
export function getSnapshotSafePath(filename: string): string | null {
  if (!filename || path.basename(filename) !== filename || !filename.endsWith('.sqlite')) {
    return null;
  }
  const fullPath = path.join(backupsDir, filename);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fullPath;
}

/**
 * Exclui um snapshot específico e seus metadados.
 */
export function deleteSnapshot(filename: string): boolean {
  const fullPath = getSnapshotSafePath(filename);
  if (!fullPath) return false;

  try {
    fs.unlinkSync(fullPath);
    const metaPath = path.join(backupsDir, `${filename}.json`);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    console.log(`[BackupService] Snapshot ${filename} excluído com sucesso.`);
    return true;
  } catch (err) {
    console.error(`[BackupService] Erro ao excluir snapshot ${filename}:`, err);
    return false;
  }
}

/**
 * Restaura o banco de dados a partir de um snapshot selecionado.
 * CRÍTICO: Sempre cria um snapshot de segurança pré-restauração antes de qualquer alteração.
 */
export function restoreSnapshot(filename: string): {
  success: boolean;
  message: string;
  preRestoreSnapshot?: string;
} {
  const snapshotPath = getSnapshotSafePath(filename);
  if (!snapshotPath) {
    return { success: false, message: 'Arquivo de snapshot não encontrado ou inválido.' };
  }

  // 1. Gera snapshot de proteção imediata pré-restauração
  const safetyBackup = createDatabaseSnapshot({
    type: 'pre-restore',
    label: `Ponto de segurança gerado antes de restaurar: ${filename}`
  });

  const escapedSnapPath = snapshotPath.replace(/'/g, "''");

  try {
    // 2. Anexa o banco do snapshot
    db.exec(`ATTACH DATABASE '${escapedSnapPath}' AS snapshot_db;`);

    // 3. Desativa temporariamente chaves estrangeiras para permitir truncamento e repovoamento
    db.exec('PRAGMA foreign_keys = OFF;');

    db.exec('BEGIN IMMEDIATE TRANSACTION;');

    const tablesToRestore = [
      'users',
      'clients',
      'locations',
      'equipments',
      'equipment_catalog',
      'equipment_templates',
      'port_forwards',
      'credentials',
      'credential_audit_logs',
      'service_orders',
      'network_topology',
      'audit_history',
      'attachments',
      'entity_links',
      'articles',
      'article_versions',
      'notification_settings',
      'notification_log',
      'domains',
      'favorites',
      'subnets'
    ];

    for (const table of tablesToRestore) {
      const exists = (db.prepare(`SELECT 1 FROM snapshot_db.sqlite_master WHERE type='table' AND name=?`).get(table) as any);
      if (exists) {
        db.exec(`DELETE FROM ${table};`);
        db.exec(`INSERT INTO ${table} SELECT * FROM snapshot_db.${table};`);
      }
    }

    db.exec('COMMIT;');

    // 4. Reativa chaves estrangeiras e valida integridade relacional
    db.exec('PRAGMA foreign_keys = ON;');
    const fkCheck = (db.prepare('PRAGMA foreign_key_check;').all() as any[]);
    if (fkCheck.length > 0) {
      console.warn('[BackupService] Aviso: Inconsistências de FK detectadas após restauração:', fkCheck.length);
    }

    // 5. Desanexa snapshot e consolida WAL
    try {
      db.exec('DETACH DATABASE snapshot_db;');
    } catch {}

    walCheckpoint('TRUNCATE');

    // 6. Reconstrói o índice global FTS5
    rebuildSearchIndex();

    console.log(`[BackupService] Banco de dados restaurado com sucesso a partir de "${filename}".`);
    return {
      success: true,
      message: `Banco restaurado com sucesso a partir de "${filename}". Ponto de segurança salvo como "${safetyBackup.filename}".`,
      preRestoreSnapshot: safetyBackup.filename
    };
  } catch (err: any) {
    try {
      db.exec('ROLLBACK;');
    } catch {}
    try {
      db.exec('PRAGMA foreign_keys = ON;');
    } catch {}
    try {
      db.exec('DETACH DATABASE snapshot_db;');
    } catch {}

    console.error('[BackupService] Falha crítica na restauração do snapshot:', err);
    return {
      success: false,
      message: `Erro ao restaurar banco: ${err?.message || 'Falha desconhecida'}. Seus dados originais foram preservados no ponto "${safetyBackup.filename}".`,
      preRestoreSnapshot: safetyBackup.filename
    };
  }
}

/**
 * Inicia o agendador de backups automáticos em segundo plano.
 * Executa snapshot a cada 12 horas e garante que um snapshot recente sempre exista.
 */
export function startAutomatedBackupScheduler(): void {
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

  const runCheckAndBackup = () => {
    try {
      const snapshots = listSnapshots();
      const now = Date.now();
      const lastBackup = snapshots[0];

      const needBackup = !lastBackup || (now - new Date(lastBackup.created_at).getTime() >= TWELVE_HOURS_MS);

      if (needBackup) {
        console.log('[BackupService] Disparando backup automático periódico de proteção contra perdas...');
        createDatabaseSnapshot({
          type: 'automated',
          label: 'Rotina Automática Periódica (12h)'
        });
      } else {
        const hoursAgo = ((now - new Date(lastBackup.created_at).getTime()) / (1000 * 60 * 60)).toFixed(1);
        console.log(`[BackupService] Último backup realizado há ${hoursAgo}h (${lastBackup.filename}). Próximo agendado.`);
      }
    } catch (err) {
      console.error('[BackupService] Erro ao executar verificação do agendador de backups:', err);
    }
  };

  // Executa verificação inicial após 15 segundos da inicialização
  setTimeout(runCheckAndBackup, 15000);

  // Mantém agendamento contínuo a cada 12 horas
  setInterval(runCheckAndBackup, TWELVE_HOURS_MS);

  console.log('[BackupService] Agendador de backups automáticos ATIVO (frequência: 12h, retenção: 14 pontos).');
}
