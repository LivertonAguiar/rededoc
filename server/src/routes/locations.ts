import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';

export const locationsRouter = Router();

locationsRouter.get('/', (req: Request, res: Response) => {
  const { clientId } = req.query;
  let query = `
    SELECT l.*, c.name AS client_name,
      (SELECT COUNT(*) FROM equipments e WHERE e.location_id = l.id) AS total_equipments,
      (SELECT COUNT(*) FROM port_forwards pf WHERE pf.location_id = l.id) AS total_ports
    FROM locations l
    JOIN clients c ON c.id = l.client_id
  `;
  const params: any[] = [];

  if (clientId) {
    query += ' WHERE l.client_id = ?';
    params.push(clientId);
  }

  query += ' ORDER BY l.name ASC';
  const locations = queryAll(query, ...params);
  res.json(locations);
});

locationsRouter.get('/:id', (req: Request, res: Response): any => {
  const location = queryOne(`
    SELECT l.*, c.name AS client_name
    FROM locations l
    JOIN clients c ON c.id = l.client_id
    WHERE l.id = ?
  `, req.params.id);

  if (!location) {
    return res.status(404).json({ error: 'Local não encontrado.' });
  }
  res.json(location);
});

locationsRouter.post('/', (req: Request, res: Response): any => {
  const { client_id, name, address, contact_name, phone, access_notes } = req.body;
  if (!client_id || !name || !address) {
    return res.status(400).json({ error: 'Cliente, Nome e Endereço são obrigatórios.' });
  }

  const id = 'loc_' + crypto.randomUUID().slice(0, 8);
  execute(`
    INSERT INTO locations (id, client_id, name, address, contact_name, phone, access_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, id, client_id, name, address, contact_name || null, phone || null, access_notes || null);

  const created = queryOne('SELECT * FROM locations WHERE id = ?', id);
  res.status(201).json(created);
});

locationsRouter.put('/:id', (req: Request, res: Response): any => {
  const { name, address, contact_name, phone, access_notes } = req.body;
  const { id } = req.params;

  const existing = queryOne('SELECT id FROM locations WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Local não encontrado.' });
  }

  execute(`
    UPDATE locations 
    SET name = ?, address = ?, contact_name = ?, phone = ?, access_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, name, address, contact_name || null, phone || null, access_notes || null, id);

  const updated = queryOne('SELECT * FROM locations WHERE id = ?', id);
  res.json(updated);
});

locationsRouter.delete('/:id', (req: Request, res: Response): any => {
  const { id } = req.params;
  const result = execute('DELETE FROM locations WHERE id = ?', id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Local não encontrado.' });
  }
  res.json({ message: 'Local excluído com sucesso.' });
});
