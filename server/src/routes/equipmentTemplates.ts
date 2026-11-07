import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { equipmentTemplateSchema } from '../schemas/index.js';

export const equipmentTemplatesRouter = Router();

// Todas as rotas de modelos exigem autenticação
equipmentTemplatesRouter.use(requireAuth);

/**
 * GET /api/equipment-templates
 * Lista modelos de equipamentos com filtro opcional por categoria
 */
equipmentTemplatesRouter.get('/', (req: Request, res: Response) => {
  const { category } = req.query;

  let query = 'SELECT * FROM equipment_templates WHERE 1=1';
  const params: any[] = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY category ASC, name ASC';
  const templates = queryAll(query, ...params);

  // Faz o parse do JSON dos campos para facilidade de consumo pelo frontend
  const parsed = templates.map(t => ({
    ...t,
    fields: typeof t.fields === 'string' ? JSON.parse(t.fields || '[]') : (t.fields || [])
  }));

  res.json(parsed);
});

/**
 * GET /api/equipment-templates/:id
 * Retorna um modelo específico com seus campos personalizados
 */
equipmentTemplatesRouter.get('/:id', (req: Request, res: Response): any => {
  const template = queryOne('SELECT * FROM equipment_templates WHERE id = ?', req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Modelo de equipamento não encontrado.' });
  }

  res.json({
    ...template,
    fields: typeof template.fields === 'string' ? JSON.parse(template.fields || '[]') : (template.fields || [])
  });
});

/**
 * POST /api/equipment-templates
 * Cria um novo modelo de campos personalizados para uma categoria (restrito a admin)
 */
equipmentTemplatesRouter.post(
  '/',
  requireRole('admin'),
  validateBody(equipmentTemplateSchema),
  (req: AuthRequest, res: Response): any => {
    const { category, name, fields } = req.body;

    const id = 'tmpl_' + crypto.randomUUID().slice(0, 8);
    const fieldsJson = JSON.stringify(fields || []);

    execute(`
      INSERT INTO equipment_templates (id, category, name, fields, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, id, category, name.trim(), fieldsJson);

    try {
      const auditId = 'aud_' + crypto.randomUUID().slice(0, 8);
      execute(`
        INSERT INTO audit_history (id, client_id, user_name, action, entity_type, entity_name, field_name, new_value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, auditId, 'system', req.user?.name || 'Administrador', 'Criou', 'equipment_template', name, 'fields_count', String(fields.length));
    } catch {}

    const created = queryOne('SELECT * FROM equipment_templates WHERE id = ?', id);
    res.status(201).json({
      ...created,
      fields: JSON.parse(created.fields || '[]')
    });
  }
);

/**
 * PUT /api/equipment-templates/:id
 * Atualiza um modelo existente (restrito a admin)
 */
equipmentTemplatesRouter.put(
  '/:id',
  requireRole('admin'),
  validateBody(equipmentTemplateSchema),
  (req: AuthRequest, res: Response): any => {
    const { id } = req.params;
    const { category, name, fields } = req.body;

    const existing = queryOne('SELECT id FROM equipment_templates WHERE id = ?', id);
    if (!existing) {
      return res.status(404).json({ error: 'Modelo de equipamento não encontrado.' });
    }

    const fieldsJson = JSON.stringify(fields || []);

    execute(`
      UPDATE equipment_templates
      SET category = ?, name = ?, fields = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, category, name.trim(), fieldsJson, id);

    try {
      const auditId = 'aud_' + crypto.randomUUID().slice(0, 8);
      execute(`
        INSERT INTO audit_history (id, client_id, user_name, action, entity_type, entity_name, field_name, new_value)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, auditId, 'system', req.user?.name || 'Administrador', 'Atualizou', 'equipment_template', name, 'fields_count', String(fields.length));
    } catch {}

    const updated = queryOne('SELECT * FROM equipment_templates WHERE id = ?', id);
    res.json({
      ...updated,
      fields: JSON.parse(updated.fields || '[]')
    });
  }
);

/**
 * DELETE /api/equipment-templates/:id
 * Remove um modelo de equipamento (restrito a admin)
 */
equipmentTemplatesRouter.delete(
  '/:id',
  requireRole('admin'),
  (req: AuthRequest, res: Response): any => {
    const { id } = req.params;

    const existing = queryOne('SELECT id, name FROM equipment_templates WHERE id = ?', id);
    if (!existing) {
      return res.status(404).json({ error: 'Modelo de equipamento não encontrado.' });
    }

    execute('DELETE FROM equipment_templates WHERE id = ?', id);

    try {
      const auditId = 'aud_' + crypto.randomUUID().slice(0, 8);
      execute(`
        INSERT INTO audit_history (id, client_id, user_name, action, entity_type, entity_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `, auditId, 'system', req.user?.name || 'Administrador', 'Excluiu', 'equipment_template', existing.name);
    } catch {}

    res.json({ success: true, message: 'Modelo de equipamento removido com sucesso.' });
  }
);

