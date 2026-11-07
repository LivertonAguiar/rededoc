import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

export const favoritesRouter = Router();

/**
 * GET /api/favorites
 * Lista todos os favoritos do usuário logado com dados das entidades
 */
favoritesRouter.get('/', (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  const favs = queryAll<any>(`
    SELECT id, entity_type, entity_id, created_at
    FROM favorites
    WHERE user_id = ?
    ORDER BY created_at DESC
  `, userId);

  const enriched = favs.map(f => {
    let title = 'Item Favorito';
    let subtitle = '';
    let clientId: string | null = null;
    let clientName: string | null = null;
    let urlHash = '';

    switch (f.entity_type) {
      case 'client': {
        const c = queryOne<any>('SELECT id, name, address FROM clients WHERE id = ?', f.entity_id);
        if (c) {
          title = c.name;
          subtitle = c.address || 'Condomínio';
          clientId = c.id;
          clientName = c.name;
          urlHash = 'client-network';
        }
        break;
      }
      case 'equipment': {
        const eq = queryOne<any>(`
          SELECT e.id, e.name, e.model, e.local_ip, e.client_id, c.name as client_name
          FROM equipments e
          JOIN clients c ON c.id = e.client_id
          WHERE e.id = ?
        `, f.entity_id);
        if (eq) {
          title = eq.name;
          subtitle = `${eq.client_name} • ${eq.model || ''} (${eq.local_ip || 'Sem IP'})`;
          clientId = eq.client_id;
          clientName = eq.client_name;
          urlHash = `equipments/${eq.id}`;
        }
        break;
      }
      case 'credential': {
        const cr = queryOne<any>(`
          SELECT cr.id, cr.name, cr.username, cr.client_id, c.name as client_name
          FROM credentials cr
          JOIN clients c ON c.id = cr.client_id
          WHERE cr.id = ?
        `, f.entity_id);
        if (cr) {
          title = cr.name;
          subtitle = `${cr.client_name} • Usuário: ${cr.username || 'admin'}`;
          clientId = cr.client_id;
          clientName = cr.client_name;
          urlHash = `credentials/${cr.id}`;
        }
        break;
      }
      case 'article': {
        const art = queryOne<any>(`
          SELECT a.id, a.title, a.client_id, c.name as client_name
          FROM articles a
          LEFT JOIN clients c ON c.id = a.client_id
          WHERE a.id = ?
        `, f.entity_id);
        if (art) {
          title = art.title;
          subtitle = art.client_name ? `${art.client_name} • Procedimento` : 'Procedimento Geral';
          clientId = art.client_id;
          clientName = art.client_name;
          urlHash = `procedures/${art.id}`;
        }
        break;
      }
      case 'domain': {
        const dom = queryOne<any>(`
          SELECT d.id, d.name, d.client_id, c.name as client_name
          FROM domains d
          JOIN clients c ON c.id = d.client_id
          WHERE d.id = ?
        `, f.entity_id);
        if (dom) {
          title = dom.name;
          subtitle = `${dom.client_name} • Domínio/DNS`;
          clientId = dom.client_id;
          clientName = dom.client_name;
          urlHash = `domains/${dom.id}`;
        }
        break;
      }
    }

    return {
      id: f.id,
      entityType: f.entity_type,
      entityId: f.entity_id,
      title,
      subtitle,
      clientId,
      clientName,
      urlHash,
      createdAt: f.created_at
    };
  });

  res.json(enriched);
});

/**
 * GET /api/favorites/check?type=...&id=...
 * Verifica se uma entidade é favorita do usuário atual
 */
favoritesRouter.get('/check', (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const entityType = req.query.type as string;
  const entityId = req.query.id as string;

  if (!userId || !entityType || !entityId) {
    return res.json({ isFavorite: false });
  }

  const fav = queryOne<any>(`
    SELECT id FROM favorites WHERE user_id = ? AND entity_type = ? AND entity_id = ?
  `, userId, entityType, entityId);

  res.json({ isFavorite: Boolean(fav) });
});

/**
 * POST /api/favorites
 * Adiciona uma entidade aos favoritos
 */
favoritesRouter.post('/', (req: AuthRequest, res: Response): any => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  const { entityType, entityId } = req.body;
  if (!entityType || !entityId) {
    return res.status(400).json({ error: 'entityType e entityId são obrigatórios.' });
  }

  const existing = queryOne<any>(`
    SELECT id FROM favorites WHERE user_id = ? AND entity_type = ? AND entity_id = ?
  `, userId, entityType, entityId);

  if (existing) {
    return res.json({ id: existing.id, isFavorite: true });
  }

  const favId = `fav_${crypto.randomUUID().slice(0, 12)}`;
  execute(`
    INSERT INTO favorites (id, user_id, entity_type, entity_id)
    VALUES (?, ?, ?, ?)
  `, favId, userId, entityType, entityId);

  res.status(201).json({ id: favId, isFavorite: true });
});

/**
 * DELETE /api/favorites/:entityType/:entityId
 * Remove uma entidade dos favoritos
 */
favoritesRouter.delete('/:entityType/:entityId', (req: AuthRequest, res: Response): any => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado.' });
  }

  const { entityType, entityId } = req.params;
  execute(`
    DELETE FROM favorites WHERE user_id = ? AND entity_type = ? AND entity_id = ?
  `, userId, entityType, entityId);

  res.json({ message: 'Favorito removido com sucesso.', isFavorite: false });
});
