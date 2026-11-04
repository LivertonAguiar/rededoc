import { Router, Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import jwt from 'jsonwebtoken';
import { ZipArchive } from 'archiver';
import { db } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'rededoc-jwt-secret-condominio-aurora-2026';

export const backupRouter = Router();

// Valida token JWT via Header ou Query Parameter (para links diretos de download)
function backupAuth(req: Request, res: Response, next: NextFunction): any {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.split(' ')[1]
    : (req.query.token as string);

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Autenticação obrigatória para operações de backup.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

backupRouter.use(backupAuth);

// Endpoint: Exportação completa consolidada em ZIP (JSON + SQLite + Uploads)
backupRouter.get('/export-zip', async (req: Request, res: Response) => {
  try {
    // Força o SQLite a gravar alterações do WAL no arquivo principal antes do empacotamento
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (e) {
      console.warn('Aviso no checkpoint WAL:', e);
    }

    const filename = `rededoc-full-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/zip');

    const archive = new ZipArchive({
      zlib: { level: 9 }
    });

    archive.on('error', (err: any) => {
      console.error('Erro na geração do ZIP:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Falha ao compactar backup: ' + (err?.message || 'Erro desconhecido') });
      }
    });

    archive.pipe(res);

    // 1. Gera manifesto com resumo
    const clientsCount = (db.prepare('SELECT COUNT(*) as c FROM clients').get() as any)?.c || 0;
    const equipmentsCount = (db.prepare('SELECT COUNT(*) as c FROM equipments').get() as any)?.c || 0;
    const credentialsCount = (db.prepare('SELECT COUNT(*) as c FROM credentials').get() as any)?.c || 0;
    const portsCount = (db.prepare('SELECT COUNT(*) as c FROM port_forwards').get() as any)?.c || 0;

    const manifest = {
      system: 'RedeDoc',
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      summary: {
        total_clients: clientsCount,
        total_equipments: equipmentsCount,
        total_credentials: credentialsCount,
        total_ports: portsCount
      }
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // 2. Anexa o JSON completo de dados
    const fullJsonData = {
      ...manifest,
      users: db.prepare('SELECT id, name, email, role, created_at FROM users').all(),
      clients: db.prepare('SELECT * FROM clients').all(),
      locations: db.prepare('SELECT * FROM locations').all(),
      equipments: db.prepare('SELECT * FROM equipments').all(),
      port_forwards: db.prepare('SELECT * FROM port_forwards').all(),
      credentials: db.prepare('SELECT * FROM credentials').all(),
      credential_audit_logs: db.prepare('SELECT * FROM credential_audit_logs').all(),
      service_orders: db.prepare('SELECT * FROM service_orders').all(),
      network_topology: db.prepare('SELECT * FROM network_topology').all(),
      audit_history: db.prepare('SELECT * FROM audit_history').all(),
      attachments: db.prepare('SELECT * FROM attachments').all()
    };
    archive.append(JSON.stringify(fullJsonData, null, 2), { name: 'data_export.json' });

    // 3. Anexa o arquivo binário rededoc.sqlite se existir
    const resolvedDataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
    const sqlitePath = path.join(resolvedDataDir, 'rededoc.sqlite');
    if (fs.existsSync(sqlitePath)) {
      archive.file(sqlitePath, { name: 'database/rededoc.sqlite' });
    }

    // 4. Anexa a pasta uploads (fotos de equipamentos e arquivos de configuração)
    const resolvedUploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
    if (fs.existsSync(resolvedUploadDir)) {
      archive.directory(resolvedUploadDir, 'uploads');
    }

    await archive.finalize();
  } catch (err: any) {
    console.error('Erro geral no export-zip:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao gerar backup completo: ' + err.message });
    }
  }
});

// Endpoint: Exportação legada em formato JSON simples
backupRouter.get('/export', (req: Request, res: Response) => {
  const data = {
    exported_at: new Date().toISOString(),
    version: '1.0.0',
    system: 'RedeDoc',
    users: db.prepare('SELECT id, name, email, role, created_at FROM users').all(),
    clients: db.prepare('SELECT * FROM clients').all(),
    locations: db.prepare('SELECT * FROM locations').all(),
    equipments: db.prepare('SELECT * FROM equipments').all(),
    port_forwards: db.prepare('SELECT * FROM port_forwards').all(),
    credentials: db.prepare('SELECT * FROM credentials').all(),
    credential_audit_logs: db.prepare('SELECT * FROM credential_audit_logs').all(),
    service_orders: db.prepare('SELECT * FROM service_orders').all(),
    network_topology: db.prepare('SELECT * FROM network_topology').all(),
    audit_history: db.prepare('SELECT * FROM audit_history').all(),
    attachments: db.prepare('SELECT * FROM attachments').all()
  };

  const filename = `rededoc-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});

backupRouter.post('/import', (req: Request, res: Response): any => {
  const data = req.body;
  if (!data || !data.clients || !Array.isArray(data.clients)) {
    return res.status(400).json({ error: 'Formato de backup inválido.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    // Limpa dados atuais
    db.exec(`
      DELETE FROM credential_audit_logs;
      DELETE FROM credentials;
      DELETE FROM port_forwards;
      DELETE FROM equipments;
      DELETE FROM service_orders;
      DELETE FROM network_topology;
      DELETE FROM audit_history;
      DELETE FROM attachments;
      DELETE FROM locations;
      DELETE FROM clients;
    `);

    // Restaura Clientes
    const insClient = db.prepare(`
      INSERT INTO clients (id, name, identification_name, document, phone, email, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of data.clients) {
      insClient.run(c.id, c.name, c.identification_name, c.document, c.phone, c.email, c.notes, c.created_at || new Date().toISOString(), c.updated_at || new Date().toISOString());
    }

    // Restaura Locais
    if (data.locations) {
      const insLoc = db.prepare(`
        INSERT INTO locations (id, client_id, name, address, contact_name, phone, access_notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of data.locations) {
        insLoc.run(l.id, l.client_id, l.name, l.address, l.contact_name, l.phone, l.access_notes, l.created_at || new Date().toISOString(), l.updated_at || new Date().toISOString());
      }
    }

    // Restaura Equipamentos
    if (data.equipments) {
      const insEq = db.prepare(`
        INSERT INTO equipments (
          id, client_id, location_id, name, category, manufacturer, model, serial_number,
          mac_address, physical_location, photo_url, notes,
          local_ip, subnet_mask, gateway, primary_dns, secondary_dns, dhcp_range,
          interface_name, vlan, is_mac_reserved, public_wan_ip,
          access_url, management_port, protocol, admin_username, config_path, access_notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const e of data.equipments) {
        insEq.run(
          e.id, e.client_id, e.location_id, e.name, e.category, e.manufacturer, e.model, e.serial_number,
          e.mac_address, e.physical_location, e.photo_url, e.notes,
          e.local_ip, e.subnet_mask, e.gateway, e.primary_dns, e.secondary_dns, e.dhcp_range,
          e.interface_name, e.vlan, e.is_mac_reserved, e.public_wan_ip,
          e.access_url, e.management_port, e.protocol, e.admin_username, e.config_path, e.access_notes,
          e.created_at || new Date().toISOString(), e.updated_at || new Date().toISOString()
        );
      }
    }

    // Restaura Port Forwards
    if (data.port_forwards) {
      const insPf = db.prepare(`
        INSERT INTO port_forwards (
          id, client_id, location_id, equipment_id, service_name, source_wan_ip,
          external_port, destination_local_ip, internal_port, protocol,
          router_config_path, status, service_order_id, notes, configured_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of data.port_forwards) {
        insPf.run(
          p.id, p.client_id, p.location_id, p.equipment_id, p.service_name, p.source_wan_ip,
          p.external_port, p.destination_local_ip, p.internal_port, p.protocol,
          p.router_config_path, p.status, p.service_order_id, p.notes,
          p.configured_at || new Date().toISOString(), p.created_at || new Date().toISOString(), p.updated_at || new Date().toISOString()
        );
      }
    }

    // Restaura Credenciais
    if (data.credentials) {
      const insCred = db.prepare(`
        INSERT INTO credentials (
          id, client_id, equipment_id, name, category, username,
          encrypted_password, iv, auth_tag, access_url, port, notes, last_changed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const cr of data.credentials) {
        insCred.run(
          cr.id, cr.client_id, cr.equipment_id, cr.name, cr.category, cr.username,
          cr.encrypted_password, cr.iv, cr.auth_tag, cr.access_url, cr.port, cr.notes,
          cr.last_changed_at || new Date().toISOString(), cr.created_at || new Date().toISOString(), cr.updated_at || new Date().toISOString()
        );
      }
    }

    // Restaura Topologia
    if (data.network_topology) {
      const insTopo = db.prepare(`
        INSERT INTO network_topology (id, client_id, location_id, nodes_data, edges_data, view_mode, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of data.network_topology) {
        insTopo.run(t.id, t.client_id, t.location_id, t.nodes_data, t.edges_data, t.view_mode, t.updated_at || new Date().toISOString());
      }
    }

    // Restaura Atendimentos
    if (data.service_orders) {
      const insSo = db.prepare(`
        INSERT INTO service_orders (
          id, client_id, location_id, technician_id, technician_name, date_time,
          service_type, problem_description, status, equipments_involved,
          changes_made, tests_performed, test_results, technical_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of data.service_orders) {
        insSo.run(
          s.id, s.client_id, s.location_id, s.technician_id, s.technician_name, s.date_time,
          s.service_type, s.problem_description, s.status, s.equipments_involved,
          s.changes_made, s.tests_performed, s.test_results, s.technical_notes,
          s.created_at || new Date().toISOString(), s.updated_at || new Date().toISOString()
        );
      }
    }

    db.exec('COMMIT;');
    res.json({ message: 'Backup restaurado com sucesso!' });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    console.error('Erro na restauração do backup:', err);
    res.status(500).json({ error: 'Falha ao restaurar backup: ' + err.message });
  }
});
