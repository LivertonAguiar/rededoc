import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { AuthRequest, requireRole } from '../middleware/auth.js';
import { queryAll, queryOne, execute } from '../db/database.js';
import { testWebhook, checkAndDispatchAlerts } from '../services/notificationService.js';

export const notificationsRouter = Router();

// Todas as rotas de configuração de alerta são restritas a administradores
notificationsRouter.use(requireRole('admin'));

/**
 * GET /api/notifications/settings
 * Lista configurações de canais de notificação
 */
notificationsRouter.get('/settings', (req: AuthRequest, res: Response) => {
  const settings = queryAll('SELECT * FROM notification_settings ORDER BY created_at ASC');
  res.json(settings);
});

/**
 * POST /api/notifications/settings
 * Cria ou atualiza canal de notificação
 */
notificationsRouter.post('/settings', (req: AuthRequest, res: Response): any => {
  const { id, channel, target_url, advance_days, is_active } = req.body;

  if (id) {
    execute(`
      UPDATE notification_settings
      SET channel = ?, target_url = ?, advance_days = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, channel || 'webhook', target_url || null, advance_days || '30,7,0', is_active ?? 1, id);

    const updated = queryOne('SELECT * FROM notification_settings WHERE id = ?', id);
    return res.json(updated);
  } else {
    const newId = 'nst_' + crypto.randomUUID().slice(0, 8);
    execute(`
      INSERT INTO notification_settings (id, channel, target_url, advance_days, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, newId, channel || 'webhook', target_url || null, advance_days || '30,7,0', is_active ?? 1);

    const created = queryOne('SELECT * FROM notification_settings WHERE id = ?', newId);
    return res.status(201).json(created);
  }
});

/**
 * POST /api/notifications/test
 * Dispara notificação de teste para a URL informada
 */
notificationsRouter.post('/test', async (req: AuthRequest, res: Response): Promise<any> => {
  const { target_url } = req.body;
  if (!target_url) {
    return res.status(400).json({ error: 'URL do Webhook é obrigatória para teste.' });
  }

  try {
    const result = await testWebhook(target_url);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Falha ao enviar webhook de teste.' });
  }
});

/**
 * POST /api/notifications/dispatch-now
 * Executa imediatamente o ciclo de verificação de alertas
 */
notificationsRouter.post('/dispatch-now', async (req: AuthRequest, res: Response) => {
  try {
    const result = await checkAndDispatchAlerts();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Falha ao processar alertas: ' + err.message });
  }
});

/**
 * GET /api/notifications/logs
 * Retorna o histórico de alertas e notificações
 */
notificationsRouter.get('/logs', (req: AuthRequest, res: Response) => {
  const logs = queryAll('SELECT * FROM notification_log ORDER BY created_at DESC LIMIT 100');
  res.json(logs);
});
