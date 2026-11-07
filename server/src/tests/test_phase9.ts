import assert from 'node:assert';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, initDatabase, execute, queryOne, queryAll } from '../db/database.js';
import { generateToken, requireAuth, requireInternalRole } from '../middleware/auth.js';
import { attachmentsRouter } from '../routes/attachments.js';

async function runPhase9Tests() {
  console.log('=====================================================');
  console.log(' TESTE AUTOMATIZADO — CRITÉRIOS DE ACEITE DA FASE 9');
  console.log(' App de Campo: Fotos, Câmera e Gerenciamento de Anexos');
  console.log('=====================================================');

  initDatabase();

  let passed = 0;
  let failed = 0;

  async function testAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ [PASSOU] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FALHOU] ${name}:`, err.message);
      failed++;
    }
  }

  const app = express();
  app.use(express.json());
  app.use('/api', requireAuth);
  app.use('/api', requireInternalRole);
  app.use('/api/attachments', attachmentsRouter);

  // Usuário técnico para testes
  const techUser = {
    id: 'user_tech_p9',
    name: 'Técnico Silva',
    username: 'tecnico_campo',
    email: 'tecnico@exemplo.com',
    role: 'tecnico' as const,
    client_id: null
  };
  const techToken = generateToken(techUser);

  // Criar dados base para teste (cliente, local, equipamento e ordem de serviço)
  const testClientId = 'client_phase9_' + Date.now();
  execute(`
    INSERT INTO clients (id, name, identification_name, notes)
    VALUES (?, 'Condomínio Solar das Palmeiras', 'Solar Palmeiras', 'Teste Fase 9')
  `, testClientId);

  const testLocationId = 'loc_p9_' + Date.now();
  execute(`
    INSERT INTO locations (id, client_id, name, address)
    VALUES (?, ?, 'Rack Central Bloco A', 'Rua das Flores 123')
  `, testLocationId, testClientId);

  const testEquipId = 'eq_p9_' + Date.now();
  execute(`
    INSERT INTO equipments (id, client_id, location_id, name, category, local_ip, mac_address)
    VALUES (?, ?, ?, 'Mikrotik CCR1009', 'router', '192.168.88.1', 'AA:BB:CC:DD:EE:99')
  `, testEquipId, testClientId, testLocationId);

  const testOrderId = 'so_p9_' + Date.now();
  execute(`
    INSERT INTO service_orders (id, client_id, location_id, technician_name, date_time, service_type, problem_description, status)
    VALUES (?, ?, ?, 'Técnico Silva', datetime('now'), 'Manutenção Preventiva', 'Verificação e organização do rack', 'concluida')
  `, testOrderId, testClientId, testLocationId);

  // Helper para disparo HTTP multipart usando boundary nativo do Node.js
  async function makeMultipartRequest(
    method: 'POST',
    urlPath: string,
    token: string,
    fields: Record<string, string>,
    file?: { fieldname: string; filename: string; contentType: string; content: Buffer }
  ): Promise<{ status: number; body: any }> {
    return new Promise((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as any).port;
        const boundary = '----WebKitFormBoundary' + crypto.randomUUID().replace(/-/g, '');
        const chunks: Buffer[] = [];

        // Adiciona campos textuais
        for (const [key, val] of Object.entries(fields)) {
          chunks.push(Buffer.from(`--${boundary}\r\n`));
          chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
          chunks.push(Buffer.from(`${val}\r\n`));
        }

        // Adiciona arquivo se presente
        if (file) {
          chunks.push(Buffer.from(`--${boundary}\r\n`));
          chunks.push(Buffer.from(`Content-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\n`));
          chunks.push(Buffer.from(`Content-Type: ${file.contentType}\r\n\r\n`));
          chunks.push(file.content);
          chunks.push(Buffer.from('\r\n'));
        }

        chunks.push(Buffer.from(`--${boundary}--\r\n`));
        const bodyBuffer = Buffer.concat(chunks);

        try {
          const res = await fetch(`http://127.0.0.1:${port}${urlPath}`, {
            method,
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: bodyBuffer
          });

          let json: any = null;
          try {
            json = await res.json();
          } catch {
            json = null;
          }

          server.close(() => resolve({ status: res.status, body: json }));
        } catch (err: any) {
          server.close(() => resolve({ status: 500, body: { error: err.message } }));
        }
      });
    });
  }

  async function makeJsonRequest(
    method: 'GET' | 'DELETE',
    urlPath: string,
    token: string
  ): Promise<{ status: number; body: any }> {
    return new Promise((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as any).port;
        try {
          const res = await fetch(`http://127.0.0.1:${port}${urlPath}`, {
            method,
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          let json: any = null;
          try {
            json = await res.json();
          } catch {
            json = null;
          }

          server.close(() => resolve({ status: res.status, body: json }));
        } catch (err: any) {
          server.close(() => resolve({ status: 500, body: { error: err.message } }));
        }
      });
    });
  }

  let createdEquipPhotoId = '';
  let createdOrderPhotoId = '';

  // 1. Upload de foto de equipamento com categoria 'foto_etiqueta' e legenda
  await testAsync('1. Upload de foto de campo vinculada a equipamento com categoria e legenda', async () => {
    const fakeImage = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
    const res = await makeMultipartRequest('POST', '/api/attachments', techToken, {
      client_id: testClientId,
      location_id: testLocationId,
      equipment_id: testEquipId,
      category: 'foto_etiqueta',
      notes: 'Foto da etiqueta com MAC e Número de Série do Mikrotik'
    }, {
      fieldname: 'file',
      filename: 'etiqueta_mikrotik.jpg',
      contentType: 'image/jpeg',
      content: fakeImage
    });

    assert.strictEqual(res.status, 201, `Status esperado 201, obtido ${res.status}`);
    assert.ok(res.body.id, 'Deve retornar ID do anexo criado');
    assert.strictEqual(res.body.equipment_id, testEquipId);
    assert.strictEqual(res.body.category, 'foto_etiqueta');
    assert.strictEqual(res.body.notes, 'Foto da etiqueta com MAC e Número de Série do Mikrotik');
    createdEquipPhotoId = res.body.id;
  });

  // 2. Upload de foto vinculada a ordem de serviço com categoria 'foto_rack'
  await testAsync('2. Upload de foto vinculada a ordem de serviço em campo', async () => {
    const fakeImage = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;');
    const res = await makeMultipartRequest('POST', '/api/attachments', techToken, {
      client_id: testClientId,
      location_id: testLocationId,
      service_order_id: testOrderId,
      category: 'foto_rack',
      notes: 'Rack após organização do cabeamento e fixação dos patch cords'
    }, {
      fieldname: 'file',
      filename: 'rack_depois.jpg',
      contentType: 'image/jpeg',
      content: fakeImage
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.service_order_id, testOrderId);
    assert.strictEqual(res.body.category, 'foto_rack');
    createdOrderPhotoId = res.body.id;
  });

  // 3. Rejeição de upload sem arquivo
  await testAsync('3. Rejeição de envio sem arquivo anexo (400)', async () => {
    const res = await makeMultipartRequest('POST', '/api/attachments', techToken, {
      client_id: testClientId
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  });

  // 4. Rejeição de envio sem client_id
  await testAsync('4. Rejeição de envio sem client_id (400)', async () => {
    const fakeImage = Buffer.from('fake image content');
    const res = await makeMultipartRequest('POST', '/api/attachments', techToken, {}, {
      fieldname: 'file',
      filename: 'teste.jpg',
      contentType: 'image/jpeg',
      content: fakeImage
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error);
  });

  // 5. Listagem de anexos filtrando por equipamento
  await testAsync('5. Consulta e listagem de fotos filtrando por equipamento', async () => {
    const res = await makeJsonRequest('GET', `/api/attachments?clientId=${testClientId}&equipmentId=${testEquipId}`, techToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const found = res.body.find((a: any) => a.id === createdEquipPhotoId);
    assert.ok(found, 'Foto do equipamento deve estar presente na listagem');
    assert.strictEqual(found.category, 'foto_etiqueta');
  });

  // 6. Listagem de anexos filtrando por Ordem de Serviço
  await testAsync('6. Consulta e listagem de fotos filtrando por Ordem de Serviço', async () => {
    const res = await makeJsonRequest('GET', `/api/attachments?clientId=${testClientId}&serviceOrderId=${testOrderId}`, techToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const found = res.body.find((a: any) => a.id === createdOrderPhotoId);
    assert.ok(found, 'Foto da OS deve estar presente na listagem');
    assert.strictEqual(found.category, 'foto_rack');
  });

  // 7. Exclusão de anexo
  await testAsync('7. Exclusão de foto anexa com sucesso (DELETE /api/attachments/:id)', async () => {
    const res = await makeJsonRequest('DELETE', `/api/attachments/${createdOrderPhotoId}`, techToken);
    assert.strictEqual(res.status, 200);

    // Verificar se sumiu do banco
    const checkDb = queryOne('SELECT * FROM attachments WHERE id = ?', createdOrderPhotoId);
    assert.strictEqual(checkDb, undefined, 'Anexo deve ter sido excluído do SQLite');
  });

  // Limpeza de dados de teste
  execute('DELETE FROM attachments WHERE client_id = ?', testClientId);
  execute('DELETE FROM service_orders WHERE client_id = ?', testClientId);
  execute('DELETE FROM equipments WHERE client_id = ?', testClientId);
  execute('DELETE FROM locations WHERE client_id = ?', testClientId);
  execute('DELETE FROM clients WHERE id = ?', testClientId);

  console.log('=====================================================');
  console.log(`RESULTADO DA FASE 9: ${passed} passaram, ${failed} falharam.`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase9Tests().catch(err => {
  console.error('Erro fatal ao rodar testes da Fase 9:', err);
  process.exit(1);
});
