import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

import { initDatabase } from './db/database.js';
import { requireAuth, requireRole, requireInternalRole, getJwtSecret } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { clientsRouter } from './routes/clients.js';
import { locationsRouter } from './routes/locations.js';
import { equipmentsRouter } from './routes/equipments.js';
import { portForwardsRouter } from './routes/portForwards.js';
import { credentialsRouter } from './routes/credentials.js';
import { serviceOrdersRouter } from './routes/serviceOrders.js';
import { topologyRouter } from './routes/topology.js';
import { auditHistoryRouter } from './routes/auditHistory.js';
import { attachmentsRouter } from './routes/attachments.js';
import { dashboardRouter } from './routes/dashboard.js';
import { reportsRouter } from './routes/reports.js';
import { backupRouter } from './routes/backup.js';
import { equipmentCatalogRouter } from './routes/equipmentCatalog.js';
import { imagesRouter } from './routes/images.js';
import { linksRouter } from './routes/links.js';
import { articlesRouter } from './routes/articles.js';
import { expirationsRouter } from './routes/expirations.js';
import { notificationsRouter } from './routes/notifications.js';
import { domainsRouter } from './routes/domains.js';
import { searchRouter } from './routes/search.js';
import { favoritesRouter } from './routes/favorites.js';
import { subnetsRouter } from './routes/subnets.js';
import { portalRouter } from './routes/portal.js';
import { usersRouter } from './routes/users.js';
import { equipmentTemplatesRouter } from './routes/equipmentTemplates.js';
import { initSearchIndex } from './services/searchService.js';
import { startNotificationScheduler } from './services/notificationService.js';

dotenv.config();

// Validação mandatória de segredos em ambiente de produção
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    console.error('ERRO FATAL: Variável de ambiente JWT_SECRET é obrigatória em produção.');
    process.exit(1);
  }
  if (!process.env.VAULT_SECRET_KEY) {
    console.error('ERRO FATAL: Variável de ambiente VAULT_SECRET_KEY é obrigatória em produção.');
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Inicializa banco de dados SQLite e índice de busca global FTS5
initDatabase();
initSearchIndex();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Servir arquivos de uploads com proteção para anexos confidenciais
const uploadsPath = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

app.use('/uploads', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const isPublicImage = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico'].includes(ext);

  // Fotos de catálogo e fotos de equipamentos são públicas
  if (isPublicImage && !req.path.startsWith('/attachments/')) {
    return next();
  }

  // Anexos de configuração (.bin, .conf, .pdf, etc.) exigem autenticação
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.split(' ')[1]
    : (req.query.token as string);

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado ao anexo.' });
  }

  try {
    jwt.verify(token, getJwtSecret());
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}, express.static(uploadsPath));

// Rotas públicas da API REST
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'ITFY API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Download direto do aplicativo Android nativo (APK) com nome e versão amigáveis
app.get(['/api/download/apk', '/download/apk'], (req, res) => {
  const currentVersion = '1.0.1';
  const apkFileName = `ITFY-v${currentVersion}.apk`;
  const directGithubUrl = `https://github.com/LivertonAguiar/rededoc/releases/download/app-latest/${apkFileName}`;

  const namedApk = path.resolve(uploadsPath, apkFileName);
  const fallbackApk = path.resolve(uploadsPath, 'itfy.apk');

  if (fs.existsSync(namedApk)) {
    return res.download(namedApk, apkFileName);
  }
  if (fs.existsSync(fallbackApk)) {
    return res.download(fallbackApk, apkFileName);
  }
  return res.redirect(directGithubUrl);
});

// Verificação de versão e suporte a atualizações OTA (Over-The-Air)
app.get('/api/app/version', (req, res) => {
  res.json({
    version: '1.0.1',
    buildNumber: 2,
    releaseName: 'ITFY 1.0.1 (Cyber Nexus, OTA & Offline-First)',
    releaseDate: '2026-11-08',
    otaSupported: true,
    minSupportedVersion: '1.0.0',
    changelog: [
      {
        tag: 'Correção Crítica',
        desc: 'Resolvido erro de login no aplicativo Android APK (comunicação com API remota).'
      },
      {
        tag: 'Offline-First',
        desc: 'Cadastro e alteração de equipamentos salvos no celular e sincronizados automaticamente ao reconectar.'
      },
      {
        tag: 'Atualização OTA',
        desc: 'Atualização Over-The-Air: receba melhorias e correções instantaneamente sem baixar novo APK.'
      },
      {
        tag: 'Design & Marca',
        desc: 'Novo logotipo oficial ITFY Cyber Nexus e ícone de alta fidelidade no Android.'
      },
      {
        tag: 'Documentação',
        desc: 'Registro e histórico de versões acessíveis no sistema.'
      }
    ],
    apkDownloadUrl: 'https://itfy.lpaguiar.com.br/download/apk',
    apkFileName: 'ITFY-v1.0.1.apk'
  });
});

app.use('/api/auth', authRouter);

// Portal do cliente (exclusivo para o papel 'cliente', filtrado pelo token)
app.use('/api/portal', portalRouter);

// Gestão de usuários (restrito a administradores)
app.use('/api/users', usersRouter);

// Todas as demais rotas da API exigem autenticação obrigatória e barram usuários com perfil 'cliente'
app.use('/api', requireAuth);
app.use('/api', requireInternalRole);

// Rotas internas autenticadas
app.use('/api/clients', clientsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/equipments', equipmentsRouter);
app.use('/api/port-forwards', portForwardsRouter);
app.use('/api/credentials', credentialsRouter);
app.use('/api/service-orders', serviceOrdersRouter);
app.use('/api/topology', topologyRouter);
app.use('/api/audit-history', auditHistoryRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/backup', requireRole('admin'), backupRouter);
app.use('/api/equipment-catalog', equipmentCatalogRouter);
app.use('/api/images', imagesRouter);
app.use('/api/links', linksRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/expirations', expirationsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/domains', domainsRouter);
app.use('/api/search', searchRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/subnets', subnetsRouter);
app.use('/api/equipment-templates', equipmentTemplatesRouter);

// Inicia agendador de notificações em segundo plano
startNotificationScheduler();

// Servir frontend compilado em ambiente de produção
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` ITFY Server ativo na porta ${PORT} [${process.env.NODE_ENV || 'production'}]`);
  console.log(` Health Check: /api/health`);
  console.log(`=========================================`);
});
