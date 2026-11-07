import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { validateBody } from '../middleware/validate.js';
import { articleSchema } from '../schemas/index.js';
import { AuthRequest } from '../middleware/auth.js';

export const articlesRouter = Router();

/**
 * GET /api/articles
 * Lista artigos com filtros por clientId, tag e termo de busca (q)
 */
articlesRouter.get('/', (req: AuthRequest, res: Response) => {
  const { clientId, tag, q } = req.query;
  let sql = `
    SELECT a.*, c.name as client_name
    FROM articles a
    LEFT JOIN clients c ON c.id = a.client_id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Se clientId foi passado, busca artigos específicos do cliente + artigos globais (client_id IS NULL)
  if (clientId) {
    sql += ' AND (a.client_id = ? OR a.client_id IS NULL)';
    params.push(clientId);
  }

  if (tag && typeof tag === 'string') {
    sql += ' AND a.tags LIKE ?';
    params.push(`%${tag}%`);
  }

  if (q && typeof q === 'string' && q.trim()) {
    sql += ' AND (a.title LIKE ? OR a.body_md LIKE ? OR a.tags LIKE ?)';
    const term = `%${q.trim()}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY a.updated_at DESC';
  const articles = queryAll(sql, ...params);
  res.json(articles);
});

/**
 * GET /api/articles/:id
 * Retorna os detalhes de um artigo específico
 */
articlesRouter.get('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const article = queryOne<any>(`
    SELECT a.*, c.name as client_name
    FROM articles a
    LEFT JOIN clients c ON c.id = a.client_id
    WHERE a.id = ?
  `, id);

  if (!article) {
    return res.status(404).json({ error: 'Procedimento / Artigo não encontrado.' });
  }

  res.json(article);
});

/**
 * POST /api/articles
 * Cria um novo artigo e registra a versão 1
 */
articlesRouter.post('/', validateBody(articleSchema), (req: AuthRequest, res: Response): any => {
  const { client_id, title, body_md, tags, visible_in_portal } = req.body;
  const userName = req.user?.name || 'Técnico';
  const id = 'art_' + crypto.randomUUID().slice(0, 8);
  const portalFlag = visible_in_portal ? 1 : 0;

  execute(`
    INSERT INTO articles (
      id, client_id, title, body_md, tags, visible_in_portal,
      version, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `, id, client_id || null, title.trim(), body_md, tags || null, portalFlag, userName, userName);

  // Grava versão inicial (versão 1)
  execute(`
    INSERT INTO article_versions (id, article_id, version, title, body_md, changed_by)
    VALUES (?, ?, 1, ?, ?, ?)
  `, 'ver_' + crypto.randomUUID().slice(0, 8), id, title.trim(), body_md, userName);

  // Registro em audit_history
  try {
    execute(`
      INSERT INTO audit_history (
        id, client_id, user_name, action, entity_type, entity_name, field_name, new_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      'aud_' + crypto.randomUUID().slice(0, 8),
      client_id || null,
      userName,
      'create',
      'article',
      title.trim(),
      'Artigo',
      `Criado procedimento versão 1: ${title.trim()}`
    );
  } catch {}

  const created = queryOne('SELECT * FROM articles WHERE id = ?', id);
  res.status(201).json(created);
});

/**
 * PUT /api/articles/:id
 * Atualiza um artigo, incrementando a versão e registrando o histórico anterior
 */
