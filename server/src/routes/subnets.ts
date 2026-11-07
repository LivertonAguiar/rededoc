import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { subnetSchema } from '../schemas/index.js';
import { getSubnetUsage, suggestSubnetsForClient, detectClientIpConflicts } from '../services/ipam.js';

export const subnetsRouter = Router();

/**
 * GET /api/subnets
 * Lista todas as sub-redes (opcionalmente filtrando por clientId)
 */
subnetsRouter.get('/', (req: AuthRequest, res: Response) => {
  const { clientId } = req.query;
  let sql = `
    SELECT s.*, c.name as client_name, l.name as location_name
    FROM subnets s
    JOIN clients c ON c.id = s.client_id
    LEFT JOIN locations l ON l.id = s.location_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (clientId) {
    sql += ' AND s.client_id = ?';
    params.push(clientId);
  }
  sql += ' ORDER BY s.name ASC';

  const subnets = queryAll<any>(sql, ...params);
  res.json(subnets);
});

/**
 * GET /api/subnets/suggest?clientId=...
 * Sugere faixas de sub-redes a partir dos equipamentos cadastrados no cliente
 */
subnetsRouter.get('/suggest', (req: AuthRequest, res: Response): any => {
  const { clientId } = req.query;
  if (!clientId || typeof clientId !== 'string') {
    return res.status(400).json({ error: 'clientId é obrigatório para sugestão de sub-redes.' });
  }

  const suggestions = suggestSubnetsForClient(clientId);
  res.json(suggestions);
});

/**
 * GET /api/subnets/conflicts?clientId=...
 * Detecta conflitos de endereçamento IP (duplicidades, DHCP sem reserva de MAC)
 */
subnetsRouter.get('/conflicts', (req: AuthRequest, res: Response): any => {
  const { clientId } = req.query;
  if (!clientId || typeof clientId !== 'string') {
    return res.status(400).json({ error: 'clientId é obrigatório.' });
  }

  const report = detectClientIpConflicts(clientId);
  res.json(report);
});

/**
 * GET /api/subnets/:id/usage
 * Relatório completo de ocupação IPv4, grade de IPs e próximo IP livre
 */
subnetsRouter.get('/:id/usage', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  try {
    const usage = getSubnetUsage(String(id));
    res.json(usage);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Falha ao calcular ocupação da sub-rede.' });
  }
});

/**
 * GET /api/subnets/:id
 * Detalhes de uma sub-rede por ID
 */
subnetsRouter.get('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const subnet = queryOne<any>(`
    SELECT s.*, c.name as client_name, l.name as location_name
    FROM subnets s
    JOIN clients c ON c.id = s.client_id
    LEFT JOIN locations l ON l.id = s.location_id
    WHERE s.id = ?
  `, id);

  if (!subnet) {
    return res.status(404).json({ error: 'Sub-rede não encontrada.' });
  }

  res.json(subnet);
});

/**
 * POST /api/subnets
 * Cria uma nova sub-rede
 */
subnetsRouter.post('/', validateBody(subnetSchema), (req: AuthRequest, res: Response): any => {
  const { client_id, location_id, name, cidr, gateway, vlan, dhcp_start, dhcp_end, notes } = req.body;
  const id = `sub_${crypto.randomUUID().slice(0, 12)}`;

  execute(`
    INSERT INTO subnets (
      id, client_id, location_id, name, cidr, gateway, vlan, dhcp_start, dhcp_end, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    id,
    client_id,
    location_id || null,
    name.trim(),
    cidr.trim(),
    gateway ? gateway.trim() : null,
    vlan ? vlan.trim() : null,
    dhcp_start ? dhcp_start.trim() : null,
    dhcp_end ? dhcp_end.trim() : null,
    notes ? notes.trim() : null
  );

  // Registro em audit_history
  execute(`
    INSERT INTO audit_history (id, client_id, user_name, action, entity_type, entity_name, details)
    VALUES (?, ?, ?, 'CRIACAO', 'subnet', ?, ?)
  `,
    `aud_${crypto.randomUUID().slice(0, 12)}`,
    client_id,
    req.user?.name || 'Técnico',
    name.trim(),
    `Sub-rede ${name.trim()} (${cidr.trim()}) cadastrada no IPAM.`
  );

  const created = queryOne<any>('SELECT * FROM subnets WHERE id = ?', id);
  res.status(201).json(created);
});

/**
 * PUT /api/subnets/:id
 * Atualiza uma sub-rede existente
 */
subnetsRouter.put('/:id', validateBody(subnetSchema), (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const { location_id, name, cidr, gateway, vlan, dhcp_start, dhcp_end, notes } = req.body;

  const existing = queryOne<any>('SELECT * FROM subnets WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Sub-rede não encontrada.' });
  }

  execute(`
    UPDATE subnets SET
      location_id = ?,
      name = ?,
      cidr = ?,
      gateway = ?,
      vlan = ?,
      dhcp_start = ?,
      dhcp_end = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    location_id || null,
    name.trim(),
    cidr.trim(),
    gateway ? gateway.trim() : null,
    vlan ? vlan.trim() : null,
    dhcp_start ? dhcp_start.trim() : null,
    dhcp_end ? dhcp_end.trim() : null,
    notes ? notes.trim() : null,
    id
  );

  const updated = queryOne<any>('SELECT * FROM subnets WHERE id = ?', id);
  res.json(updated);
});

/**
 * DELETE /api/subnets/:id
 * Remove uma sub-rede
 */
subnetsRouter.delete('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne<any>('SELECT * FROM subnets WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Sub-rede não encontrada.' });
  }

  execute('DELETE FROM subnets WHERE id = ?', id);

  execute(`
    INSERT INTO audit_history (id, client_id, user_name, action, entity_type, entity_name, details)
    VALUES (?, ?, ?, 'REMOCAO', 'subnet', ?, ?)
  `,
    `aud_${crypto.randomUUID().slice(0, 12)}`,
    existing.client_id,
    req.user?.name || 'Técnico',
    existing.name,
    `Sub-rede ${existing.name} (${existing.cidr}) removida do IPAM.`
  );

  res.json({ message: 'Sub-rede removida com sucesso.' });
});

