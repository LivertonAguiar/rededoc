import { queryAll } from '../db/database.js';

export type ExpirationStatus = 'expired' | 'due_7d' | 'due_30d' | 'ok';
export type ExpirationKind = 'warranty' | 'credential_rotation' | 'domain' | 'ssl';

export interface ExpirationItem {
  id: string;
  kind: ExpirationKind;
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string;
  clientId: string;
  clientName: string;
  dueAt: string; // YYYY-MM-DD
  daysRemaining: number;
  status: ExpirationStatus;
}

export interface ExpirationFilter {
  clientId?: string;
  withinDays?: number;
}

interface ExpirationSource {
  name: string;
  fetch(filter: ExpirationFilter): ExpirationItem[];
}

function calculateStatus(dueAtStr: string): { status: ExpirationStatus; diffDays: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Parse YYYY-MM-DD
  const parts = dueAtStr.slice(0, 10).split('-');
  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let status: ExpirationStatus = 'ok';
  if (diffDays < 0) {
    status = 'expired';
  } else if (diffDays <= 7) {
    status = 'due_7d';
  } else if (diffDays <= 30) {
    status = 'due_30d';
  }

  return { status, diffDays };
}

// Fonte 1: Garantia de Equipamentos
const equipmentWarrantySource: ExpirationSource = {
  name: 'equipment_warranty',
  fetch(filter: ExpirationFilter): ExpirationItem[] {
    let sql = `
      SELECT e.id, e.name, e.model, e.warranty_expires_at, e.client_id, c.name as client_name
      FROM equipments e
      JOIN clients c ON c.id = e.client_id
      WHERE e.warranty_expires_at IS NOT NULL AND TRIM(e.warranty_expires_at) != ''
    `;
    const params: any[] = [];
    if (filter.clientId) {
      sql += ' AND e.client_id = ?';
      params.push(filter.clientId);
    }

    const rows = queryAll<any>(sql, ...params);
    const results: ExpirationItem[] = [];

    for (const row of rows) {
      const { status, diffDays } = calculateStatus(row.warranty_expires_at);

      if (filter.withinDays !== undefined && diffDays > filter.withinDays) {
        continue;
      }

      results.push({
        id: `exp_eq_${row.id}`,
        kind: 'warranty',
        entityType: 'equipment',
        entityId: row.id,
        title: row.name,
        subtitle: `Garantia (${row.model || 'Equipamento'})`,
        clientId: row.client_id,
        clientName: row.client_name,
        dueAt: row.warranty_expires_at.slice(0, 10),
        daysRemaining: diffDays,
        status
      });
    }

    return results;
  }
};

