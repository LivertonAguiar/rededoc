import { Router, Request, Response } from 'express';
import { queryAll } from '../db/database.js';

export const auditHistoryRouter = Router();

auditHistoryRouter.get('/', (req: Request, res: Response) => {
  const { clientId, equipmentId, limit } = req.query;
  let query = `
    SELECT ah.*, c.name AS client_name
    FROM audit_history ah
    JOIN clients c ON c.id = ah.client_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (clientId) {
    query += ' AND ah.client_id = ?';
    params.push(clientId);
  }
  if (equipmentId) {
    query += ' AND ah.equipment_id = ?';
    params.push(equipmentId);
  }

  query += ' ORDER BY ah.created_at DESC LIMIT ?';
  params.push(limit ? Number(limit) : 50);

  const entries = queryAll(query, ...params);
  res.json(entries);
});
