import { Router, Response } from 'express';
import { AuthRequest, requireRole } from '../middleware/auth.js';
import { searchGlobal } from '../services/searchService.js';

export const searchRouter = Router();

// Apenas administradores e técnicos podem realizar buscas globais
searchRouter.use(requireRole('admin', 'tecnico'));

/**
 * GET /api/search?q=...&clientId=...
 * Realiza busca global unificada em todas as entidades do sistema
 */
searchRouter.get('/', (req: AuthRequest, res: Response): any => {
  const query = req.query.q as string;
  const clientId = req.query.clientId as string | undefined;

  if (!query || query.trim().length === 0) {
    return res.json({ total: 0, results: [], byType: {} });
  }

  const results = searchGlobal(query, clientId, 30);
  res.json(results);
});
