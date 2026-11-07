import http from 'node:http';
import { initDatabase, queryAll, queryOne, execute, db } from '../db/database.js';
import { listExpirations } from '../services/expirationService.js';
import { testWebhook, checkAndDispatchAlerts } from '../services/notificationService.js';

console.log('=====================================================');
console.log(' TESTE AUTOMATIZADO — CRITÉRIOS DE ACEITE DA FASE 3');
console.log('=====================================================');

initDatabase();

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✅ [PASSOU] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FALHOU] ${testName}`);
    failed++;
  }
}

async function runTests() {
  // 1. Critério 1: Equipamento com garantia vencendo em 5 dias aparece em âmbar ('due_7d')
  console.log('\n1. Testando cálculo de status para garantia em 5 dias...');
  const in5Days = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  
  // Atualiza equipamento de teste
  const facial = queryOne<any>("SELECT id, name FROM equipments WHERE name LIKE '%Facial%' OR name LIKE '%PORTARIA%' LIMIT 1");
  if (!facial) {
    throw new Error('Equipamento não encontrado para teste de garantia.');
  }

  execute("UPDATE equipments SET warranty_expires_at = ? WHERE id = ?", in5Days, facial.id);

  const expirations = listExpirations({ withinDays: 30 });
  const facialExp = expirations.find(e => e.entityId === facial.id && e.kind === 'warranty');

  assert(facialExp !== undefined, 'Equipamento retornado na lista de vencimentos');
  assert(facialExp?.daysRemaining === 5, `Dias restantes calculados como 5 (obtido: ${facialExp?.daysRemaining})`);
  assert(facialExp?.status === 'due_7d', `Status classificado como 'due_7d' (cor âmbar no frontend)`);

  // 2. Critério 2: Envio de teste do webhook funciona
  console.log('\n2. Testando envio de webhook de teste...');
  let webhookReceived: boolean = false;
  let receivedPayload: any = null;

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      webhookReceived = true;
      try {
        receivedPayload = JSON.parse(body);
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const port = (server.address() as any).port;
  const mockUrl = `http://127.0.0.1:${port}/webhook-test`;

  try {
    const testResult = await testWebhook(mockUrl);
    assert(testResult.success === true, 'Webhook de teste respondeu com sucesso');
    assert(Boolean(webhookReceived), 'Servidor de destino recebeu o payload');
    assert(receivedPayload?.event === 'test_notification', 'Payload recebido contém event: test_notification');
  } catch (err: any) {
    assert(false, `Falha no teste do webhook: ${err.message}`);
  }

  // 3. Critério 3: O mesmo alerta NÃO é enviado duas vezes no mesmo dia
  console.log('\n3. Testando desduplicação diária de alertas...');
  // Limpa configurações e logs para o teste isolado
  execute('DELETE FROM notification_settings');
  execute('DELETE FROM notification_log');

  execute(`
    INSERT INTO notification_settings (id, channel, target_url, advance_days, is_active)
    VALUES ('nst_test_1', 'webhook', ?, '30,7,0', 1)
  `, mockUrl);

  const run1 = await checkAndDispatchAlerts();
  assert(run1.totalDispatched >= 1, `Primeiro disparo enviou alertas com sucesso (total: ${run1.totalDispatched})`);

  // Segundo disparo no mesmo dia para os mesmos itens
  const run2 = await checkAndDispatchAlerts();
  assert(run2.totalDispatched === 0, 'Segundo disparo NÃO reenviou alertas no mesmo dia (total: 0)');
  assert(run2.skippedDuplicates >= 1, `Segundo disparo registrou itens como desduplicados (pulados: ${run2.skippedDuplicates})`);

  // 4. Critério 4: Histórico / Logs gravados no banco
  console.log('\n4. Testando persistência de histórico no notification_log...');
  const logs = queryAll<any>('SELECT * FROM notification_log ORDER BY created_at DESC');
  assert(logs.length >= 1, `Histórico contém ${logs.length} registros de auditoria gravados`);
  assert(logs[0].status === 'success', `Último registro com status 'success'`);

  // Fecha servidor mock e finaliza naturalmente
  server.close(() => {
    console.log('\n=====================================================');
    console.log(` RESULTADO FINAL FASE 3: ${passed} passaram, ${failed} falharam.`);
    console.log('=====================================================');

    if (failed > 0) {
      process.exitCode = 1;
    }
  });
}

runTests().catch(err => {
  console.error('Erro fatal nos testes da Fase 3:', err);
  process.exit(1);
});
