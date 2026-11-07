import { Router, Response } from 'express';
import { queryAll, queryOne } from '../db/database.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

export const portalRouter = Router();

// Todo o portal do cliente exige autenticação e papel estrito 'cliente'
portalRouter.use(requireAuth);
portalRouter.use(requireRole('cliente'));

// Middleware de verificação de vinculação do cliente
portalRouter.use((req: AuthRequest, res: Response, next) => {
  const clientId = req.user?.client_id;
  if (!clientId) {
    return res.status(403).json({ error: 'Acesso negado. Usuário não possui condomínio associado no cadastro.' });
  }
  next();
});

/**
 * GET /api/portal/overview
 * Retorna dados cadastrais seguros do condomínio, lista de locais físicos e contadores
 */
portalRouter.get('/overview', (req: AuthRequest, res: Response): any => {
  const clientId = req.user!.client_id!;

  const client = queryOne(`
    SELECT id, name, identification_name, document, phone, email, address
    FROM clients
    WHERE id = ?
  `, clientId);

  if (!client) {
    return res.status(404).json({ error: 'Condomínio não localizado no sistema.' });
  }

  // DTO estrito de locais: SEM access_notes
  const locations = queryAll(`
    SELECT id, name, address, contact_name, phone
    FROM locations
    WHERE client_id = ?
    ORDER BY name ASC
  `, clientId);

  // Contadores e métricas de atendimento
  const eqCount = queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM equipments WHERE client_id = ?
  `, clientId)?.count || 0;

  const servicesCount = queryOne<{ count: number }>(`
    SELECT COUNT(*) as count FROM service_orders WHERE client_id = ? AND status = 'concluido'
  `, clientId)?.count || 0;

  const lastService = queryOne<{ last_date: string }>(`
    SELECT MAX(date_time) as last_date
    FROM service_orders
    WHERE client_id = ? AND status = 'concluido'
  `, clientId);

  const guidesCount = queryOne<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM articles
    WHERE (client_id = ? OR client_id IS NULL)
      AND visible_in_portal = 1
  `, clientId)?.count || 0;

  res.json({
    client: {
      id: client.id,
      name: client.name,
      identification_name: client.identification_name,
      document: client.document,
      phone: client.phone,
      email: client.email,
      address: client.address
    },
    locations,
    stats: {
      total_equipments: eqCount,
      completed_services: servicesCount,
      last_service_date: lastService?.last_date || null,
      available_guides: guidesCount
    }
  });
});

/**
 * GET /api/portal/equipments
 * Lista os equipamentos instalados no condomínio
 * DTO Sanitizado: SEM IPs locais, SEM senhas, SEM portas, SEM notas internas
 */
portalRouter.get('/equipments', (req: AuthRequest, res: Response) => {
  const clientId = req.user!.client_id!;

  const equipments = queryAll(`
    SELECT 
      e.id, 
      e.name, 
      e.category, 
      e.manufacturer, 
      e.model, 
      e.physical_location, 
      e.photo_url,
      l.name as location_name
    FROM equipments e
    LEFT JOIN locations l ON e.location_id = l.id
    WHERE e.client_id = ?
    ORDER BY l.name ASC, e.name ASC
  `, clientId);

  res.json(equipments);
});

/**
 * GET /api/portal/service-orders
 * Retorna exclusivamente atendimentos técnicos finalizados (status = 'concluido')
 * DTO Sanitizado: SEM custos (service_cost), SEM tempo gasto, SEM notas internas
 */
portalRouter.get('/service-orders', (req: AuthRequest, res: Response) => {
  const clientId = req.user!.client_id!;

  const orders = queryAll(`
    SELECT 
      so.id, 
      so.date_time, 
      so.service_type, 
      so.problem_description, 
      so.changes_made, 
      so.test_results, 
      so.technician_name,
      l.name as location_name
    FROM service_orders so
    LEFT JOIN locations l ON so.location_id = l.id
    WHERE so.client_id = ? AND so.status = 'concluido'
    ORDER BY so.date_time DESC
  `, clientId);

  res.json(orders);
});

/**
 * GET /api/portal/articles
 * Lista guias operacionais e tutoriais autorizados para o cliente (visible_in_portal = 1)
 */
portalRouter.get('/articles', (req: AuthRequest, res: Response) => {
  const clientId = req.user!.client_id!;

  const articles = queryAll(`
    SELECT 
      id, 
      title, 
      body_md, 
      tags, 
      updated_at
    FROM articles
    WHERE (client_id = ? OR client_id IS NULL)
      AND visible_in_portal = 1
    ORDER BY title ASC
  `, clientId);

  res.json(articles);
});
