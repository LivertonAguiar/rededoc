import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { db, queryAll, queryOne, execute } from '../db/database.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from '../schemas/index.js';
import { hashSystemPassword } from '../services/crypto.js';

export const usersRouter = Router();

// Todas as rotas de gerenciamento de usuários exigem autenticação e papel 'admin'
usersRouter.use(requireAuth);
usersRouter.use(requireRole('admin'));

/**
 * GET /api/users
 * Lista todos os usuários do sistema e do portal com dados do cliente vinculado
 */
usersRouter.get('/', (req: AuthRequest, res: Response) => {
  const users = queryAll(`
    SELECT 
      u.id, 
      u.name, 
      u.email, 
      u.role, 
      u.client_id, 
      COALESCE(u.is_active, 1) as is_active, 
      u.created_at, 
      u.updated_at,
      c.name as client_name,
      c.identification_name as client_identification
    FROM users u
    LEFT JOIN clients c ON u.client_id = c.id
    ORDER BY u.role ASC, u.name ASC
  `);

  res.json(users);
});

/**
 * GET /api/users/:id
 * Retorna dados de um usuário específico
 */
usersRouter.get('/:id', (req: AuthRequest, res: Response): any => {
  const user = queryOne(`
    SELECT 
      u.id, 
      u.name, 
      u.email, 
      u.role, 
      u.client_id, 
      COALESCE(u.is_active, 1) as is_active, 
      u.created_at, 
      u.updated_at,
      c.name as client_name
    FROM users u
    LEFT JOIN clients c ON u.client_id = c.id
    WHERE u.id = ?
  `, req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  res.json(user);
});

/**
 * POST /api/users
 * Cria um novo usuário (admin, técnico ou cliente do portal)
 */
usersRouter.post('/', validateBody(createUserSchema), async (req: AuthRequest, res: Response): Promise<any> => {
  const { name, email, password, role, client_id, is_active } = req.body;

  const normalizedEmail = email.trim().toLowerCase();

  const existing = queryOne('SELECT id FROM users WHERE LOWER(email) = ?', normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
  }

  if (role === 'cliente') {
    if (!client_id) {
      return res.status(400).json({ error: 'O cliente vinculado é obrigatório para usuários com perfil de cliente.' });
    }
    const client = queryOne('SELECT id FROM clients WHERE id = ?', client_id);
    if (!client) {
      return res.status(404).json({ error: 'Condomínio/Cliente selecionado não existe.' });
    }
  }

  const id = 'usr_' + crypto.randomUUID().slice(0, 8);
  const passwordHash = await hashSystemPassword(password);
  const activeStatus = is_active !== undefined ? (is_active ? 1 : 0) : 1;

  execute(`
    INSERT INTO users (id, name, email, password_hash, role, client_id, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, id, name.trim(), normalizedEmail, passwordHash, role, role === 'cliente' ? client_id : (client_id || null), activeStatus);

  // Registro de auditoria
  try {
    const auditId = 'aud_' + crypto.randomUUID().slice(0, 8);
    execute(`
      INSERT INTO audit_history (id, client_id, user_name, action, entity_type, entity_name, field_name, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, auditId, client_id || 'system', req.user?.name || 'Administrador', 'Criou', 'user', name, 'role', role);
  } catch {}

  const created = queryOne(`
    SELECT u.id, u.name, u.email, u.role, u.client_id, COALESCE(u.is_active, 1) as is_active, u.created_at, u.updated_at, c.name as client_name
    FROM users u
    LEFT JOIN clients c ON u.client_id = c.id
    WHERE u.id = ?
  `, id);

  res.status(201).json(created);
});

/**
 * PUT /api/users/:id
 * Atualiza dados cadastrais do usuário
 */
usersRouter.put('/:id', validateBody(updateUserSchema), (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const { name, email, role, client_id, is_active } = req.body;

  const existing = queryOne('SELECT * FROM users WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  let normalizedEmail = existing.email;
  if (email && email.trim().toLowerCase() !== existing.email.toLowerCase()) {
    normalizedEmail = email.trim().toLowerCase();
    const emailConflict = queryOne('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', normalizedEmail, id);
    if (emailConflict) {
      return res.status(409).json({ error: 'Este e-mail já está sendo utilizado por outro usuário.' });
    }
  }

  const updatedRole = role || existing.role;
  let targetClientId = client_id !== undefined ? client_id : existing.client_id;

  if (updatedRole === 'cliente') {
    if (!targetClientId) {
      return res.status(400).json({ error: 'O cliente vinculado é obrigatório para usuários com perfil de cliente.' });
    }
    const client = queryOne('SELECT id FROM clients WHERE id = ?', targetClientId);
    if (!client) {
      return res.status(404).json({ error: 'Condomínio/Cliente selecionado não existe.' });
    }
  } else if (role && role !== 'cliente') {
    targetClientId = null;
  }

  const updatedActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

  execute(`
    UPDATE users
    SET name = ?, email = ?, role = ?, client_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, name ? name.trim() : existing.name, normalizedEmail, updatedRole, targetClientId, updatedActive, id);

  const updated = queryOne(`
    SELECT u.id, u.name, u.email, u.role, u.client_id, COALESCE(u.is_active, 1) as is_active, u.created_at, u.updated_at, c.name as client_name
    FROM users u
    LEFT JOIN clients c ON u.client_id = c.id
    WHERE u.id = ?
  `, id);

  res.json(updated);
});

/**
 * POST /api/users/:id/reset-password
 * Redefine a senha de um usuário
 */
usersRouter.post('/:id/reset-password', validateBody(resetPasswordSchema), async (req: AuthRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  const { password } = req.body;

  const existing = queryOne('SELECT id, name, client_id FROM users WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const passwordHash = await hashSystemPassword(password);
  execute('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', passwordHash, id);

  try {
    const auditId = 'aud_' + crypto.randomUUID().slice(0, 8);
    execute(`
      INSERT INTO audit_history (id, client_id, user_name, action, entity_type, entity_name, field_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, auditId, existing.client_id || 'system', req.user?.name || 'Administrador', 'Redefiniu senha', 'user', existing.name, 'password');
  } catch {}

  res.json({ success: true, message: 'Senha redefinida com sucesso.' });
});

/**
 * DELETE /api/users/:id
 * Remove um usuário do sistema
 */
usersRouter.delete('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;

  if (req.user?.id === id) {
    return res.status(400).json({ error: 'Não é permitido excluir sua própria conta enquanto conectado.' });
  }

  const existing = queryOne('SELECT id, name, client_id FROM users WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  execute('DELETE FROM users WHERE id = ?', id);

  try {
    const auditId = 'aud_' + crypto.randomUUID().slice(0, 8);
    execute(`
      INSERT INTO audit_history (id, client_id, user_name, action, entity_type, entity_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `, auditId, existing.client_id || 'system', req.user?.name || 'Administrador', 'Excluiu', 'user', existing.name);
  } catch {}

  res.json({ success: true, message: 'Usuário removido com sucesso.' });
});

