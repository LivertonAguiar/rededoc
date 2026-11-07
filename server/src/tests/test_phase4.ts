import assert from 'node:assert';
import crypto from 'node:crypto';
import express from 'express';
import { db, initDatabase, execute, queryOne } from '../db/database.js';
import { hashSystemPassword } from '../services/crypto.js';
import { generateToken, requireAuth, requireRole, requireInternalRole } from '../middleware/auth.js';
import { portalRouter } from '../routes/portal.js';
import { usersRouter } from '../routes/users.js';
import { clientsRouter } from '../routes/clients.js';
import { searchRouter } from '../routes/search.js';
import { authRouter } from '../routes/auth.js';

async function runPhase4Tests() {
  console.log('=====================================================');
  console.log(' TESTE AUTOMATIZADO — CRITÉRIOS DE ACEITE DA FASE 4');
  console.log(' Portal do Cliente (Somente Leitura) & Gestão RBAC');
  console.log('=====================================================');

  initDatabase();

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`✅ [PASSOU] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FALHOU] ${name}:`, err.message);
      failed++;
    }
  }

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

  // 1. Criação do servidor Express em memória para testes de endpoints
  const app = express();
  app.use(express.json());

  app.use('/api/auth', authRouter);
  app.use('/api/portal', portalRouter);
  app.use('/api/users', usersRouter);

  app.use('/api', requireAuth);
  app.use('/api', requireInternalRole);

  app.use('/api/clients', clientsRouter);
  app.use('/api/search', searchRouter);

  // Helper para simular requisições HTTP locais no Express
  async function makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    token?: string,
    body?: any
  ): Promise<{ status: number; body: any }> {
    return new Promise((resolve) => {
      const server = app.listen(0, async () => {
        const port = (server.address() as any).port;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

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

  // Setup de dados de teste (Cliente A e Cliente B)
  const clientAId = 'cli_test_phase4_a_' + Date.now();
  const clientBId = 'cli_test_phase4_b_' + Date.now();

  execute(`
    INSERT INTO clients (id, name, identification_name, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, clientAId, 'Condomínio Alpha Test', 'Cond. Alpha', '(85) 9999-0001', 'alpha@teste.com', 'Av. Central 100', 'Nota interna confidenciais do Alpha');

  execute(`
    INSERT INTO clients (id, name, identification_name, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, clientBId, 'Condomínio Beta Test', 'Cond. Beta', '(85) 9999-0002', 'beta@teste.com', 'Av. Sul 200', 'Nota interna confidenciais do Beta');

  // Locais
  const locAId = 'loc_test_a_' + Date.now();
  const locBId = 'loc_test_b_' + Date.now();

  execute(`
    INSERT INTO locations (id, client_id, name, address, contact_name, phone, access_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, locAId, clientAId, 'Guarita Alpha', 'Av. Central 100', 'Porteiro Alpha', '1111', 'Senha do cofre da guarita: 9988');

  execute(`
    INSERT INTO locations (id, client_id, name, address, contact_name, phone, access_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, locBId, clientBId, 'Guarita Beta', 'Av. Sul 200', 'Porteiro Beta', '2222', 'Senha do cofre da guarita: 1122');

  // Equipamentos
  const eqAId = 'eq_test_a_' + Date.now();
  const eqBId = 'eq_test_b_' + Date.now();

  execute(`
    INSERT INTO equipments (
      id, client_id, location_id, name, category, manufacturer, model, serial_number,
      mac_address, local_ip, physical_location, notes, internal_notes, access_notes, config_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, eqAId, clientAId, locAId, 'Facial Entrada Alpha', 'facial_access', 'Control iD', 'iDFace', 'SN-A123',
     '00:11:22:33:44:55', '192.168.1.50', 'Torniquete 1', 'Nota pública', 'Chave secreta interna', 'admin:pass123', 'Avançado > Config');

  execute(`
    INSERT INTO equipments (
      id, client_id, location_id, name, category, manufacturer, model, serial_number,
      mac_address, local_ip, physical_location, notes, internal_notes, access_notes, config_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, eqBId, clientBId, locBId, 'DVR Portaria Beta', 'cctv_dvr', 'Intelbras', 'MHDX 1116', 'SN-B999',
     '00:AA:BB:CC:DD:EE', '10.0.0.50', 'Rack do Beta', 'Nota pública Beta', 'Segredo Beta', 'admin:beta321', 'Rede > NAT');

  // Ordens de Serviço
  const soConcluidaA = 'so_test_a_done_' + Date.now();
  const soPendenteA = 'so_test_a_pend_' + Date.now();
  const soConcluidaB = 'so_test_b_done_' + Date.now();

  execute(`
    INSERT INTO service_orders (
      id, client_id, location_id, date_time, service_type, problem_description,
      status, technician_name, changes_made, test_results, technical_notes, service_cost, time_spent_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, soConcluidaA, clientAId, locAId, '2026-11-01 10:00:00', 'manutencao_corretiva', 'Fonte queimada após raio',
     'concluido', 'Técnico Silva', 'Substituída fonte de 12V 5A', 'Equipamento restabelecido com sucesso',
     'Custo real da peça foi 45 reais; cobrado 180', 180.00, 45);

  execute(`
    INSERT INTO service_orders (
      id, client_id, location_id, date_time, service_type, problem_description,
      status, technician_name, changes_made, test_results, technical_notes, service_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, soPendenteA, clientAId, locAId, '2026-11-03 14:00:00', 'instalacao', 'Cliente quer mais 4 câmeras',
     'em_andamento', 'Técnico Silva', 'Levantamento em campo', 'Em elaboração', 'Margem pretendida 60%', 0);

  execute(`
    INSERT INTO service_orders (
      id, client_id, location_id, date_time, service_type, problem_description,
      status, technician_name, changes_made, test_results, technical_notes, service_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, soConcluidaB, clientBId, locBId, '2026-11-02 14:00:00', 'manutencao_preventiva', 'Revisão semestral',
     'concluido', 'Técnico Souza', 'Lubrificação das cremalheiras', 'Preventiva concluída', 'Notas confidenciais Beta', 250.00);

  // Artigos
  const artA = 'art_test_a_' + Date.now();
  const artB = 'art_test_b_' + Date.now();
  const artGlobal = 'art_test_glob_' + Date.now();
  const artOculto = 'art_test_oculto_' + Date.now();

  execute(`
    INSERT INTO articles (id, client_id, title, body_md, tags, visible_in_portal)
    VALUES (?, ?, ?, ?, ?, ?)
  `, artA, clientAId, 'Manual de Cadastro Facial Moradores', '# Procedimento para o síndico cadastrar rostos', 'facial,moradores', 1);

  execute(`
    INSERT INTO articles (id, client_id, title, body_md, tags, visible_in_portal)
    VALUES (?, ?, ?, ?, ?, ?)
  `, artB, clientBId, 'Manual do Portão Beta', '# Procedimento do portão Beta', 'portao', 1);

  execute(`
    INSERT INTO articles (id, client_id, title, body_md, tags, visible_in_portal)
    VALUES (?, ?, ?, ?, ?, ?)
  `, artGlobal, null, 'Dicas de Segurança em Redes Condominiais', '# Boas práticas para portarias', 'segurança,geral', 1);

  execute(`
    INSERT INTO articles (id, client_id, title, body_md, tags, visible_in_portal)
    VALUES (?, ?, ?, ?, ?, ?)
  `, artOculto, clientAId, 'Procedimento Interno Exclusivo da Equipe Técnica', '# Não mostrar ao cliente', 'interno', 0);

  // Tokens de teste
  const adminToken = generateToken({
    id: 'usr_admin_test',
    email: 'admin@teste.com',
    role: 'admin',
    name: 'Admin Master'
  });

  const tecnicoToken = generateToken({
    id: 'usr_tecnico_test',
    email: 'tecnico@teste.com',
    role: 'tecnico',
    name: 'Técnico Campo'
  });

  const clientAToken = generateToken({
    id: 'usr_client_a_test',
    email: 'sindico@alpha.com',
    role: 'cliente',
    name: 'Síndico Alpha',
    client_id: clientAId
  });

  const clientBToken = generateToken({
    id: 'usr_client_b_test',
    email: 'sindico@beta.com',
    role: 'cliente',
    name: 'Síndico Beta',
    client_id: clientBId
  });

  console.log('\n1. Testando Segurança e Isolamento Multi-inquilino do Portal...');

  await testAsync('Cliente A acessa /api/portal/overview e vê apenas seus dados', async () => {
    const res = await makeRequest('GET', '/api/portal/overview', clientAToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.client.id, clientAId);
    assert.strictEqual(res.body.client.name, 'Condomínio Alpha Test');
    assert.strictEqual(res.body.locations.length, 1);
    assert.strictEqual(res.body.locations[0].id, locAId);
  });

  await testAsync('Cliente A NÃO vê dados do Cliente B na Visão Geral', async () => {
    const res = await makeRequest('GET', '/api/portal/overview', clientAToken);
    const text = JSON.stringify(res.body);
    assert.strictEqual(text.includes('Beta'), false);
    assert.strictEqual(text.includes(clientBId), false);
  });

  await testAsync('Cliente A acessa /api/portal/equipments e recebe lista sanitizada', async () => {
    const res = await makeRequest('GET', '/api/portal/equipments', clientAToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(Array.isArray(res.body), true);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].id, eqAId);
    assert.strictEqual(res.body[0].name, 'Facial Entrada Alpha');

    // Confirmação de lista branca: campos confidenciais não existem
    assert.strictEqual(res.body[0].local_ip, undefined);
    assert.strictEqual(res.body[0].internal_notes, undefined);
    assert.strictEqual(res.body[0].access_notes, undefined);
    assert.strictEqual(res.body[0].config_path, undefined);
    assert.strictEqual(res.body[0].serial_number, undefined);
    assert.strictEqual(res.body[0].mac_address, undefined);
  });

  await testAsync('Cliente A acessa /api/portal/service-orders e vê somente ordens concluídas', async () => {
    const res = await makeRequest('GET', '/api/portal/service-orders', clientAToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].id, soConcluidaA);
    assert.strictEqual(res.body[0].problem_description, 'Fonte queimada após raio');

    // Ordem pendente não pode aparecer para o cliente
    const hasPendente = res.body.some((so: any) => so.id === soPendenteA);
    assert.strictEqual(hasPendente, false);

    // Ordem de outro cliente não pode aparecer
    const hasBeta = res.body.some((so: any) => so.id === soConcluidaB);
    assert.strictEqual(hasBeta, false);

    // Confirmação de DTO seguro: custo financeiro e notas internas proibidas
    assert.strictEqual(res.body[0].service_cost, undefined);
    assert.strictEqual(res.body[0].time_spent_minutes, undefined);
    assert.strictEqual(res.body[0].technical_notes, undefined);
  });

  await testAsync('Cliente A acessa /api/portal/articles e vê apenas artigos autorizados', async () => {
    const res = await makeRequest('GET', '/api/portal/articles', clientAToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(Array.isArray(res.body), true);

    const ids = res.body.map((a: any) => a.id);
    assert.strictEqual(ids.includes(artA), true);
    assert.strictEqual(ids.includes(artGlobal), true);

    // Artigo de outro condomínio não aparece
    assert.strictEqual(ids.includes(artB), false);
    // Artigo oculto do portal não aparece
    assert.strictEqual(ids.includes(artOculto), false);
  });

  console.log('\n2. Testando Bloqueio de Acesso a Rotas Internas para Papel "cliente"...');

  await testAsync('Usuário cliente é bloqueado com 403 em /api/clients', async () => {
    const res = await makeRequest('GET', '/api/clients', clientAToken);
    assert.strictEqual(res.status, 403);
  });

  await testAsync('Usuário cliente é bloqueado com 403 em /api/search', async () => {
    const res = await makeRequest('GET', '/api/search?q=teste', clientAToken);
    assert.strictEqual(res.status, 403);
  });

  await testAsync('Usuário técnico ou admin tentando acessar /api/portal recebe 403', async () => {
    const res = await makeRequest('GET', '/api/portal/overview', tecnicoToken);
    assert.strictEqual(res.status, 403);
  });

  console.log('\n3. Testando Gestão de Usuários e RBAC (/api/users)...');

  await testAsync('Usuário técnico é bloqueado com 403 em /api/users', async () => {
    const res = await makeRequest('GET', '/api/users', tecnicoToken);
    assert.strictEqual(res.status, 403);
  });

  await testAsync('Admin consegue listar usuários em /api/users', async () => {
    const res = await makeRequest('GET', '/api/users', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(Array.isArray(res.body), true);
  });

  let createdPortalUserId = '';
  await testAsync('Admin cria novo usuário para o portal do cliente', async () => {
    const res = await makeRequest('POST', '/api/users', adminToken, {
      name: 'Novo Síndico Teste',
      email: `sindico_novo_${Date.now()}@teste.com`,
      password: 'senhaSegura123',
      role: 'cliente',
      client_id: clientAId,
      is_active: 1
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.role, 'cliente');
    assert.strictEqual(res.body.client_id, clientAId);
    assert.strictEqual(res.body.password_hash, undefined); // Senha nunca exposta
    createdPortalUserId = res.body.id;
  });

  await testAsync('Tentativa de criar usuário cliente sem client_id falha com 400', async () => {
    const res = await makeRequest('POST', '/api/users', adminToken, {
      name: 'Cliente Sem Condomínio',
      email: `invalido_${Date.now()}@teste.com`,
      password: 'senhaSegura123',
      role: 'cliente'
    });

    assert.strictEqual(res.status, 400);
  });

  await testAsync('Admin redefine a senha do usuário com sucesso', async () => {
    const res = await makeRequest('POST', `/api/users/${createdPortalUserId}/reset-password`, adminToken, {
      password: 'novaSenhaForte456'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  await testAsync('Admin atualiza dados do usuário (desativa usuário)', async () => {
    const res = await makeRequest('PUT', `/api/users/${createdPortalUserId}`, adminToken, {
      name: 'Novo Síndico Desativado',
      is_active: 0
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.is_active, 0);
  });

  await testAsync('Admin exclui o usuário criado com sucesso', async () => {
    const res = await makeRequest('DELETE', `/api/users/${createdPortalUserId}`, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  // Limpeza dos dados de teste
  try {
    execute('DELETE FROM service_orders WHERE client_id IN (?, ?)', clientAId, clientBId);
    execute('DELETE FROM articles WHERE id IN (?, ?, ?, ?)', artA, artB, artGlobal, artOculto);
    execute('DELETE FROM equipments WHERE client_id IN (?, ?)', clientAId, clientBId);
    execute('DELETE FROM locations WHERE client_id IN (?, ?)', clientAId, clientBId);
    execute('DELETE FROM clients WHERE id IN (?, ?)', clientAId, clientBId);
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

runPhase4Tests().catch((err) => {
  console.error('Erro fatal executando os testes da Fase 4:', err);
  process.exit(1);
});
