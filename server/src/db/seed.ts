import crypto from 'node:crypto';
import { db, initDatabase } from './database.js';
import { encryptCredential, hashSystemPassword } from '../services/crypto.js';

export async function runSeed() {
  initDatabase();

  // 1. Limpa tabelas para permitir re-seed limpo
  db.exec(`
    DELETE FROM credential_audit_logs;
    DELETE FROM credentials;
    DELETE FROM port_forwards;
    DELETE FROM entity_links;
    DELETE FROM equipments;
    DELETE FROM service_orders;
    DELETE FROM network_topology;
    DELETE FROM audit_history;
    DELETE FROM attachments;
    DELETE FROM locations;
    DELETE FROM clients;
    DELETE FROM users;
  `);

  console.log('Criando usuário padrão...');
  const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
  const passwordHash = await hashSystemPassword('admin123');
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, 'Liverton Aguiar', 'tecnico@rededoc.com', passwordHash, 'admin');

  console.log('Criando cliente Condomínio Residencial Aurora...');
  const clientId = 'cli_aurora_01';
  db.prepare(`
    INSERT INTO clients (id, name, identification_name, document, phone, email, address, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clientId,
    'Condomínio Residencial Aurora',
    'Condomínio Aurora',
    '12.345.678/0001-90',
    '(85) 3456-7890',
    'portaria@condominioaurora.com.br',
    'Rua das Flores, 120, Aldeota, Fortaleza, CE',
    'Condomínio residencial com 2 torres, guarita presencial e sistema de controle de acesso facial e automação de portões.'
  );

  console.log('Criando usuário do portal do cliente (Síndico Aurora)...');
  const portalUserId = 'usr_sindico_aurora';
  const portalPasswordHash = await hashSystemPassword('aurora123');
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, client_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(portalUserId, 'Dra. Márcia (Síndica)', 'sindico@condominioaurora.com.br', portalPasswordHash, 'cliente', clientId, 1);

  console.log('Criando local Sede Principal...');
  const locationId = 'loc_aurora_main';
  db.prepare(`
    INSERT INTO locations (id, client_id, name, address, contact_name, phone, access_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    locationId,
    clientId,
    'Guarita Principal / Rack de TI',
    'Rua das Flores, 120, Fortaleza, CE',
    'Liverton Aguiar (Síndico)',
    '(85) 98765-4321',
    'Chave do rack localizada no chaveiro da guarita com o porteiro de plantão. Acesso ao roteador ONT autorizado.'
  );

  console.log('Cadastrando equipamentos...');
  // 1. Roteador / ONT Huawei HG8145X6
  const eqOntId = 'eq_ont_01';
  db.prepare(`
    INSERT INTO equipments (
      id, client_id, location_id, name, category, manufacturer, model, serial_number,
      mac_address, physical_location, notes, local_ip, subnet_mask, gateway,
      primary_dns, secondary_dns, dhcp_range, interface_name, is_mac_reserved,
      public_wan_ip, access_url, management_port, protocol, admin_username, config_path
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `).run(
    eqOntId,
    clientId,
    locationId,
    'ONT-AURORA',
    'router_ont',
    'Huawei',
    'HG8145X6',
    '2102312ABC1234567890',
    '34:97:EB:12:34:56',
    'Guarita • Rack Superior',
    'ONT trocada pela operadora em 02/11/2026. Configuração de WAN PPPoE e LAN 192.168.1.0/24.',
    '192.168.1.1',
    '255.255.255.0',
    '192.168.1.1',
    '8.8.8.8',
    '8.8.4.4',
    '192.168.1.100-199',
    'LAN1 / PON',
    0,
    '203.0.113.45',
    'http://192.168.1.1',
    80,
    'http',
    'telecomadmin',
    'Avançado > NAT > Redirecionamento de portas'
  );

  // 2. Control iD Facial iDFace Max (Garantia vencendo em 5 dias para teste da Fase 3)
  const eqFacialId = 'eq_facial_01';
  const warrantyIn5Days = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO equipments (
      id, client_id, location_id, name, category, manufacturer, model, serial_number,
      mac_address, physical_location, notes, local_ip, subnet_mask, gateway,
      is_mac_reserved, access_url, management_port, protocol, admin_username, config_path,
      warranty_expires_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?
    )
  `).run(
    eqFacialId,
    clientId,
    locationId,
    'FACIAL-PORTARIA',
    'facial_recognition',
    'Control iD',
    'iDFace Max',
    'IDFACE-2024-9988',
    '00:1A:2B:3C:4D:5E',
    'Portaria • Pedestres',
    'Cadastro de moradores feito pelo software da administradora. Câmera de teste ok após o redirecionamento.',
    '192.168.1.50',
    '255.255.255.0',
    '192.168.1.1',
    1,
    'http://192.168.1.50',
    80,
    'http',
    'admin',
    'Configurações de Rede > IP Estático',
    warrantyIn5Days
  );

  // 3. Nice 3000 Módulo Guarita
  const eqNiceId = 'eq_nice_01';
  db.prepare(`
    INSERT INTO equipments (
      id, client_id, location_id, name, category, manufacturer, model, serial_number,
      mac_address, physical_location, notes, local_ip, subnet_mask, gateway,
      is_mac_reserved, access_url, management_port, protocol, admin_username, config_path
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `).run(
    eqNiceId,
    clientId,
    locationId,
    'NICE-PORTAO',
    'gate_module',
    'Nice',
    'Nice 3000',
    'NICE-3000-4412',
    '00:1B:44:7A:90:C1',
    'Portão de Veículos',
    'Automação de portão e módulo guarita para recepção de acionamentos e tags veiculares.',
    '192.168.1.60',
    '255.255.255.0',
    '192.168.1.1',
    1,
    'http://192.168.1.60:8000',
    8000,
    'http',
    'guarita',
    'Comunicação > Módulo de Rede'
  );

  // 4. DVR Hikvision HiLook
  const eqDvrId = 'eq_dvr_01';
  db.prepare(`
    INSERT INTO equipments (
      id, client_id, location_id, name, category, manufacturer, model, serial_number,
      mac_address, physical_location, notes, local_ip, subnet_mask, gateway,
      is_mac_reserved, access_url, management_port, protocol, admin_username, config_path
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `).run(
    eqDvrId,
    clientId,
    locationId,
    'DVR-HILOOK',
    'dvr_nvr',
    'HiLook / Hikvision',
    'DVR-216Q-K1',
    'HILOOK-216Q-88992',
    '00:1C:55:8E:21:F4',
    'Rack Guarita',
    'DVR de 16 canais das câmeras perimetrais e áreas comuns. Três portas redirecionadas para acesso web, servidor e RTSP.',
    '192.168.1.70',
    '255.255.255.0',
    '192.168.1.1',
    1,
    'http://192.168.1.70:80',
    80,
    'http',
    'admin',
    'Rede > Avançado > Mais Configurações'
  );

  console.log('Cadastrando regras de redirecionamento de portas (NAT)...');
  const portForwards = [
    {
      id: 'pf_01',
      equipment_id: eqFacialId,
      service_name: 'Facial web',
      source_wan_ip: '203.0.113.45',
      external_port: 8050,
      destination_local_ip: '192.168.1.50',
      internal_port: 80,
      protocol: 'TCP',
      router_config_path: 'Avançado > NAT > Redirecionamento de portas',
      status: 'funcionando',
      notes: 'Interface web do Control iD Facial para cadastro remoto.'
    },
    {
      id: 'pf_02',
      equipment_id: eqNiceId,
      service_name: 'Nice guarita',
      source_wan_ip: '203.0.113.45',
      external_port: 8060,
      destination_local_ip: '192.168.1.60',
      internal_port: 8000,
      protocol: 'TCP',
      router_config_path: 'Avançado > NAT > Redirecionamento de portas',
      status: 'funcionando',
      notes: 'Comunicação do software de monitoramento com o módulo Nice 3000.'
    },
    {
      id: 'pf_03',
      equipment_id: eqDvrId,
      service_name: 'DVR web',
      source_wan_ip: '203.0.113.45',
      external_port: 8070,
      destination_local_ip: '192.168.1.70',
      internal_port: 80,
      protocol: 'TCP',
      router_config_path: 'Avançado > NAT > Redirecionamento de portas',
      status: 'funcionando',
      notes: 'Visualização web e configuração do DVR HiLook.'
    },
    {
      id: 'pf_04',
      equipment_id: eqDvrId,
      service_name: 'DVR servidor',
      source_wan_ip: '203.0.113.45',
      external_port: 8071,
      destination_local_ip: '192.168.1.70',
      internal_port: 8000,
      protocol: 'TCP',
      router_config_path: 'Avançado > NAT > Redirecionamento de portas',
      status: 'funcionando',
      notes: 'Porta de dados do app HiLookVision e CMS IVMS-4200.'
    },
    {
      id: 'pf_05',
      equipment_id: eqDvrId,
      service_name: 'DVR rtsp',
      source_wan_ip: '203.0.113.45',
      external_port: 8072,
      destination_local_ip: '192.168.1.70',
      internal_port: 554,
      protocol: 'TCP/UDP',
      router_config_path: 'Avançado > NAT > Redirecionamento de portas',
      status: 'com_falha',
      notes: 'Fluxo RTSP para gravação externa em nuvem. Porta bloqueada na operadora.'
    }
  ];

  for (const pf of portForwards) {
    db.prepare(`
      INSERT INTO port_forwards (
        id, client_id, location_id, equipment_id, service_name, source_wan_ip,
        external_port, destination_local_ip, internal_port, protocol,
        router_config_path, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      pf.id, clientId, locationId, pf.equipment_id, pf.service_name, pf.source_wan_ip,
      pf.external_port, pf.destination_local_ip, pf.internal_port, pf.protocol,
      pf.router_config_path, pf.status, pf.notes
    );
  }

  console.log('Criptografando e armazenando credenciais no cofre seguro (AES-256-GCM)...');
  const credentials = [
    {
      id: 'cred_ont_01',
      equipment_id: eqOntId,
      name: 'Admin ONT Huawei',
      category: 'roteador',
      username: 'telecomadmin',
      plainPass: 'admintelecom@2026',
      access_url: 'http://192.168.1.1',
      port: 80,
      notes: 'Credencial master de operadora para gerenciamento da ONT HG8145X6.'
    },
    {
      id: 'cred_facial_01',
      equipment_id: eqFacialId,
      name: 'Admin Facial Control iD',
      category: 'controle_acesso',
      username: 'admin',
      plainPass: 'IdFace@Aurora#2026',
      access_url: 'http://192.168.1.50',
      port: 80,
      notes: 'Acesso administrador ao terminal facial iDFace Max.'
    },
    {
      id: 'cred_nice_01',
      equipment_id: eqNiceId,
      name: 'Módulo Nice 3000',
      category: 'automacao',
      username: 'guarita',
      plainPass: 'NiceGuarita*99',
      access_url: 'http://192.168.1.60:8000',
      port: 8000,
      notes: 'Usuário operador do módulo receptor Nice 3000.'
    },
    {
      id: 'cred_dvr_01',
      equipment_id: eqDvrId,
      name: 'Admin DVR HiLook',
      category: 'cftv',
      username: 'admin',
      plainPass: 'HiLookCam$2026',
      access_url: 'http://192.168.1.70',
      port: 80,
      notes: 'Credencial administrativa do DVR 16 canais.'
    }
  ];

  for (const c of credentials) {
    const enc = encryptCredential(c.plainPass);
    db.prepare(`
      INSERT INTO credentials (
        id, client_id, equipment_id, name, category, username,
        encrypted_password, iv, auth_tag, access_url, port, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      c.id, clientId, c.equipment_id, c.name, c.category, c.username,
      enc.encryptedPassword, enc.iv, enc.authTag, c.access_url, c.port, c.notes
    );
  }

  console.log('Criando atendimento técnico de referência...');
  const serviceOrderId = 'so_aurora_01';
  db.prepare(`
    INSERT INTO service_orders (
      id, client_id, location_id, technician_name, date_time, service_type,
      problem_description, status, equipments_involved, changes_made,
      tests_performed, test_results, technical_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    serviceOrderId,
    clientId,
    locationId,
    'Liverton Aguiar',
    '2026-11-02 22:30',
    'Troca de Roteador/ONT e Redirecionamento de Portas',
    'ONT antiga da operadora danificada após tempestade. Necessária reinstalação e reconfiguração total de sub-rede e regras de NAT.',
    'concluido',
    JSON.stringify([eqOntId, eqFacialId, eqNiceId, eqDvrId]),
    'Substituída ONT por modelo Huawei HG8145X6. Reconfigurada sub-rede para 192.168.1.0/24 (Gateway 192.168.1.1). Criadas 3 reservas de IP via MAC. Reconfigurados 5 redirecionamentos de porta.',
    'Validados acessos externos às portas 8050, 8060, 8070, 8071 e 8072.',
    'Portas 8050 (Facial), 8060 (Nice), 8070 (DVR Web) e 8071 (DVR Servidor) funcionando perfeitamente. Porta 8072 (RTSP) apresentou bloqueio na operadora.',
    'Roteador/ONT trocada pela operadora em 02/11. Facial web: Cadastro feito pelo software da administradora. Backup do arquivo de configuração do roteador gerado.'
  );

  console.log('Criando histórico técnico de alterações...');
  const auditEntries = [
    {
      action: 'SUBSTITUICAO',
      entity_type: 'equipment',
      entity_name: 'ONT / Roteador',
      field_name: 'Modelo',
      old_val: 'ZTE F670L',
      new_val: 'Huawei HG8145X6'
    },
    {
      action: 'ALTERACAO_IP',
      entity_type: 'equipment',
      entity_name: 'ONT-AURORA',
      field_name: 'IP WAN',
      old_val: '187.60.22.10',
      new_val: '203.0.113.45'
    },
    {
      action: 'RESERVA_MAC',
      entity_type: 'equipment',
      entity_name: 'FACIAL-PORTARIA',
      field_name: 'MAC Bind',
      old_val: 'DHCP Dinâmico',
      new_val: '00:1A:2B:3C:4D:5E -> 192.168.1.50'
    },
    {
      action: 'PORT_FORWARD',
      entity_type: 'port_forward',
      entity_name: 'Facial web',
      field_name: 'Regra NAT',
      old_val: 'Inexistente',
      new_val: 'WAN 8050 -> 192.168.1.50:80 (TCP)'
    }
  ];

  for (const a of auditEntries) {
    db.prepare(`
      INSERT INTO audit_history (
        id, client_id, location_id, equipment_id, service_order_id,
        user_name, action, entity_type, entity_name, field_name, old_value, new_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'aud_' + crypto.randomUUID().slice(0, 8),
      clientId,
      locationId,
      eqOntId,
      serviceOrderId,
      'Liverton Aguiar',
      a.action,
      a.entity_type,
      a.entity_name,
      a.field_name,
      a.old_val,
      a.new_val
    );
  }

  console.log('Cadastrando anexo técnico de exemplo...');
  db.prepare(`
    INSERT INTO attachments (
      id, client_id, location_id, equipment_id, service_order_id,
      file_name, original_name, mime_type, file_size, file_path, category, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'att_config_01',
    clientId,
    locationId,
    eqOntId,
    serviceOrderId,
    'config-roteador.bin',
    'config-roteador.bin',
    'application/octet-stream',
    20480, // 20 KB
    'uploads/config-roteador.bin',
    'config_file',
    'Backup binário da configuração da ONT Huawei HG8145X6 gerado após a homologação das portas.'
  );

  console.log('Configurando topologia visual...');
  const nodes = [
    {
      id: 'internet',
      label: 'Internet',
      ip: '203.0.113.45',
      type: 'internet',
      x: 350,
      y: 80
    },
    {
      id: eqOntId,
      label: 'ONT-AURORA',
      sublabel: 'Huawei HG8145X6',
      ip: '192.168.1.1',
      type: 'router',
      x: 350,
      y: 220
    },
    {
      id: eqDvrId,
      label: 'DVR-HILOOK',
      sublabel: 'HiLook DVR-216Q-K1',
      ip: '192.168.1.70',
      type: 'dvr',
      x: 120,
      y: 360,
      portBadge: '8070 -> 80 +2',
      status: 'com_falha'
    },
    {
      id: eqFacialId,
      label: 'FACIAL-PORTARIA',
      sublabel: 'Control iD iDFace Max',
      ip: '192.168.1.50',
      type: 'facial',
      x: 350,
      y: 360,
      portBadge: '8050 -> 80',
      status: 'funcionando'
    },
    {
      id: eqNiceId,
      label: 'NICE-PORTAO',
      sublabel: 'Nice 3000',
      ip: '192.168.1.60',
      type: 'gate',
      x: 580,
      y: 360,
      portBadge: '8060 -> 8000',
      status: 'funcionando'
    }
  ];

  const edges = [
    { from: 'internet', to: eqOntId, label: 'WAN' },
    { from: eqOntId, to: eqDvrId, label: 'LAN 1' },
    { from: eqOntId, to: eqFacialId, label: 'LAN 2' },
    { from: eqOntId, to: eqNiceId, label: 'LAN 3' }
  ];

  db.prepare(`
    INSERT INTO network_topology (id, client_id, location_id, nodes_data, edges_data, view_mode)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'topo_aurora',
    clientId,
    locationId,
    JSON.stringify(nodes),
    JSON.stringify(edges),
    'detailed'
  );

  console.log('Criando vínculos manuais de exemplo (entity_links)...');
  db.prepare(`
    INSERT INTO entity_links (id, client_id, source_type, source_id, target_type, target_id, label, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'link_aurora_01',
    clientId,
    'equipment',
    eqFacialId,
    'equipment',
    eqOntId,
    'Conexão física via porta LAN 2 da ONT',
    'Liverton Aguiar'
  );

  console.log('Criando domínio demonstrativo da Fase 7 (domains)...');
  const domAuroraId = 'dom_aurora_01';
  db.prepare(`
    INSERT INTO domains (
      id, client_id, name, registrar, auto_check,
      ssl_expires_at, ssl_issuer, expires_at, score, notes, dns_snapshot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    domAuroraId,
    clientId,
    'aurora-condominio.ddns.net',
    'No-IP Managed DNS',
    1,
    new Date(Date.now() + 65 * 86400000).toISOString().slice(0, 10), // SSL em 65 dias
    "Let's Encrypt Authority X3",
    new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10), // Expira em 180 dias
    85,
    'Hostname dinâmico para acesso externo às câmeras do CFTV e portaria',
    JSON.stringify({
      a_records: ['200.180.45.10'],
      ns_records: ['nf1.no-ip.com', 'nf2.no-ip.com'],
      txt_records: ['v=spf1 include:_spf.google.com ~all'],
      spf: 'v=spf1 include:_spf.google.com ~all',
      dmarc: 'v=DMARC1; p=none; rua=mailto:dmarc@aurora.com.br',
      ssl: {
        valid_to: new Date(Date.now() + 65 * 86400000).toISOString().slice(0, 10),
        issuer: "Let's Encrypt Authority X3",
        days_remaining: 65,
        valid: true
      },
      ddns_status: {
        is_ddns: true,
        resolved_ip: '200.180.45.10',
        expected_wan_ip: '200.180.45.10',
        mismatch: false
      }
    })
  );

  console.log('Criando sub-rede demonstrativa da Fase 6 (subnets)...');
  const subAuroraId = 'sub_aurora_01';
  db.prepare(`
    INSERT INTO subnets (
      id, client_id, location_id, name, cidr, gateway, vlan, dhcp_start, dhcp_end, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    subAuroraId,
    clientId,
    locationId,
    'LAN Principal (Guarita & CFTV)',
    '192.168.1.0/24',
    '192.168.1.1',
    '1',
    '192.168.1.100',
    '192.168.1.200',
    'Rede interna principal dos equipamentos de segurança do Condomínio Aurora'
  );

  console.log('Seed concluído com sucesso!');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed().catch(err => {
    console.error('Erro ao executar seed:', err);
    process.exit(1);
  });
}
