import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { validateBody } from '../middleware/validate.js';
import { clientSchema } from '../schemas/index.js';

export const clientsRouter = Router();

clientsRouter.get('/', (req: Request, res: Response) => {
  const clients = queryAll(`
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM locations l WHERE l.client_id = c.id) AS total_locations,
      (SELECT COUNT(*) FROM equipments e WHERE e.client_id = c.id) AS total_equipments,
      (SELECT COUNT(*) FROM port_forwards pf WHERE pf.client_id = c.id) AS total_ports,
      (SELECT COUNT(*) FROM port_forwards pf WHERE pf.client_id = c.id AND pf.status = 'funcionando') AS active_ports
    FROM clients c
    ORDER BY c.name ASC
  `);

  res.json(clients);
});

clientsRouter.get('/:id', (req: Request, res: Response): any => {
  const client = queryOne('SELECT * FROM clients WHERE id = ?', req.params.id);
  if (!client) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }

  const locations = queryAll('SELECT * FROM locations WHERE client_id = ? ORDER BY name ASC', client.id);
  res.json({ ...client, locations });
});

clientsRouter.post('/', validateBody(clientSchema), (req: Request, res: Response): any => {
  const { name, identification_name, document, phone, email, address, notes } = req.body;
  if (!name || !identification_name) {
    return res.status(400).json({ error: 'Nome e Nome de Identificação são obrigatórios.' });
  }

  const id = 'cli_' + crypto.randomUUID().slice(0, 8);
  execute(`
    INSERT INTO clients (id, name, identification_name, document, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, id, name, identification_name, document || null, phone || null, email || null, address || null, notes || null);

  const created = queryOne('SELECT * FROM clients WHERE id = ?', id);
  res.status(201).json(created);
});

clientsRouter.put('/:id', validateBody(clientSchema), (req: Request, res: Response): any => {
  const { name, identification_name, document, phone, email, address, notes } = req.body;
  const { id } = req.params;

  const existing = queryOne('SELECT id FROM clients WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }

  execute(`
    UPDATE clients 
    SET name = ?, identification_name = ?, document = ?, phone = ?, email = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, name, identification_name, document || null, phone || null, email || null, address || null, notes || null, id);

  const updated = queryOne('SELECT * FROM clients WHERE id = ?', id);
  res.json(updated);
});

clientsRouter.delete('/:id', (req: Request, res: Response): any => {
  const { id } = req.params;
  const result = execute('DELETE FROM clients WHERE id = ?', id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }
  res.json({ message: 'Cliente excluído com sucesso.' });
});
