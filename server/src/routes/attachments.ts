import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { queryAll, queryOne, execute } from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = crypto.randomUUID().slice(0, 8) + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }
});

export const attachmentsRouter = Router();

attachmentsRouter.get('/', (req: Request, res: Response) => {
  const { clientId, locationId, equipmentId, serviceOrderId } = req.query;
  let query = `
    SELECT a.*, c.name as client_name, e.name as equipment_name
    FROM attachments a
    JOIN clients c ON c.id = a.client_id
    LEFT JOIN equipments e ON e.id = a.equipment_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (clientId) {
    query += ' AND a.client_id = ?';
    params.push(clientId);
  }
  if (locationId) {
    query += ' AND a.location_id = ?';
    params.push(locationId);
  }
  if (equipmentId) {
    query += ' AND a.equipment_id = ?';
    params.push(equipmentId);
  }
  if (serviceOrderId) {
    query += ' AND a.service_order_id = ?';
    params.push(serviceOrderId);
  }

  query += ' ORDER BY a.created_at DESC';
  const items = queryAll(query, ...params);
  res.json(items);
});

attachmentsRouter.post('/', upload.single('file'), (req: Request, res: Response): any => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  const { client_id, location_id, equipment_id, service_order_id, category, notes } = req.body;
  if (!client_id) {
    return res.status(400).json({ error: 'client_id é obrigatório.' });
  }

  const id = 'att_' + crypto.randomUUID().slice(0, 8);
  const relativePath = path.relative(path.resolve(__dirname, '../../..'), req.file.path).replace(/\\/g, '/');

  execute(`
    INSERT INTO attachments (
      id, client_id, location_id, equipment_id, service_order_id,
      file_name, original_name, mime_type, file_size, file_path, category, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    id, client_id, location_id || null, equipment_id || null, service_order_id || null,
    req.file.filename, req.file.originalname, req.file.mimetype, req.file.size,
    relativePath, category || 'documento', notes || null
  );

  const created = queryOne('SELECT * FROM attachments WHERE id = ?', id);
  res.status(201).json(created);
});

attachmentsRouter.get('/:id/download', (req: Request, res: Response): any => {
  const { id } = req.params;
  const attachment = queryOne('SELECT * FROM attachments WHERE id = ?', id);
  if (!attachment) {
    return res.status(404).json({ error: 'Arquivo não encontrado.' });
  }

  const fullPath = path.resolve(__dirname, '../../..', attachment.file_path);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado no disco do servidor.' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_name}"`);
  res.setHeader('Content-Type', attachment.mime_type);
  const fileStream = fs.createReadStream(fullPath);
  fileStream.pipe(res);
});

attachmentsRouter.delete('/:id', (req: Request, res: Response): any => {
  const { id } = req.params;
  const attachment = queryOne('SELECT * FROM attachments WHERE id = ?', id);
  if (!attachment) {
    return res.status(404).json({ error: 'Anexo não encontrado.' });
  }

  const fullPath = path.resolve(__dirname, '../../..', attachment.file_path);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (e) {
      console.warn('Erro ao deletar arquivo físico:', e);
    }
  }

  execute('DELETE FROM attachments WHERE id = ?', id);
  res.json({ message: 'Anexo excluído com sucesso.' });
});
