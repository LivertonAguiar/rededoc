import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { initDatabase } from './db/database.js';
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Inicializa banco de dados SQLite
initDatabase();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Servir arquivos de uploads
const uploadsPath = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Rotas da API REST
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    system: 'ITFY API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRouter);
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
app.use('/api/backup', backupRouter);
app.use('/api/equipment-catalog', equipmentCatalogRouter);
app.use('/api/images', imagesRouter);

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
