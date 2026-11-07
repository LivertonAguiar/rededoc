import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { listExpirations } from '../services/expirationService.js';

export const expirationsRouter = Router();

/**
 * GET /api/expirations
 * Retorna lista unificada de itens vencidos ou próximos do vencimento
 */
expirationsRouter.get('/', (req: AuthRequest, res: Response) => {
  const { clientId, withinDays } = req.query;

  const filter: any = {};
  if (clientId && typeof clientId === 'string') {
    filter.clientId = clientId;
  }
  if (withinDays !== undefined && !isNaN(Number(withinDays))) {
    filter.withinDays = Number(withinDays);
  }

  const items = listExpirations(filter);
  res.json(items);
});
