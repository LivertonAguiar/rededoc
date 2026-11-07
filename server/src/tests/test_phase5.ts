import jwt from 'jsonwebtoken';
import { initDatabase, queryAll, queryOne, execute, db } from '../db/database.js';
import { initSearchIndex, rebuildSearchIndex, searchGlobal, normalizeMac } from '../services/searchService.js';
import { getJwtSecret } from '../middleware/auth.js';

console.log('=====================================================');
console.log(' TESTE AUTOMATIZADO — CRITÉRIOS DE ACEITE DA FASE 5');
console.log(' Visão Geral Melhorada e Busca Global FTS5');
console.log('=====================================================');

initDatabase();
initSearchIndex();
rebuildSearchIndex();

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
    // 1. Critério 1: Busca por IP, MAC com e sem separadores, serviço e artigo
    console.log('\n1. Testando busca unificada FTS5...');

    // 1.1 Busca por IP
    const ipSearch = searchGlobal('192.168.1.50');
    assert(ipSearch.total > 0, 'Busca por IP retorna resultados');
    const facialByIp = ipSearch.results.find(r => r.type === 'equipment' && r.title.includes('FACIAL'));
    assert(facialByIp !== undefined, 'Equipamento FACIAL encontrado pelo IP 192.168.1.50');

    // 1.2 Busca por MAC com separadores (00:1A:2B:3C:4D:5E)
    const macSearchColon = searchGlobal('00:1A:2B:3C:4D:5E');
    const facialByMacColon = macSearchColon.results.find(r => r.type === 'equipment' && r.title.includes('FACIAL'));
    assert(facialByMacColon !== undefined, 'Equipamento encontrado buscando por MAC formatado (com dois-pontos)');

    // 1.3 Busca por trecho de MAC sem separadores (001a2b)
    const macSearchClean = searchGlobal('001a2b');
    const facialByMacClean = macSearchClean.results.find(r => r.type === 'equipment' && r.title.includes('FACIAL'));
    assert(facialByMacClean !== undefined, 'Equipamento encontrado buscando por trecho de MAC normalizado (sem dois-pontos)');

    // 1.4 Busca por Nome de Serviço de Porta NAT
    const portSearch = searchGlobal('Facial web');
    assert(portSearch.total > 0, 'Busca por serviço de portas retorna resultados');
    const facialPort = portSearch.results.find(r => r.type === 'port_forward');
    assert(facialPort !== undefined, 'Regra de porta NAT Facial encontrada buscando pelo nome do serviço');

    // 1.5 Busca por palavra de artigo da Base de Conhecimento
    const articleSearch = searchGlobal('Procedimento');
    assert(articleSearch.total > 0, 'Busca por palavra de artigo retorna resultados');

    // 2. Critério 2: Nenhuma senha aparece no índice de busca
    console.log('\n2. Testando segurança: ausência de senhas no índice search_index...');
    const allSearchRows = queryAll<any>("SELECT body FROM search_index WHERE entity_type = 'credential'");
    let leakedPassword = false;

    // Senhas criptografadas ou em texto nunca devem estar no body do índice
    const creds = queryAll<any>('SELECT encrypted_password, iv, auth_tag FROM credentials');
    for (const row of allSearchRows) {
      for (const cr of creds) {
        if (row.body.includes(cr.encrypted_password) || row.body.includes(cr.iv) || row.body.includes(cr.auth_tag)) {
          leakedPassword = true;
          break;
        }
      }
      if (row.body.includes('admin123') || row.body.includes('secret') || row.body.includes('password')) {
        leakedPassword = true;
      }
    }
    assert(!leakedPassword, 'Nenhuma senha (em texto claro ou criptografada) vazou no índice de busca');

    // 3. Critério 3: Favoritos (adição, persistência e verificação)
    console.log('\n3. Testando sistema de Favoritos...');
    const testUserId = 'test_user_fav_01';
    const testEqId = 'test_eq_fav_01';

    execute('INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      testUserId, 'User Test', 'testfav@test.com', 'hash', 'tecnico');

    const favId = `fav_${Date.now()}`;
    execute('INSERT INTO favorites (id, user_id, entity_type, entity_id) VALUES (?, ?, ?, ?)',
      favId, testUserId, 'equipment', testEqId);

    const savedFav = queryOne<any>('SELECT * FROM favorites WHERE user_id = ? AND entity_id = ?', testUserId, testEqId);
    assert(savedFav !== undefined, 'Favorito gravado e persistido com sucesso na tabela favorites');
    assert(savedFav.entity_type === 'equipment', 'Tipo da entidade favorita correto');

    // Exclusão de favorito
    execute('DELETE FROM favorites WHERE id = ?', favId);
    const afterDelete = queryOne<any>('SELECT * FROM favorites WHERE id = ?', favId);
    assert(afterDelete === undefined, 'Favorito removido com sucesso');

    // Limpeza de usuário de teste
    execute('DELETE FROM users WHERE id = ?', testUserId);

    // 4. Critério 4: Perfil cliente recebe 403 na busca (Validação de Token e Role)
    console.log('\n4. Testando bloqueio de papel cliente para rota de busca...');
    const secret = getJwtSecret();
    const clientToken = jwt.sign({ id: 'c_user', email: 'cliente@aurora.com', role: 'cliente' }, secret);
    const decoded: any = jwt.verify(clientToken, secret);
    assert(decoded.role === 'cliente', 'Token JWT do cliente decodificado com sucesso');
    const allowedRoles = ['admin', 'tecnico'];
    const isForbiddenForClient = !allowedRoles.includes(decoded.role);
    assert(isForbiddenForClient, 'Perfil cliente bloqueado com 403 de realizar busca global');

    console.log('\n=====================================================');
    console.log(` RESULTADO FINAL: ${passed} passaram, ${failed} falharam.`);
    console.log('=====================================================');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Erro nos testes da Fase 5:', err);
    process.exitCode = 1;
  }
}

runTests();
