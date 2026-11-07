import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { encryptCredential, decryptCredential } from '../services/crypto.js';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { vaultLimiter } from '../middleware/rateLimiter.js';

export const credentialsRouter = Router();

// Cofre de senhas requer autenticação obrigatória
credentialsRouter.use(requireAuth);

credentialsRouter.get('/', (req: Request, res: Response) => {
  const { clientId, equipmentId } = req.query;
  let query = `
    SELECT 
      cred.id, cred.client_id, cred.equipment_id, cred.name, cred.category,
      cred.username, cred.access_url, cred.port, cred.notes, cred.last_changed_at,
      cred.rotation_days, cred.expires_at,
      cred.created_at, cred.updated_at,
      e.name AS equipment_name, e.model AS equipment_model,
      c.name AS client_name,
      '••••••••' AS masked_password
    FROM credentials cred
    LEFT JOIN equipments e ON e.id = cred.equipment_id
    JOIN clients c ON c.id = cred.client_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (clientId) {
    query += ' AND cred.client_id = ?';
    params.push(clientId);
  }
  if (equipmentId) {
    query += ' AND cred.equipment_id = ?';
    params.push(equipmentId);
  }

  query += ' ORDER BY cred.name ASC';
  const credentials = queryAll(query, ...params);
  res.json(credentials);
});

credentialsRouter.get('/:id', (req: Request, res: Response): any => {
  const credential = queryOne(`
    SELECT 
      cred.id, cred.client_id, cred.equipment_id, cred.name, cred.category,
      cred.username, cred.access_url, cred.port, cred.notes, cred.last_changed_at,
      cred.rotation_days, cred.expires_at,
      cred.created_at, cred.updated_at,
      e.name AS equipment_name, e.model AS equipment_model,
      c.name AS client_name,
      '••••••••' AS masked_password
    FROM credentials cred
    LEFT JOIN equipments e ON e.id = cred.equipment_id
    JOIN clients c ON c.id = cred.client_id
    WHERE cred.id = ?
  `, req.params.id);

  if (!credential) {
    return res.status(404).json({ error: 'Credencial não encontrada.' });
  }
  res.json(credential);
});

credentialsRouter.post('/', (req: AuthRequest, res: Response): any => {
  const { client_id, equipment_id, name, category, username, password, access_url, port, notes, rotation_days, expires_at } = req.body;
  if (!client_id || !name || !username || !password) {
    return res.status(400).json({ error: 'Cliente, Nome, Usuário e Senha são obrigatórios.' });
  }

  const { encryptedPassword, iv, authTag } = encryptCredential(password);
  const id = 'cred_' + crypto.randomUUID().slice(0, 8);

  execute(`
    INSERT INTO credentials (
      id, client_id, equipment_id, name, category, username,
      encrypted_password, iv, auth_tag, access_url, port, notes,
      rotation_days, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    id, client_id, equipment_id || null, name, category || 'equipamento', username,
    encryptedPassword, iv, authTag, access_url || null, port ? Number(port) : null, notes || null,
    rotation_days ? Number(rotation_days) : 90, expires_at || null
  );

  execute(`
    INSERT INTO credential_audit_logs (id, credential_id, user_id, user_name, action, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `, 'cal_' + crypto.randomUUID().slice(0, 8), id, req.user?.id || null, req.user?.name || 'Técnico', 'create', req.ip || null);

  const created = queryOne(`
    SELECT id, client_id, equipment_id, name, category, username, access_url, port, notes, rotation_days, expires_at, '••••••••' AS masked_password
    FROM credentials WHERE id = ?
  `, id);

  res.status(201).json(created);
});

credentialsRouter.post('/:id/reveal', vaultLimiter, (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const credential = queryOne('SELECT * FROM credentials WHERE id = ?', id);
  if (!credential) {
    return res.status(404).json({ error: 'Credencial não encontrada.' });
  }

  try {
    const plainPassword = decryptCredential(credential.encrypted_password, credential.iv, credential.auth_tag);

    execute(`
      INSERT INTO credential_audit_logs (id, credential_id, user_id, user_name, action, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      'cal_' + crypto.randomUUID().slice(0, 8),
      id,
      req.user?.id || 'usr_technician',
      req.user?.name || 'Liverton Aguiar',
      'reveal',
      req.ip || '127.0.0.1',
      req.headers['user-agent'] || null
    );

    return res.json({
      id: credential.id,
      name: credential.name,
      username: credential.username,
      password: plainPassword,
      revealed_at: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Falha na descriptografia da credencial:', err);
    return res.status(500).json({ error: 'Falha ao descriptografar credencial. Chave mestre inválida ou dado corrompido.' });
  }
});

credentialsRouter.get('/:id/audit', (req: Request, res: Response) => {
  const { id } = req.params;
  const logs = queryAll(`
    SELECT * FROM credential_audit_logs
    WHERE credential_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `, id);

  res.json(logs);
});

credentialsRouter.put('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM credentials WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Credencial não encontrada.' });
  }

  const { equipment_id, name, category, username, password, access_url, port, notes, rotation_days, expires_at } = req.body;

  let encPass = existing.encrypted_password;
  let iv = existing.iv;
  let authTag = existing.auth_tag;
  let lastChanged = existing.last_changed_at;

  if (password && password.trim() !== '') {
    const enc = encryptCredential(password);
    encPass = enc.encryptedPassword;
    iv = enc.iv;
    authTag = enc.authTag;
    lastChanged = new Date().toISOString();
  }

  execute(`
    UPDATE credentials SET
      equipment_id = ?, name = ?, category = ?, username = ?,
      encrypted_password = ?, iv = ?, auth_tag = ?, access_url = ?, port = ?, notes = ?,
      rotation_days = ?, expires_at = ?,
      last_changed_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    equipment_id || null, name, category || 'equipamento', username,
    encPass, iv, authTag, access_url || null, port ? Number(port) : null, notes || null,
    rotation_days !== undefined ? (rotation_days ? Number(rotation_days) : null) : existing.rotation_days,
    expires_at !== undefined ? (expires_at || null) : existing.expires_at,
    lastChanged, id
  );

  execute(`
    INSERT INTO credential_audit_logs (id, credential_id, user_id, user_name, action, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `, 'cal_' + crypto.randomUUID().slice(0, 8), id, req.user?.id || null, req.user?.name || 'Técnico', 'update', req.ip || null);

  const updated = queryOne(`
    SELECT id, client_id, equipment_id, name, category, username, access_url, port, notes, '••••••••' AS masked_password
    FROM credentials WHERE id = ?
  `, id);

  res.json(updated);
});

credentialsRouter.delete('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM credentials WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Credencial não encontrada.' });
  }

  execute('DELETE FROM credentials WHERE id = ?', id);

  res.json({ message: 'Credencial removida do cofre com sucesso.' });
});
