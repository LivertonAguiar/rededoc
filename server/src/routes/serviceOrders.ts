import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

export const serviceOrdersRouter = Router();

serviceOrdersRouter.get('/', (req: Request, res: Response) => {
  const { clientId, locationId, status } = req.query;
  let query = `
    SELECT so.*, c.name AS client_name, l.name AS location_name
    FROM service_orders so
    JOIN clients c ON c.id = so.client_id
    JOIN locations l ON l.id = so.location_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (clientId) {
    query += ' AND so.client_id = ?';
    params.push(clientId);
  }
  if (locationId) {
    query += ' AND so.location_id = ?';
    params.push(locationId);
  }
  if (status) {
    query += ' AND so.status = ?';
    params.push(status);
  }

  query += ' ORDER BY so.date_time DESC';
  const orders = queryAll(query, ...params);
  res.json(orders);
});

serviceOrdersRouter.get('/:id', (req: Request, res: Response): any => {
  const order = queryOne(`
    SELECT so.*, c.name AS client_name, l.name AS location_name, l.address AS location_address
    FROM service_orders so
    JOIN clients c ON c.id = so.client_id
    JOIN locations l ON l.id = so.location_id
    WHERE so.id = ?
  `, req.params.id);

  if (!order) {
    return res.status(404).json({ error: 'Atendimento não encontrado.' });
  }

  const attachments = queryAll('SELECT * FROM attachments WHERE service_order_id = ?', order.id);
  const auditEntries = queryAll('SELECT * FROM audit_history WHERE service_order_id = ?', order.id);

  res.json({ ...order, attachments, audit_entries: auditEntries });
});

serviceOrdersRouter.post('/', (req: AuthRequest, res: Response): any => {
  const {
    client_id, location_id, technician_name, date_time, service_type,
    problem_description, status, equipments_involved, changes_made,
    tests_performed, test_results, technical_notes,
    service_cost, time_spent_minutes, additional_info
  } = req.body;

  if (!client_id) {
    return res.status(400).json({ error: 'O cliente vinculado é obrigatório.' });
  }

  // Garante um local válido para o atendimento
  let locId = location_id;
  if (!locId) {
    const loc = queryOne('SELECT id FROM locations WHERE client_id = ? LIMIT 1', client_id) as any;
    if (loc) {
      locId = loc.id;
    } else {
      locId = 'loc_' + crypto.randomUUID().slice(0, 8);
      execute('INSERT INTO locations (id, client_id, name) VALUES (?, ?, ?)', locId, client_id, 'Sede Principal');
    }
  }

  const st = (service_type && String(service_type).trim()) || 'Atendimento Técnico';
  const tn = technical_notes ? String(technical_notes).trim() : null;
  const pd = (problem_description && String(problem_description).trim()) || tn || st;

  const id = 'so_' + crypto.randomUUID().slice(0, 8);
  const tech = technician_name || req.user?.name || 'Técnico';
  const dt = date_time || new Date().toISOString().slice(0, 16).replace('T', ' ');

  execute(`
    INSERT INTO service_orders (
      id, client_id, location_id, technician_id, technician_name, date_time,
      service_type, problem_description, status, equipments_involved,
      changes_made, tests_performed, test_results, technical_notes,
      service_cost, time_spent_minutes, additional_info
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    id, client_id, locId, req.user?.id || null, tech, dt,
    st, pd, status || 'concluido',
    equipments_involved ? (typeof equipments_involved === 'string' ? equipments_involved : JSON.stringify(equipments_involved)) : '[]',
    changes_made || null, tests_performed || null, test_results || null, tn,
    service_cost !== undefined ? Number(service_cost) : 0,
    time_spent_minutes !== undefined ? Number(time_spent_minutes) : 0,
    additional_info || null
  );

  const created = queryOne('SELECT * FROM service_orders WHERE id = ?', id);
  res.status(201).json(created);
});

serviceOrdersRouter.put('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM service_orders WHERE id = ?', id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Atendimento não encontrado.' });
  }

  const {
    technician_name, date_time, service_type, problem_description, status,
    equipments_involved, changes_made, tests_performed, test_results, technical_notes,
    service_cost, time_spent_minutes, additional_info
  } = req.body;

  execute(`
    UPDATE service_orders SET
      technician_name = ?, date_time = ?, service_type = ?, problem_description = ?,
      status = ?, equipments_involved = ?, changes_made = ?, tests_performed = ?,
      test_results = ?, technical_notes = ?,
      service_cost = ?, time_spent_minutes = ?, additional_info = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    technician_name !== undefined ? technician_name : existing.technician_name,
    date_time !== undefined ? date_time : existing.date_time,
    service_type !== undefined ? service_type : existing.service_type,
    problem_description !== undefined ? problem_description : existing.problem_description,
    status !== undefined ? status : existing.status,
    equipments_involved !== undefined ? (typeof equipments_involved === 'string' ? equipments_involved : JSON.stringify(equipments_involved)) : existing.equipments_involved,
    changes_made !== undefined ? changes_made : existing.changes_made,
    tests_performed !== undefined ? tests_performed : existing.tests_performed,
    test_results !== undefined ? test_results : existing.test_results,
    technical_notes !== undefined ? technical_notes : existing.technical_notes,
    service_cost !== undefined ? Number(service_cost) : existing.service_cost,
    time_spent_minutes !== undefined ? Number(time_spent_minutes) : existing.time_spent_minutes,
    additional_info !== undefined ? additional_info : existing.additional_info,
    id
  );

  const updated = queryOne('SELECT * FROM service_orders WHERE id = ?', id);
  res.json(updated);
});

serviceOrdersRouter.delete('/:id', (req: Request, res: Response): any => {
  const { id } = req.params;
  const result = execute('DELETE FROM service_orders WHERE id = ?', id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Atendimento não encontrado.' });
  }
  res.json({ message: 'Atendimento excluído com sucesso.' });
});
