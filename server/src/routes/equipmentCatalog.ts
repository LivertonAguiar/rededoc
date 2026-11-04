import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';

export const equipmentCatalogRouter = Router();

// Listar catálogo de equipamentos com filtros
equipmentCatalogRouter.get('/', (req: Request, res: Response) => {
  const { category, q } = req.query;
  let query = 'SELECT * FROM equipment_catalog WHERE 1=1';
  const params: any[] = [];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  if (q && typeof q === 'string' && q.trim() !== '') {
    query += ' AND (name LIKE ? OR manufacturer LIKE ? OR model LIKE ? OR notes LIKE ?)';
    const term = `%${q.trim()}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY manufacturer ASC, name ASC';
  const items = queryAll(query, ...params);

  // Faz parse do default_ports se for JSON string
  const parsed = items.map((item: any) => {
    let ports = [];
    try {
      if (item.default_ports) {
        ports = typeof item.default_ports === 'string' ? JSON.parse(item.default_ports) : item.default_ports;
      }
    } catch {
      ports = [];
    }
    return { ...item, default_ports: ports };
  });

  res.json(parsed);
});

// Buscar item do catálogo por ID
equipmentCatalogRouter.get('/:id', (req: Request, res: Response): any => {
  const item = queryOne('SELECT * FROM equipment_catalog WHERE id = ?', req.params.id) as any;
  if (!item) {
    return res.status(404).json({ error: 'Item do catálogo não encontrado.' });
  }

  let ports = [];
  try {
    if (item.default_ports) {
      ports = typeof item.default_ports === 'string' ? JSON.parse(item.default_ports) : item.default_ports;
    }
  } catch {
    ports = [];
  }

  res.json({ ...item, default_ports: ports });
});

// Cadastrar novo modelo no catálogo
equipmentCatalogRouter.post('/', (req: Request, res: Response): any => {
  const {
    name,
    category,
    manufacturer,
    model,
    default_management_port = 80,
    default_protocol = 'http',
    default_username = 'admin',
    default_config_path,
    default_ports = [],
    photo_url,
    notes
  } = req.body;

  if (!name || !category || !manufacturer || !model) {
    return res.status(400).json({ error: 'Campos name, category, manufacturer e model são obrigatórios.' });
  }

  const id = `cat_${crypto.randomUUID().slice(0, 8)}`;
  const portsJson = typeof default_ports === 'string' ? default_ports : JSON.stringify(default_ports);

  execute(`
    INSERT INTO equipment_catalog (
      id, name, category, manufacturer, model, default_management_port,
      default_protocol, default_username, default_config_path, default_ports,
      photo_url, notes, is_builtin
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `,
    id, name, category, manufacturer, model, Number(default_management_port) || 80,
    default_protocol, default_username, default_config_path || null, portsJson,
    photo_url || null, notes || null
  );

  const created = queryOne('SELECT * FROM equipment_catalog WHERE id = ?', id);
  res.status(201).json(created);
});

// Atualizar modelo no catálogo
equipmentCatalogRouter.put('/:id', (req: Request, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM equipment_catalog WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Modelo do catálogo não encontrado.' });
  }

  const {
    name,
    category,
    manufacturer,
    model,
    default_management_port,
    default_protocol,
    default_username,
    default_config_path,
    default_ports,
    photo_url,
    notes
  } = req.body;

  const portsJson = default_ports ? (typeof default_ports === 'string' ? default_ports : JSON.stringify(default_ports)) : null;

  execute(`
    UPDATE equipment_catalog SET
      name = COALESCE(?, name),
      category = COALESCE(?, category),
      manufacturer = COALESCE(?, manufacturer),
      model = COALESCE(?, model),
      default_management_port = COALESCE(?, default_management_port),
      default_protocol = COALESCE(?, default_protocol),
      default_username = COALESCE(?, default_username),
      default_config_path = COALESCE(?, default_config_path),
      default_ports = COALESCE(?, default_ports),
      photo_url = COALESCE(?, photo_url),
      notes = COALESCE(?, notes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    name, category, manufacturer, model,
    default_management_port !== undefined ? Number(default_management_port) : null,
    default_protocol, default_username, default_config_path, portsJson,
    photo_url, notes, id
  );

  const updated = queryOne('SELECT * FROM equipment_catalog WHERE id = ?', id);
  res.json(updated);
});

// Excluir modelo do catálogo
equipmentCatalogRouter.delete('/:id', (req: Request, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM equipment_catalog WHERE id = ?', id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Modelo do catálogo não encontrado.' });
  }

  execute('DELETE FROM equipment_catalog WHERE id = ?', id);
  res.json({ message: 'Modelo removido com sucesso do catálogo.' });
});