// Fonte 2: Rotação de Credenciais / Senhas
const credentialRotationSource: ExpirationSource = {
  name: 'credential_rotation',
  fetch(filter: ExpirationFilter): ExpirationItem[] {
    let sql = `
      SELECT cred.id, cred.name, cred.category, cred.username, cred.last_changed_at,
             cred.rotation_days, cred.expires_at, cred.client_id, c.name as client_name
      FROM credentials cred
      JOIN clients c ON c.id = cred.client_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (filter.clientId) {
      sql += ' AND cred.client_id = ?';
      params.push(filter.clientId);
    }

    const rows = queryAll<any>(sql, ...params);
    const results: ExpirationItem[] = [];

    for (const row of rows) {
      let dueDateStr: string | null = null;

      // Se tiver data explícita de expiração
      if (row.expires_at && row.expires_at.trim() !== '') {
        dueDateStr = row.expires_at.slice(0, 10);
      }

      // Se tiver política de rotação em dias (ex: 90 dias após última alteração)
      if (row.rotation_days && row.rotation_days > 0 && row.last_changed_at) {
        const lastChanged = new Date(row.last_changed_at);
        const nextRotate = new Date(lastChanged.getTime() + row.rotation_days * 86400000);
        const calcStr = nextRotate.toISOString().slice(0, 10);

        if (!dueDateStr || calcStr < dueDateStr) {
          dueDateStr = calcStr;
        }
      }

      if (!dueDateStr) continue;

      const { status, diffDays } = calculateStatus(dueDateStr);

      if (filter.withinDays !== undefined && diffDays > filter.withinDays) {
        continue;
      }

      results.push({
        id: `exp_cred_${row.id}`,
        kind: 'credential_rotation',
        entityType: 'credential',
        entityId: row.id,
        title: row.name,
        subtitle: `Troca de Senha (${row.username || row.category})`,
        clientId: row.client_id,
        clientName: row.client_name,
        dueAt: dueDateStr,
        daysRemaining: diffDays,
        status
      });
    }

    return results;
  }
};

// Fonte 3: Domínios e Certificados SSL (Fase 7)
const domainExpirationSource: ExpirationSource = {
  name: 'domain_ssl_and_registration',
  fetch(filter: ExpirationFilter): ExpirationItem[] {
    let sql = `
      SELECT d.id, d.name, d.ssl_expires_at, d.expires_at, d.client_id, c.name as client_name
      FROM domains d
      JOIN clients c ON c.id = d.client_id
      WHERE (d.ssl_expires_at IS NOT NULL AND TRIM(d.ssl_expires_at) != '')
         OR (d.expires_at IS NOT NULL AND TRIM(d.expires_at) != '')
    `;
    const params: any[] = [];
    if (filter.clientId) {
      sql += ' AND d.client_id = ?';
      params.push(filter.clientId);
    }

    try {
      const rows = queryAll<any>(sql, ...params);
      const results: ExpirationItem[] = [];

      for (const row of rows) {
        // 1. SSL
        if (row.ssl_expires_at && row.ssl_expires_at.trim() !== '') {
          const { status, diffDays } = calculateStatus(row.ssl_expires_at);
          if (filter.withinDays === undefined || diffDays <= filter.withinDays) {
            results.push({
              id: `exp_ssl_${row.id}`,
              kind: 'ssl',
              entityType: 'domain',
              entityId: row.id,
              title: row.name,
              subtitle: 'Certificado SSL',
              clientId: row.client_id,
              clientName: row.client_name,
              dueAt: row.ssl_expires_at.slice(0, 10),
              daysRemaining: diffDays,
              status
            });
          }
        }

        // 2. Registro do Domínio
        if (row.expires_at && row.expires_at.trim() !== '') {
          const { status, diffDays } = calculateStatus(row.expires_at);
          if (filter.withinDays === undefined || diffDays <= filter.withinDays) {
            results.push({
              id: `exp_dom_${row.id}`,
              kind: 'domain',
              entityType: 'domain',
              entityId: row.id,
              title: row.name,
              subtitle: 'Registro do Domínio',
              clientId: row.client_id,
              clientName: row.client_name,
              dueAt: row.expires_at.slice(0, 10),
              daysRemaining: diffDays,
              status
            });
          }
        }
      }

      return results;
    } catch {
      return [];
    }
  }
};

// Lista extensível de fontes
const registeredSources: ExpirationSource[] = [
  equipmentWarrantySource,
  credentialRotationSource,
  domainExpirationSource
];

/**
 * Registra uma nova fonte de vencimento (usado na Fase 7 para Domínios/SSL)
 */
export function registerExpirationSource(source: ExpirationSource) {
  registeredSources.push(source);
}

/**
 * Lista todos os vencimentos de todas as fontes registradas
 */
export function listExpirations(filter: ExpirationFilter = {}): ExpirationItem[] {
  const all: ExpirationItem[] = [];

  for (const source of registeredSources) {
    try {
      const items = source.fetch(filter);
      all.push(...items);
    } catch (err: any) {
      console.error(`Erro ao coletar vencimentos da fonte ${source.name}:`, err);
    }
  }

  // Ordena por urgência: vencidos primeiro (menor daysRemaining), depois mais próximos
  all.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return all;
}