articlesRouter.put('/:id', validateBody(articleSchema), (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const { client_id, title, body_md, tags, visible_in_portal } = req.body;
  const userName = req.user?.name || 'Técnico';

  const current = queryOne<any>('SELECT * FROM articles WHERE id = ?', id);
  if (!current) {
    return res.status(404).json({ error: 'Artigo não encontrado para atualização.' });
  }

  const nextVersion = (current.version || 1) + 1;
  const portalFlag = visible_in_portal ? 1 : 0;

  // Grava a nova versão no histórico
  execute(`
    INSERT INTO article_versions (id, article_id, version, title, body_md, changed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `, 'ver_' + crypto.randomUUID().slice(0, 8), id, nextVersion, title.trim(), body_md, userName);

  // Atualiza o artigo principal
  execute(`
    UPDATE articles
    SET client_id = ?,
        title = ?,
        body_md = ?,
        tags = ?,
        visible_in_portal = ?,
        version = ?,
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, client_id || null, title.trim(), body_md, tags || null, portalFlag, nextVersion, userName, id);

  // Auditoria
  try {
    execute(`
      INSERT INTO audit_history (
        id, client_id, user_name, action, entity_type, entity_name, field_name, old_value, new_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      'aud_' + crypto.randomUUID().slice(0, 8),
      client_id || current.client_id || null,
      userName,
      'update',
      'article',
      title.trim(),
      'version',
      `v${current.version}`,
      `v${nextVersion}`
    );
  } catch {}

  const updated = queryOne('SELECT * FROM articles WHERE id = ?', id);
  res.json(updated);
});

/**
 * DELETE /api/articles/:id
 * Remove um artigo e limpa seus vínculos
 */
articlesRouter.delete('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const current = queryOne<any>('SELECT * FROM articles WHERE id = ?', id);
  if (!current) {
    return res.status(404).json({ error: 'Artigo não encontrado.' });
  }

  // Remove vínculos manuais relacionados
  execute(`
    DELETE FROM entity_links
    WHERE (source_type = 'article' AND source_id = ?)
       OR (target_type = 'article' AND target_id = ?)
  `, id, id);

  // Deleta o artigo (o CASCADE do banco remove as article_versions)
  execute('DELETE FROM articles WHERE id = ?', id);

  // Auditoria
  try {
    execute(`
      INSERT INTO audit_history (
        id, client_id, user_name, action, entity_type, entity_name, field_name, old_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      'aud_' + crypto.randomUUID().slice(0, 8),
      current.client_id || null,
      req.user?.name || 'Técnico',
      'delete',
      'article',
      current.title,
      'Artigo',
      `Excluído procedimento: ${current.title}`
    );
  } catch {}

  res.json({ message: 'Procedimento excluído com sucesso.' });
});

/**
 * GET /api/articles/:id/versions
 * Lista todas as versões salvas de um artigo
 */
articlesRouter.get('/:id/versions', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const versions = queryAll('SELECT * FROM article_versions WHERE article_id = ? ORDER BY version DESC', id);
  res.json(versions);
});

/**
 * POST /api/articles/:id/restore/:version
 * Restaura uma versão anterior de um artigo
 */
articlesRouter.post('/:id/restore/:version', (req: AuthRequest, res: Response): any => {
  const { id, version } = req.params;
  const userName = req.user?.name || 'Técnico';

  const current = queryOne<any>('SELECT * FROM articles WHERE id = ?', id);
  if (!current) {
    return res.status(404).json({ error: 'Artigo não encontrado.' });
  }

  const targetVer = queryOne<any>('SELECT * FROM article_versions WHERE article_id = ? AND version = ?', id, version);
  if (!targetVer) {
    return res.status(404).json({ error: `Versão ${version} não encontrada para este artigo.` });
  }

  const nextVersion = (current.version || 1) + 1;

  // Grava nova versão com o conteúdo restaurado
  execute(`
    INSERT INTO article_versions (id, article_id, version, title, body_md, changed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `, 'ver_' + crypto.randomUUID().slice(0, 8), id, nextVersion, targetVer.title, targetVer.body_md, `${userName} (Restaurado de v${version})`);

  execute(`
    UPDATE articles
    SET title = ?,
        body_md = ?,
        version = ?,
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, targetVer.title, targetVer.body_md, nextVersion, userName, id);

  // Auditoria
  try {
    execute(`
      INSERT INTO audit_history (
        id, client_id, user_name, action, entity_type, entity_name, field_name, old_value, new_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      'aud_' + crypto.randomUUID().slice(0, 8),
      current.client_id || null,
      userName,
      'restore',
      'article',
      targetVer.title,
      'version',
      `v${current.version}`,
      `v${nextVersion} (Restaurado da v${version})`
    );
  } catch {}

  const restored = queryOne('SELECT * FROM articles WHERE id = ?', id);
  res.json(restored);
});
