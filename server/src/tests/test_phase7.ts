import { initDatabase, queryAll, queryOne, execute, db } from '../db/database.js';
import { listExpirations } from '../services/expirationService.js';
import { checkSsl, checkDns, checkRdap, checkDomain } from '../services/domainCheckService.js';

console.log('=====================================================');
console.log(' TESTE AUTOMATIZADO — CRITÉRIOS DE ACEITE DA FASE 7');
console.log(' Monitoramento de Domínios, SSL e DNS');
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
  try {
    // 1. Obter ou criar um cliente de teste
    const client = queryOne<any>('SELECT id, name FROM clients LIMIT 1');
    if (!client) {
      throw new Error('Nenhum cliente cadastrado no banco para associar ao teste de domínios.');
    }

    const testDomainId = `test_dom_${Date.now()}`;
    const testDomainName = 'condominio-central.ddns.net';

    // 2. Critério 1: Criação e persistência do Domínio
    console.log('\n1. Criando domínio no banco de dados...');
    execute(`
      INSERT INTO domains (
        id, client_id, name, registrar, auto_check,
        ssl_expires_at, expires_at, score, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      testDomainId,
      client.id,
      testDomainName,
      'No-IP / Registro.br',
      1,
      new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), // SSL em 10 dias
      new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),  // Registro em 2 dias
      85,
      'Domínio DDNS para acesso às câmeras'
    );

    const created = queryOne<any>('SELECT * FROM domains WHERE id = ?', testDomainId);
    assert(created !== undefined, 'Domínio persistido com sucesso na tabela domains');
    assert(created.name === testDomainName, 'Nome do domínio gravado corretamente');
    assert(created.auto_check === 1, 'Flag auto_check gravada corretamente');

    // 3. Critério 2: Integração com o ExpirationService (SSL e Registro de Domínio)
    console.log('\n2. Testando integração com o serviço unificado de vencimentos (ExpirationService)...');
    const expirations = listExpirations({ clientId: client.id });

    const sslExp = expirations.find(e => e.entityId === testDomainId && e.kind === 'ssl');
    assert(sslExp !== undefined, 'SSL do domínio capturado na lista de vencimentos');
    assert(sslExp?.status === 'due_30d', `Status do SSL classificado como 'due_30d' (10 dias restantes)`);

    const domExp = expirations.find(e => e.entityId === testDomainId && e.kind === 'domain');
    assert(domExp !== undefined, 'Expiração do registro do domínio capturada na lista de vencimentos');
    assert(domExp?.status === 'due_7d', `Status do registro classificado como 'due_7d' (2 dias restantes)`);

    // 4. Critério 3: Resiliência contra domínios inexistentes ou falhas de rede (checkSsl e checkRdap)
    console.log('\n3. Testando resiliência das checagens sem dependência de rede...');
    const fakeSsl = await checkSsl('dominio-inexistente-teste-offline.invalido');
    assert(fakeSsl.validTo === null && fakeSsl.issuer === null, 'checkSsl falha de forma segura sem lançar exceção');

    const fakeRdap = await checkRdap('dominio-inexistente-teste-offline.invalido');
    assert(fakeRdap.expiresAt === null, 'checkRdap falha de forma segura em timeout/erro de rede sem quebrar a execução');

    // 5. Critério 4: Resolução de DNS resiliente
    console.log('\n4. Testando resolução DNS com tratamento de erros...');
    const fakeDns = await checkDns('dominio-inexistente-teste-offline.invalido');
    assert(Array.isArray(fakeDns.a_records) && fakeDns.a_records.length === 0, 'DNS A records retorna array vazio para host inexistente');
    assert(fakeDns.spf === null, 'SPF retorna null graciosamente');

    // 6. Critério 5: Checagem completa de domínio e atualização de snapshot no banco
    console.log('\n5. Executando checkDomain completo...');
    const checked = await checkDomain(testDomainId);
    assert(checked !== undefined, 'checkDomain executa e retorna o registro atualizado');
    assert(checked.last_checked_at !== null, 'last_checked_at preenchido após verificação');
    assert(typeof checked.score === 'number', `Score de segurança calculado numericamente (${checked.score}/100)`);

    const snapshot = JSON.parse(checked.dns_snapshot || '{}');
    assert(snapshot !== null && typeof snapshot === 'object', 'dns_snapshot serializado como JSON válido no SQLite');

    // Limpeza
    execute('DELETE FROM domains WHERE id = ?', testDomainId);
    console.log('\nDomínio de teste limpo com sucesso.');

    console.log('\n=====================================================');
    console.log(` RESULTADO FINAL: ${passed} passaram, ${failed} falharam.`);
    console.log('=====================================================');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Erro inesperado durante a execução dos testes:', err);
    process.exitCode = 1;
  }
}

runTests();
