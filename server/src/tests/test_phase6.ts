import { initDatabase, queryAll, queryOne, execute } from '../db/database.js';
import {
  parseCidr,
  ipToLong,
  longToIp,
  isIpInSubnet,
  isIpInDhcpRange,
  getSubnetUsage,
  detectClientIpConflicts,
  suggestSubnetsForClient
} from '../services/ipam.js';

console.log('=====================================================');
console.log(' TESTE AUTOMATIZADO — CRITÉRIOS DE ACEITE DA FASE 6');
console.log(' IPAM Simples por Cliente e Detecção de Conflitos');
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
    // 1. Critério 1: Matemática de Rede IPv4 (parseCidr, ipToLong, longToIp)
    console.log('\n1. Testando cálculos matemáticos de rede IPv4...');
    const cidr24 = parseCidr('192.168.1.0/24');
    assert(cidr24.networkIp === '192.168.1.0', 'Endereço de rede calculado como 192.168.1.0');
    assert(cidr24.firstUsableIp === '192.168.1.1', 'Primeiro IP utilizável: 192.168.1.1');
    assert(cidr24.lastUsableIp === '192.168.1.254', 'Último IP utilizável: 192.168.1.254');
    assert(cidr24.broadcastIp === '192.168.1.255', 'Endereço de broadcast: 192.168.1.255');
    assert(cidr24.totalHosts === 254, 'Total de hosts utilizáveis: 254');

    const inSubnet = isIpInSubnet('192.168.1.50', '192.168.1.0/24');
    const outSubnet = isIpInSubnet('10.0.0.1', '192.168.1.0/24');
    assert(inSubnet === true, '192.168.1.50 reconhecido como dentro de 192.168.1.0/24');
    assert(outSubnet === false, '10.0.0.1 reconhecido como fora de 192.168.1.0/24');

    const inDhcp = isIpInDhcpRange('192.168.1.150', '192.168.1.100', '192.168.1.200');
    const outDhcp = isIpInDhcpRange('192.168.1.50', '192.168.1.100', '192.168.1.200');
    assert(inDhcp === true, '192.168.1.150 detectado dentro da faixa DHCP 100-200');
    assert(outDhcp === false, '192.168.1.50 detectado fora da faixa DHCP 100-200');

    // 2. Critério 2: Criação de Sub-rede no Banco e Ocupação Exata
    console.log('\n2. Testando criação de sub-rede e cálculo de ocupação...');
    const client = queryOne<any>('SELECT id FROM clients LIMIT 1');
    if (!client) throw new Error('Cliente de teste ausente.');

    const subnetId = `sub_test_${Date.now()}`;
    execute(`
      INSERT INTO subnets (
        id, client_id, name, cidr, gateway, vlan, dhcp_start, dhcp_end, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      subnetId,
      client.id,
      'LAN Teste IPAM',
      '192.168.1.0/24',
      '192.168.1.1',
      '1',
      '192.168.1.100',
      '192.168.1.200',
      'Sub-rede de testes do IPAM'
    );

    const usage = getSubnetUsage(subnetId);
    assert(usage !== undefined, 'getSubnetUsage executou com sucesso');
    assert(usage.stats.totalHosts === 254, 'totalHosts bate com a capacidade da máscara /24 (254)');
    assert(usage.stats.usedHosts >= 2, `usedHosts calculou equipamentos alocados na rede (encontrados: ${usage.stats.usedHosts})`);
    assert(typeof usage.nextFreeIp === 'string' && usage.nextFreeIp !== '', `Próximo IP livre sugerido: ${usage.nextFreeIp}`);

    // Verifica que o gateway está marcado
    const gwSlot = usage.slots.find(s => s.ip === '192.168.1.1');
    assert(gwSlot?.status === 'gateway', 'Slot 192.168.1.1 identificado como Gateway da rede');

    // 3. Critério 3: Detecção de Conflito por IP Duplicado
    console.log('\n3. Testando detecção de IP duplicado entre equipamentos...');
    const testEq1Id = `eq_dup_1_${Date.now()}`;
    const testEq2Id = `eq_dup_2_${Date.now()}`;
    const duplicateIp = '192.168.1.88';

    execute(`
      INSERT INTO equipments (id, client_id, location_id, name, category, local_ip)
      VALUES (?, ?, (SELECT id FROM locations WHERE client_id = ? LIMIT 1), 'Camera Portao Teste 1', 'cctv_camera', ?)
    `, testEq1Id, client.id, client.id, duplicateIp);

    execute(`
      INSERT INTO equipments (id, client_id, location_id, name, category, local_ip)
      VALUES (?, ?, (SELECT id FROM locations WHERE client_id = ? LIMIT 1), 'Camera Guarita Teste 2', 'cctv_camera', ?)
    `, testEq2Id, client.id, client.id, duplicateIp);

    const conflicts = detectClientIpConflicts(client.id);
    const foundDup = conflicts.duplicates.find(d => d.ip === duplicateIp);
    assert(foundDup !== undefined, 'Conflito de IP duplicado detectado com sucesso');
    assert(foundDup?.equipments.length === 2, 'Dois equipamentos associados ao mesmo IP');

    // 4. Critério 4: Sugestão automática de sub-redes
    console.log('\n4. Testando sugestão de sub-redes baseada nos equipamentos...');
    const suggestions = suggestSubnetsForClient(client.id);
    assert(Array.isArray(suggestions) && suggestions.length > 0, 'Sugestão de sub-redes gerada');
    const lan192 = suggestions.find(s => s.cidr === '192.168.1.0/24');
    assert(lan192 !== undefined, 'Faixa 192.168.1.0/24 sugerida com sucesso a partir dos equipamentos existentes');

    // Limpeza
    execute('DELETE FROM equipments WHERE id IN (?, ?)', testEq1Id, testEq2Id);
    execute('DELETE FROM subnets WHERE id = ?', subnetId);
    console.log('\nDados de teste limpos com sucesso.');

    console.log('\n=====================================================');
    console.log(` RESULTADO FINAL: ${passed} passaram, ${failed} falharam.`);
    console.log('=====================================================');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Erro nos testes da Fase 6:', err);
    process.exitCode = 1;
  }
}

runTests();
