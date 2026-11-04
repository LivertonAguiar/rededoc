import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { searchImagesOnline, downloadAndSaveImage } from '../services/imageSearch.js';
import { processAndOptimizeImage, removeWhiteBackground } from '../services/imageProcessor.js';
import { execute, queryOne, queryAll } from '../db/database.js';

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
    const ext = path.extname(file.originalname) || '.jpg';
    const safeName = `photo_${crypto.randomUUID().slice(0, 8)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos.'));
    }
  }
});

export const imagesRouter = Router();

// 1. Busca inteligente de imagens na internet
imagesRouter.get('/search', async (req: Request, res: Response): Promise<any> => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json({ error: 'Parâmetro de busca (q) é obrigatório.' });
  }

  try {
    const images = await searchImagesOnline(q);
    res.json({ query: q, count: images.length, results: images });
  } catch (err: any) {
    console.error('Erro na busca de imagens:', err);
    res.status(500).json({ error: 'Erro ao buscar imagens na internet: ' + err.message });
  }
});

// 2. Baixar imagem externa para o servidor local e associar
imagesRouter.post('/fetch-and-save', async (req: Request, res: Response): Promise<any> => {
  const { imageUrl, fallbackUrl, equipmentId, serviceOrderId, clientId } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl é obrigatório.' });
  }

  try {
    const prefix = equipmentId ? 'eq_photo' : serviceOrderId ? 'service_photo' : 'img';
    const localUrl = await downloadAndSaveImage(imageUrl, prefix, fallbackUrl);

    // Se fornecido equipmentId, atualiza a foto do equipamento
    if (equipmentId) {
      execute('UPDATE equipments SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', localUrl, equipmentId);
    }

    // Se fornecido serviceOrderId e clientId, anexa aos anexos do atendimento
    if (serviceOrderId && clientId) {
      const attId = 'att_' + crypto.randomUUID().slice(0, 8);
      execute(`
        INSERT INTO attachments (
          id, client_id, equipment_id, service_order_id,
          file_name, original_name, mime_type, file_size, file_path, category, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        attId, clientId, equipmentId || null, serviceOrderId,
        path.basename(localUrl), 'Foto do Atendimento', 'image/jpeg', 102400,
        localUrl.replace(/^\//, ''), 'foto', 'Foto adquirida da web'
      );
    }

    res.json({
      success: true,
      localUrl,
      message: 'Imagem baixada e armazenada com sucesso no servidor.'
    });
  } catch (err: any) {
    console.error('Erro ao baixar imagem:', err);
    res.status(500).json({ error: 'Erro ao baixar e salvar imagem: ' + err.message });
  }
});

// 3. Upload direto de foto local (câmera / arquivo)
imagesRouter.post('/upload', upload.single('photo'), async (req: Request, res: Response): Promise<any> => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma foto enviada.' });
  }

  const { equipmentId, serviceOrderId, clientId, removeBg } = req.body;
  let finalFilename = req.file.filename;
  let localUrl = `/uploads/${finalFilename}`;

  // Se o técnico solicitou remoção de fundo ou se for equipamento, otimiza
  if (removeBg === 'true' || equipmentId) {
    try {
      const sourceBuffer = fs.readFileSync(req.file.path);
      const optimizedBuffer = await processAndOptimizeImage(sourceBuffer, {
        removeBackground: removeBg === 'true'
      });
      const optFilename = `opt_${crypto.randomUUID().slice(0, 8)}.png`;
      const optPath = path.join(uploadDir, optFilename);
      fs.writeFileSync(optPath, optimizedBuffer);
      finalFilename = optFilename;
      localUrl = `/uploads/${optFilename}`;
    } catch (optErr) {
      console.warn('Aviso: Otimização no upload falhou, mantendo original:', optErr);
    }
  }

  if (equipmentId) {
    execute('UPDATE equipments SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', localUrl, equipmentId);
  }

  if (serviceOrderId && clientId) {
    const attId = 'att_' + crypto.randomUUID().slice(0, 8);
    execute(`
      INSERT INTO attachments (
        id, client_id, equipment_id, service_order_id,
        file_name, original_name, mime_type, file_size, file_path, category, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      attId, clientId, equipmentId || null, serviceOrderId,
      finalFilename, req.file.originalname, 'image/png', req.file.size,
      `uploads/${finalFilename}`, 'foto', 'Foto enviada pelo técnico'
    );
  }

  res.json({
    success: true,
    localUrl,
    filename: finalFilename,
    message: 'Foto enviada e ajustada com sucesso.'
  });
});

// 4. Remover fundo branco de imagem já salva sob demanda
imagesRouter.post('/remove-background', async (req: Request, res: Response): Promise<any> => {
  const { imageUrl, equipmentId } = req.body;
  if (!imageUrl) {
    return res.status(400).json({ error: 'imageUrl é obrigatório.' });
  }

  try {
    const filename = path.basename(imageUrl);
    const sourcePath = path.join(uploadDir, filename);

    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Arquivo de imagem não encontrado no servidor.' });
    }

    const inputBuffer = fs.readFileSync(sourcePath);
    const processedBuffer = await removeWhiteBackground(inputBuffer, 28);

    const newFilename = `nobg_${crypto.randomUUID().slice(0, 8)}.png`;
    const newPath = path.join(uploadDir, newFilename);
    fs.writeFileSync(newPath, processedBuffer);

    const newUrl = `/uploads/${newFilename}`;

    if (equipmentId) {
      execute('UPDATE equipments SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newUrl, equipmentId);
    }

    res.json({
      success: true,
      localUrl: newUrl,
      message: 'Fundo da imagem removido com sucesso e proporção preservada.'
    });
  } catch (err: any) {
    console.error('Erro ao remover fundo:', err);
    res.status(500).json({ error: 'Falha ao processar remoção de fundo: ' + err.message });
  }
});

// 5. Otimizar e recortar todas as fotos atuais dos equipamentos
imagesRouter.post('/optimize-all', async (req: Request, res: Response): Promise<any> => {
  try {
    const equipments = queryAll('SELECT id, photo_url FROM equipments WHERE photo_url IS NOT NULL');
    const updated: any[] = [];

    for (const eq of equipments) {
      if (!eq.photo_url) continue;
      const filename = path.basename(eq.photo_url);
      const sourcePath = path.join(uploadDir, filename);
      if (fs.existsSync(sourcePath)) {
        try {
          const inputBuffer = fs.readFileSync(sourcePath);
          const processedBuffer = await removeWhiteBackground(inputBuffer, 28);
          const newFilename = `nobg_${crypto.randomUUID().slice(0, 8)}.png`;
          const newPath = path.join(uploadDir, newFilename);
          fs.writeFileSync(newPath, processedBuffer);
          const newUrl = `/uploads/${newFilename}`;
          execute('UPDATE equipments SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newUrl, eq.id);
          updated.push({ id: eq.id, old: eq.photo_url, new: newUrl });
        } catch (e: any) {
          console.warn('Falha ao processar eq', eq.id, e.message);
        }
      }
    }

    res.json({ success: true, count: updated.length, updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

