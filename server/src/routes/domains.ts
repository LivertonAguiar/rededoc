import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { checkDomain } from '../services/domainCheckService.js';

export const domainsRouter = Router();

/**
 * GET /api/domains
 * Lista domínios com filtro por cliente
 */
domainsRouter.get('/', (req: AuthRequest, res: Response) => {
  const { clientId } = req.query;
  let sql = `
    SELECT d.*, c.name as client_name
    FROM domains d
    JOIN clients c ON c.id = d.client_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (clientId && typeof clientId === 'string') {
    sql += ' AND d.client_id = ?';
    params.push(clientId);
  }

  sql += ' ORDER BY d.score DESC, d.name ASC';
  const rows = queryAll<any>(sql, ...params);

  const formatted = rows.map(r => ({
    ...r,
    dns_snapshot: r.dns_snapshot ? (typeof r.dns_snapshot === 'string' ? JSON.parse(r.dns_snapshot) : r.dns_snapshot) : null
  }));

  res.json(formatted);
});

/**
 * GET /api/domains/:id
 * Detalhe de um domínio específico
 */
domainsRouter.get('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const row = queryOne<any>(`
    SELECT d.*, c.name as client_name
    FROM domains d
    JOIN clients c ON c.id = d.client_id
    WHERE d.id = ?
  `, id);

  if (!row) {
    return res.status(404).json({ error: 'Domínio não encontrado.' });
  }

  res.json({
    ...row,
    dns_snapshot: row.dns_snapshot ? (typeof row.dns_snapshot === 'string' ? JSON.parse(row.dns_snapshot) : row.dns_snapshot) : null
  });
});

/**
 * POST /api/domains
 * Cadastra um novo domínio e executa checagem inicial
 */
domainsRouter.post('/', async (req: AuthRequest, res: Response): Promise<any> => {
  const { client_id, name, registrar, expires_at, nameservers, notes, auto_check } = req.body;
  if (!client_id || !name || !name.trim()) {
    return res.status(400).json({ error: 'Cliente e Nome do Domínio são obrigatórios.' });
  }

  const cleanName = name.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  const id = 'dom_' + crypto.randomUUID().slice(0, 8);

  execute(`
    INSERT INTO domains (
      id, client_id, name, registrar, expires_at, nameservers, notes, auto_check
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    id, client_id, cleanName, registrar || null, expires_at || null,
    nameservers || null, notes || null, auto_check ?? 1
  );

  // Histórico técnico
  try {
    execute(`
      INSERT INTO audit_history (
        id, client_id, user_name, action, entity_type, entity_name, field_name, new_value
      ) VALUES (?, ?, ?, 'create', 'domain', ?, 'Domínio', ?)
    `, 'aud_' + crypto.randomUUID().slice(0, 8), client_id, req.user?.name || 'Técnico', cleanName, `Cadastrado domínio: ${cleanName}`);
  } catch {}

  // Dispara verificação imediata em background / retorno
  try {
    const updated = await checkDomain(id);
    return res.status(201).json({
      ...updated,
      dns_snapshot: updated.dns_snapshot ? JSON.parse(updated.dns_snapshot) : null
    });
  } catch {
    const created = queryOne('SELECT * FROM domains WHERE id = ?', id);
    return res.status(201).json(created);
  }
});

/**
 * PUT /api/domains/:id
 * Atualiza metadados do domínio
 */
domainsRouter.put('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM domains WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Domínio não encontrado.' });
  }

  const { name, registrar, expires_at, nameservers, notes, auto_check } = req.body;
  const cleanName = name ? name.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0] : existing.name;

  execute(`
    UPDATE domains SET
      name = ?, registrar = ?, expires_at = ?, nameservers = ?, notes = ?, auto_check = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    cleanName,
    registrar !== undefined ? registrar : existing.registrar,
    expires_at !== undefined ? expires_at : existing.expires_at,
    nameservers !== undefined ? nameservers : existing.nameservers,
    notes !== undefined ? notes : existing.notes,
    auto_check !== undefined ? auto_check : existing.auto_check,
    id
  );

  const updated = queryOne<any>('SELECT * FROM domains WHERE id = ?', id);
  res.json({
    ...updated,
    dns_snapshot: updated.dns_snapshot ? (typeof updated.dns_snapshot === 'string' ? JSON.parse(updated.dns_snapshot) : updated.dns_snapshot) : null
  });
});

/**
 * DELETE /api/domains/:id
 * Remove o domínio e limpa vínculos manuais
 */
domainsRouter.delete('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM domains WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Domínio não encontrado.' });
  }

  // Remove vínculos da entidade
  execute(`
    DELETE FROM entity_links
    WHERE (source_type = 'domain' AND source_id = ?)
       OR (target_type = 'domain' AND target_id = ?)
  `, id, id);

  execute('DELETE FROM domains WHERE id = ?', id);

  res.json({ message: 'Domínio removido com sucesso.' });
});

/**
 * POST /api/domains/:id/check
 * Dispara checagem de SSL, DNS e RDAP do domínio agora
 */
domainsRouter.post('/:id/check', async (req: AuthRequest, res: Response): Promise<any> => {
  const id = String(req.params.id);
  try {
    const updated = await checkDomain(id);
    res.json({
      ...updated,
      dns_snapshot: updated.dns_snapshot ? JSON.parse(updated.dns_snapshot) : null
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Falha ao verificar domínio: ' + err.message });
  }
});
