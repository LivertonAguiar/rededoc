import assert from 'node:assert';
import express from 'express';
import { db, initDatabase, execute, queryOne, queryAll } from '../db/database.js';
import { generateToken, requireAuth, requireRole, requireInternalRole } from '../middleware/auth.js';
import { equipmentTemplatesRouter } from '../routes/equipmentTemplates.js';
import { equipmentsRouter } from '../routes/equipments.js';

async function runPhase8Tests() {
  console.log('=====================================================');
  console.log(' TESTE AUTOMATIZADO — CRITÉRIOS DE ACEITE DA FASE 8');
  console.log(' Modelos por Tipo de Equipamento & Campos Dinâmicos');
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
  app.use('/api/equipment-templates', equipmentTemplatesRouter);
  app.use('/api/equipments', equipmentsRouter);

  async function makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    token: string,
    body?: any
  ): Promise<{ status: number; body: any }> {
    return new Promise((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as any).port;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };

        try {
          const res = await fetch(`http://127.0.0.1:${port}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
          });

          let json: any = null;
          const text = await res.text();
          try {
            json = JSON.parse(text);
          } catch {
            json = text;
          }

          server.close(() => {
            resolve({ status: res.status, body: json });
          });
        } catch (err) {
          server.close(() => {
            resolve({ status: 500, body: err });
          });
        }
      });
    });
  }

  const adminToken = generateToken({
    id: 'usr_admin_test_p8',
    email: 'admin_p8@teste.com',
    role: 'admin',
    name: 'Admin Master'
  });

  const tecnicoToken = generateToken({
    id: 'usr_tecnico_test_p8',
    email: 'tecnico_p8@teste.com',
    role: 'tecnico',
    name: 'Técnico Campo'
  });

  const clientId = 'cli_test_p8_' + Date.now();
  const locationId = 'loc_test_p8_' + Date.now();

  execute(`
    INSERT INTO clients (id, name, identification_name)
    VALUES (?, ?, ?)
  `, clientId, 'Condomínio Teste Fase 8', 'Cond. Fase 8');

  execute(`
    INSERT INTO locations (id, client_id, name, address)
    VALUES (?, ?, ?, ?)
  `, locationId, clientId, 'Rack Principal', 'Bloco A - Subsolo');

  console.log('\n1. Testando Carregamento e Filtro de Modelos Padrão (Seed)...');

  await testAsync('Lista todos os modelos padrão e verifica o parse de fields', async () => {
    const res = await makeRequest('GET', '/api/equipment-templates', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(Array.isArray(res.body), true);
    assert.strictEqual(res.body.length >= 6, true);
    assert.strictEqual(Array.isArray(res.body[0].fields), true);
  });

  await testAsync('Filtra modelos por categoria (facial_access)', async () => {
    const res = await makeRequest('GET', '/api/equipment-templates?category=facial_access', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length >= 1, true);
    assert.strictEqual(res.body[0].category, 'facial_access');
    const keys = res.body[0].fields.map((f: any) => f.key);
    assert.strictEqual(keys.includes('firmware_version'), true);
  });

  console.log('\n2. Testando Segurança e Validações de Modelos...');

  await testAsync('Validação bloqueia criação de campo com tipo "password" ou segredos', async () => {
    const res = await makeRequest('POST', '/api/equipment-templates', adminToken, {
      category: 'cctv_dvr',
      name: 'Modelo Inválido com Senha',
      fields: [
        { key: 'admin_password', label: 'Senha do Administrador', type: 'text', required: true }
      ]
    });
    // Deve falhar com 400 Bad Request
    assert.strictEqual(res.status, 400);
  });

  await testAsync('Técnico não tem permissão para criar modelos (exige admin)', async () => {
    const res = await makeRequest('POST', '/api/equipment-templates', tecnicoToken, {
      category: 'switch',
      name: 'Switch Customizado',
      fields: []
    });
    assert.strictEqual(res.status, 403);
  });

  let createdTemplateId = '';
  await testAsync('Admin cria novo modelo customizado com múltiplos tipos de campos', async () => {
    const res = await makeRequest('POST', '/api/equipment-templates', adminToken, {
      category: 'intercom',
      name: 'Interfonia e PABX IP Condominial',
      fields: [
        { key: 'sip_server', label: 'Servidor SIP', type: 'ip', required: true },
        { key: 'sip_port', label: 'Porta SIP', type: 'number', required: false },
        { key: 'codec_audio', label: 'Codec de Áudio Preferencial', type: 'select', required: false, options: ['G.711u', 'G.711a', 'G.729', 'Opus'] },
        { key: 'has_video', label: 'Suporta Chamada de Vídeo', type: 'boolean', required: false }
      ]
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.category, 'intercom');
    assert.strictEqual(res.body.fields.length, 4);
    createdTemplateId = res.body.id;
  });

  console.log('\n3. Testando Cadastro e Persistência de Equipamentos com custom_fields...');

  let testEquipmentId = '';
  await testAsync('Cadastra equipamento informando campos personalizados no custom_fields', async () => {
    const customData = {
      firmware_version: 'v3.2.1-build2026',
      facial_capacity: 5000,
      rfid_type: '125 kHz (EM-Marin)',
      anti_passback: true
    };

    const res = await makeRequest('POST', '/api/equipments', tecnicoToken, {
      client_id: clientId,
      location_id: locationId,
      name: 'Facial Entrada Visitantes',
      category: 'facial_access',
      manufacturer: 'Control iD',
      model: 'iDFace Max',
      local_ip: '192.168.1.55',
      custom_fields: customData
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.name, 'Facial Entrada Visitantes');
    testEquipmentId = res.body.id;

    // Verifica leitura do registro gravado no banco
    const row = queryOne('SELECT * FROM equipments WHERE id = ?', testEquipmentId);
    assert.strictEqual(Boolean(row.custom_fields), true);
    const parsed = typeof row.custom_fields === 'string' ? JSON.parse(row.custom_fields) : row.custom_fields;
    assert.strictEqual(parsed.firmware_version, 'v3.2.1-build2026');
    assert.strictEqual(parsed.facial_capacity, 5000);
    assert.strictEqual(parsed.anti_passback, true);
  });

  await testAsync('Atualiza equipamento modificando valores de custom_fields', async () => {
    const updatedCustom = {
      firmware_version: 'v3.3.0-patch1',
      facial_capacity: 10000,
      rfid_type: '13.56 MHz (Mifare)',
      anti_passback: false
    };

    const res = await makeRequest('PUT', `/api/equipments/${testEquipmentId}`, tecnicoToken, {
      name: 'Facial Entrada Visitantes (Atualizado)',
      custom_fields: updatedCustom
    });

    assert.strictEqual(res.status, 200);

    const row = queryOne('SELECT * FROM equipments WHERE id = ?', testEquipmentId);
    const parsed = typeof row.custom_fields === 'string' ? JSON.parse(row.custom_fields) : row.custom_fields;
    assert.strictEqual(parsed.firmware_version, 'v3.3.0-patch1');
    assert.strictEqual(parsed.facial_capacity, 10000);
    assert.strictEqual(parsed.rfid_type, '13.56 MHz (Mifare)');
    assert.strictEqual(parsed.anti_passback, false);
  });

  await testAsync('Equipamento antigo sem custom_fields abre e atualiza normalmente (compatibilidade total)', async () => {
    const legacyId = 'eq_legacy_' + Date.now();
    execute(`
      INSERT INTO equipments (id, client_id, location_id, name, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, legacyId, clientId, locationId, 'Switch Antigo', 'switch');

    const res = await makeRequest('GET', `/api/equipments/${legacyId}`, tecnicoToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.name, 'Switch Antigo');

    const putRes = await makeRequest('PUT', `/api/equipments/${legacyId}`, tecnicoToken, {
      notes: 'Nota adicionada em equipamento legado'
    });
    assert.strictEqual(putRes.status, 200);

    execute('DELETE FROM equipments WHERE id = ?', legacyId);
  });

  // Limpeza
  try {
    if (createdTemplateId) {
      execute('DELETE FROM equipment_templates WHERE id = ?', createdTemplateId);
    }
    if (testEquipmentId) {
      execute('DELETE FROM equipments WHERE id = ?', testEquipmentId);
    }
    execute('DELETE FROM locations WHERE id = ?', locationId);
    execute('DELETE FROM clients WHERE id = ?', clientId);
    console.log('\nDados de teste limpos com sucesso.');
  } catch (e) {
    console.warn('Aviso ao limpar dados de teste:', e);
  }

  console.log('\n=====================================================');
  console.log(` RESULTADO FINAL: ${passed} passaram, ${failed} falharam.`);
  console.log('=====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase8Tests().catch((err) => {
  console.error('Erro fatal executando os testes da Fase 8:', err);
  process.exit(1);
});
