import { DatabaseSync, StatementSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Suporte transparente ao banco existente ou novo arquivo itfy.sqlite
const dbFileName = process.env.DB_NAME || (
  fs.existsSync(path.join(dataDir, 'rededoc.sqlite')) && !fs.existsSync(path.join(dataDir, 'itfy.sqlite'))
    ? 'rededoc.sqlite'
    : 'itfy.sqlite'
);
const dbPath = path.join(dataDir, dbFileName);
export const db = new DatabaseSync(dbPath);

// Configuração de performance e integridade
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export type SqlParam = string | number | bigint | null | Buffer;

function sanitizeParam(param: any): SqlParam {
  if (param === undefined || param === null) return null;
  if (typeof param === 'number' || typeof param === 'string' || typeof param === 'bigint') return param;
  if (Buffer.isBuffer(param)) return param;
  return String(param);
}

export function queryAll<T = any>(sql: string, ...params: any[]): T[] {
  const sanitized = params.map(sanitizeParam);
  return (db.prepare(sql) as any).all(...sanitized) as T[];
}

export function queryOne<T = any>(sql: string, ...params: any[]): T | undefined {
  const sanitized = params.map(sanitizeParam);
  return (db.prepare(sql) as any).get(...sanitized) as T | undefined;
}

export function execute(sql: string, ...params: any[]): any {
  const sanitized = params.map(sanitizeParam);
  return (db.prepare(sql) as any).run(...sanitized);
}

export function initDatabase() {
  db.exec(`
    -- Tabela de Usuários do Sistema
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'tecnico',
      client_id TEXT REFERENCES clients(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabela de Clientes
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      identification_name TEXT NOT NULL,
      document TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabela de Locais / Condomínios / Unidades
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      access_notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    -- Tabela de Equipamentos
    CREATE TABLE IF NOT EXISTS equipments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      manufacturer TEXT,
      model TEXT,
      serial_number TEXT,
      mac_address TEXT,
      physical_location TEXT,
      photo_url TEXT,
      notes TEXT,
      -- Rede e Conectividade
      local_ip TEXT,
      subnet_mask TEXT DEFAULT '255.255.255.0',
      gateway TEXT,
      primary_dns TEXT DEFAULT '8.8.8.8',
      secondary_dns TEXT DEFAULT '8.8.4.4',
      dhcp_range TEXT,
      interface_name TEXT,
      vlan TEXT,
      is_mac_reserved INTEGER DEFAULT 0,
      public_wan_ip TEXT,
      -- Gerenciamento
      access_url TEXT,
      management_port INTEGER,
      protocol TEXT DEFAULT 'http',
      admin_username TEXT,
      config_path TEXT,
      access_notes TEXT,
      internal_notes TEXT,
      additional_info TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    );

    -- Tabela de Catálogo / Banco de Equipamentos (Templates Pré-configurados)
    CREATE TABLE IF NOT EXISTS equipment_catalog (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      default_management_port INTEGER DEFAULT 80,
      default_protocol TEXT DEFAULT 'http',
      default_username TEXT DEFAULT 'admin',
      default_config_path TEXT,
      default_ports TEXT, -- JSON com portas comuns recomendadas
      photo_url TEXT,
      notes TEXT,
      is_builtin INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabela de Redirecionamento de Portas (NAT)
    CREATE TABLE IF NOT EXISTS port_forwards (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      source_wan_ip TEXT NOT NULL,
      external_port INTEGER NOT NULL,
      destination_local_ip TEXT NOT NULL,
      internal_port INTEGER NOT NULL,
      protocol TEXT NOT NULL DEFAULT 'TCP',
      router_config_path TEXT,
      status TEXT NOT NULL DEFAULT 'nao_testada',
      service_order_id TEXT,
      notes TEXT,
      internal_notes TEXT,
      additional_info TEXT,
      configured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipments(id) ON DELETE CASCADE
    );

    -- Tabela do Cofre de Credenciais (Criptografia AES-256-GCM)
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      equipment_id TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'equipamento',
      username TEXT NOT NULL,
      encrypted_password TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      access_url TEXT,
      port INTEGER,
      notes TEXT,
      last_changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipments(id) ON DELETE SET NULL
    );

    -- Tabela de Auditoria de Acesso a Credenciais
    CREATE TABLE IF NOT EXISTS credential_audit_logs (
      id TEXT PRIMARY KEY,
      credential_id TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE CASCADE
    );

    -- Tabela de Atendimentos Técnicos (Ordens de Serviço)
    CREATE TABLE IF NOT EXISTS service_orders (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      technician_id TEXT,
      technician_name TEXT NOT NULL,
      date_time TEXT NOT NULL,
      service_type TEXT NOT NULL,
      problem_description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'em_andamento',
      equipments_involved TEXT,
      changes_made TEXT,
      tests_performed TEXT,
      test_results TEXT,
      technical_notes TEXT,
      service_cost REAL DEFAULT 0,
      time_spent_minutes INTEGER DEFAULT 0,
      additional_info TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    );

    -- Tabela de Topologia de Rede Visual (Layout Persistido)
    CREATE TABLE IF NOT EXISTS network_topology (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      nodes_data TEXT NOT NULL DEFAULT '[]',
      edges_data TEXT NOT NULL DEFAULT '[]',
      view_mode TEXT NOT NULL DEFAULT 'detailed',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
      UNIQUE(client_id, location_id)
    );

    -- Tabela de Histórico Técnico Geral (Auditoria de Mudanças)
    CREATE TABLE IF NOT EXISTS audit_history (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      location_id TEXT,
      equipment_id TEXT,
      service_order_id TEXT,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    -- Tabela de Anexos e Fotografias
    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      location_id TEXT,
      equipment_id TEXT,
      service_order_id TEXT,
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'documento',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    -- Índices para buscas rápidas
    CREATE INDEX IF NOT EXISTS idx_equipments_client ON equipments(client_id);
    CREATE INDEX IF NOT EXISTS idx_equipments_location ON equipments(location_id);
    CREATE INDEX IF NOT EXISTS idx_equipments_local_ip ON equipments(local_ip);
    CREATE INDEX IF NOT EXISTS idx_equipments_mac ON equipments(mac_address);
    CREATE INDEX IF NOT EXISTS idx_port_forwards_client ON port_forwards(client_id);
    CREATE INDEX IF NOT EXISTS idx_port_forwards_equipment ON port_forwards(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_port_forwards_ext_port ON port_forwards(source_wan_ip, external_port, protocol);
    CREATE INDEX IF NOT EXISTS idx_credentials_client ON credentials(client_id);
    CREATE INDEX IF NOT EXISTS idx_credentials_equipment ON credentials(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_service_orders_client ON service_orders(client_id);
    CREATE INDEX IF NOT EXISTS idx_audit_history_client ON audit_history(client_id);
    CREATE INDEX IF NOT EXISTS idx_equipment_catalog_cat ON equipment_catalog(category);
    CREATE INDEX IF NOT EXISTS idx_equipment_catalog_manuf ON equipment_catalog(manufacturer);
  `);

  // Migrações incrementais seguras
  try {
    db.exec('ALTER TABLE clients ADD COLUMN address TEXT;');
  } catch {
    // Coluna address já existe
  }

  // Migrações para suporte a histórico financeiro, tempo gasto e campos adicionais
  try { db.exec('ALTER TABLE service_orders ADD COLUMN service_cost REAL DEFAULT 0;'); } catch {}
  try { db.exec('ALTER TABLE service_orders ADD COLUMN time_spent_minutes INTEGER DEFAULT 0;'); } catch {}
  try { db.exec('ALTER TABLE service_orders ADD COLUMN additional_info TEXT;'); } catch {}

  try { db.exec('ALTER TABLE equipments ADD COLUMN internal_notes TEXT;'); } catch {}
  try { db.exec('ALTER TABLE equipments ADD COLUMN additional_info TEXT;'); } catch {}

  try { db.exec('ALTER TABLE port_forwards ADD COLUMN internal_notes TEXT;'); } catch {}
  try { db.exec('ALTER TABLE port_forwards ADD COLUMN additional_info TEXT;'); } catch {}

  // Padronização de papéis (technician -> tecnico) e client_id para usuários do portal
  try { db.exec("UPDATE users SET role = 'tecnico' WHERE role = 'technician';"); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN client_id TEXT REFERENCES clients(id);'); } catch {}

  // Atualiza atendimentos existentes com valores e tempo gasto realistas de demonstração
  try {
    db.exec(`
      UPDATE service_orders
      SET service_cost = 380.00,
          time_spent_minutes = 105,
          additional_info = 'Substituição de roteador ONT fornecido pela operadora e remapeamento de 5 portas de guarita e CFTV. Cliente faturado à vista.'
      WHERE service_cost IS NULL OR service_cost = 0;
    `);
  } catch {}

  // Popula catálogo padrão de equipamentos se estiver vazio
  seedEquipmentCatalog();

  console.log('Banco de dados inicializado com sucesso.');
}

function seedEquipmentCatalog() {
  const catalogItems = [
    {
      id: 'cat_huawei_hg8145x6',
      name: 'Huawei HG8145X6 (ONT GPON Wi-Fi 6)',
      category: 'router_ont',
      manufacturer: 'Huawei',
      model: 'HG8145X6',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'telecomadmin',
      default_config_path: 'Avançado > Mapeamento de Portas (NAT) / LAN Host',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=300&auto=format&fit=crop&q=80',
      notes: 'ONT GPON Wi-Fi 6 AX3000 de alta performance com portas Gigabit e reserva de IP por MAC.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idface_max',
      name: 'Control iD iDFace Max (Reconhecimento Facial)',
      category: 'facial_access',
      manufacturer: 'Control iD',
      model: 'iDFace Max',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Configurações > Rede / Servidor da Nuvem (Condfy Push API)',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' },
        { service_name: 'Gerenciamento Web HTTPS', internal_port: 443, protocol: 'TCP' },
        { service_name: 'Interfonia SIP / Chamadas', internal_port: 5060, protocol: 'UDP' }
      ]),
      photo_url: '/uploads/controlid_idface_max.webp',
      notes: 'Terminal de Reconhecimento Facial com display IPS de 7", tela touch e câmera dupla com IA anti-fraude (live detection). Totalmente integrado com Condfy para cadastro facial remoto via App/WhatsApp e liberação de portas de condomínios.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idface',
      name: 'Control iD iDFace (Reconhecimento Facial)',
      category: 'facial_access',
      manufacturer: 'Control iD',
      model: 'iDFace',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Configurações > Nuvem / Servidor de Eventos (Condfy)',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' },
        { service_name: 'Interfonia SIP', internal_port: 5060, protocol: 'UDP' }
      ]),
      photo_url: '/uploads/controlid_idface.webp',
      notes: 'Leitor Facial Inteligente com display touch de 3.5", câmera dupla com infravermelho, leitor RFID e QR Code. Apontado para a plataforma Condfy via push API ou rede local.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idbell',
      name: 'Control iD iDBell (Vídeo Porteiro e Interfonia IP)',
      category: 'facial_access',
      manufacturer: 'Control iD',
      model: 'iDBell',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Rede > SIP / Servidor de Vídeo e Interfonia Condfy',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' },
        { service_name: 'Interfonia SIP Condfy', internal_port: 5060, protocol: 'UDP' },
        { service_name: 'Stream de Vídeo RTSP', internal_port: 554, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_idbell.webp',
      notes: 'Controlador de acesso com vídeo porteiro IP e câmera Full HD. Conecta-se à portaria virtual Condfy para atendimento de chamadas pelo app e liberação de pedestres.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idflex_ip65',
      name: 'Control iD iDFlex IP65 (Biometria Digital e Cartão)',
      category: 'facial_access',
      manufacturer: 'Control iD',
      model: 'iDFlex IP65',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Comunicação > Servidor Web / API Condfy',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_idflex_ip65.webp',
      notes: 'Controlador biométrico com proteção IP65 para intempéries e áreas externas. Display touch 2.4", relé embutido e comunicação TCP/IP integrada com a plataforma Condfy.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idflex',
      name: 'Control iD iDFlex (Biometria e Proximidade)',
      category: 'facial_access',
      manufacturer: 'Control iD',
      model: 'iDFlex',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Comunicação > Servidor Web / API Condfy',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_idflex.webp',
      notes: 'Controlador de acesso biométrico para ambientes internos, áreas comuns e academias de condomínios.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idaccess_pro',
      name: 'Control iD iDAccess Pro (Biometria Touchscreen)',
      category: 'facial_access',
      manufacturer: 'Control iD',
      model: 'iDAccess Pro',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Configuração > Modo Servidor / Push API',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_idaccess_pro.webp',
      notes: 'Controlador biométrico capacitivo com tela touch de 3.5" e leitor de proximidade. Sincronização em tempo real de cadastros e registros com o Condfy.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idaccess_nano',
      name: 'Control iD iDAccess Nano (Biometria Compacta)',
      category: 'facial_access',
      manufacturer: 'Control iD',
      model: 'iDAccess Nano',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Configuração > Rede / API',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_idaccess_nano.webp',
      notes: 'Controlador de acesso biométrico ultrafino para batentes e portas internas de condomínios.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idfit_4x2',
      name: 'Control iD iDFit (Embutir Caixa 4x2)',
      category: 'facial_access',
      manufacturer: 'Control iD',
      model: 'iDFit 4x2',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Rede > Servidor API Condfy',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_idfit_4x2.webp',
      notes: 'Controlador de acesso compacto para caixa 4x2 com biometria digital e leitor RFID.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idbox_v2',
      name: 'Control iD iDBox V2 (Controladora Central 4 Portas)',
      category: 'module_gate',
      manufacturer: 'Control iD',
      model: 'iDBox V2',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Portas 1-4 > Comunicação Wiegand / Relés e Sensores Condfy',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' },
        { service_name: 'Gerenciamento Web HTTPS', internal_port: 443, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_idbox_v2.webp',
      notes: 'Controladora de acesso central multi-portas para até 4 portas/portões simultâneos com suporte a leitores externos, botoeiras e sensores. Integrada ao Condfy para liberação de clausuras e garagens.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_iduhf',
      name: 'Control iD iDUHF (Antena Leitora Veicular Longo Alcance)',
      category: 'module_gate',
      manufacturer: 'Control iD',
      model: 'iDUHF',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Antena UHF > Potência / Conexão de Rede Condfy',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_iduhf.webp',
      notes: 'Leitor veicular UHF de longo alcance (até 15m) com controladora integrada. Conecta-se à plataforma Condfy para abertura automática de portões veiculares.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_iduhf_lite',
      name: 'Control iD iDUHF Lite (Antena Veicular Compacta)',
      category: 'module_gate',
      manufacturer: 'Control iD',
      model: 'iDUHF Lite',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Rede > Servidor de Eventos Condfy',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_iduhf_lite.webp',
      notes: 'Antena leitora veicular UHF com alcance de até 6m para garagens de condomínios.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idblock_next_idface',
      name: 'Control iD iDBlock Next com iDFace (Catraca Facial)',
      category: 'module_gate',
      manufacturer: 'Control iD',
      model: 'iDBlock Next iDFace',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Catraca > Giro / Mecanismo / Sincronismo Condfy',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_idblock_idface.webp',
      notes: 'Catraca pedestal de alto fluxo com leitor facial iDFace integrado. Homologada no Condfy para controle de portaria social e áreas de lazer.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idblock_balcao_idface',
      name: 'Control iD iDBlock Balcão com iDFace (Catraca Balcão)',
      category: 'module_gate',
      manufacturer: 'Control iD',
      model: 'iDBlock Balcão iDFace',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Catraca > Mecanismo / Sincronismo Condfy',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_idblock_balcao.webp',
      notes: 'Catraca tipo balcão com leitor facial para portarias nobres de edifícios e condomínios.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idblock_pcd_idface',
      name: 'Control iD iDBlock PcD (Portão Motorizado com iDFace)',
      category: 'module_gate',
      manufacturer: 'Control iD',
      model: 'iDBlock PcD iDFace',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Portão Motorizado PcD > Sincronismo Condfy',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_idblock_pcd.webp',
      notes: 'Portão oscilante para acessibilidade PcD com leitor facial acoplado.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idconnect_v2',
      name: 'Control iD iDConnect v2 (Módulo Wi-Fi para Ethernet)',
      category: 'router_ont',
      manufacturer: 'Control iD',
      model: 'iDConnect v2',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Wi-Fi > Conexão com Ponto de Acesso / IP Fixo',
      default_ports: JSON.stringify([
        { service_name: 'Gerenciamento Web HTTP', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '/uploads/controlid_idconnect_v2.webp',
      notes: 'Roteador sem fio para converter Wi-Fi em Ethernet para equipamentos de acesso da Control iD sem cabeamento estruturado.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_qrcode_wiegand',
      name: 'Control iD Leitor QR Code Wiegand (Acesso de Visitantes)',
      category: 'facial_access',
      manufacturer: 'Control iD',
      model: 'Leitor QR Code Wiegand',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Conexão Wiegand com Controladora iDBox / Guarita',
      default_ports: JSON.stringify([]),
      photo_url: '/uploads/controlid_qrcode_wiegand.webp',
      notes: 'Leitor de QR Code para convites virtuais gerados pelo aplicativo Condfy para visitantes e prestadores.',
      is_builtin: 1
    },
    {
      id: 'cat_controlid_idprox_compact',
      name: 'Control iD iDProx Compact (Leitor RFID Proximidade)',
      category: 'facial_access',
      manufacturer: 'Control iD',
      model: 'iDProx Compact',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Conexão Wiegand com iDBox / iDFlex',
      default_ports: JSON.stringify([]),
      photo_url: '/uploads/controlid_idprox_compact.webp',
      notes: 'Leitor escravo de cartões e chaveiros RFID/Mifare para saídas de clausuras e portas de serviço.',
      is_builtin: 1
    },
    {
      id: 'cat_nice_3000',
      name: 'Nice 3000 (Módulo Guarita HCS)',
      category: 'module_gate',
      manufacturer: 'Nice',
      model: 'Nice 3000',
      default_management_port: 8000,
      default_protocol: 'tcp',
      default_username: 'guarita',
      default_config_path: 'Porta de Comunicação do Software da Portaria: 8000 (TCP)',
      default_ports: JSON.stringify([
        { service_name: 'Comunicação Módulo Guarita', internal_port: 8000, protocol: 'TCP' }
      ]),
      photo_url: '',
      notes: 'Módulo de guarita para controle de portões de veículos e receptores de controle Linear-HCS.',
      is_builtin: 1
    },
    {
      id: 'cat_hilook_dvr216q',
      name: 'HiLook DVR-216Q-K1 (Gravador 16 Canais)',
      category: 'dvr_nvr',
      manufacturer: 'HiLook',
      model: 'DVR-216Q-K1',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Configuração > Rede > Básico > Portas (HTTP 80, Dados 8000, RTSP 554)',
      default_ports: JSON.stringify([
        { service_name: 'DVR Web Admin', internal_port: 80, protocol: 'TCP' },
        { service_name: 'DVR Servidor Dados', internal_port: 8000, protocol: 'TCP' },
        { service_name: 'DVR Stream RTSP', internal_port: 554, protocol: 'TCP/UDP' }
      ]),
      photo_url: '',
      notes: 'DVR Turbo HD 16 canais. Requer redirecionamento das portas 80, 8000 e 554.',
      is_builtin: 1
    },
    {
      id: 'cat_intelbras_mhdx3116',
      name: 'Intelbras MHDX 3116 (DVR Multi-HD 16 Canais)',
      category: 'dvr_nvr',
      manufacturer: 'Intelbras',
      model: 'MHDX 3116',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'Avançado > Rede > Portas (HTTP 80, Serviço 37777, RTSP 554)',
      default_ports: JSON.stringify([
        { service_name: 'Intelbras Web', internal_port: 80, protocol: 'TCP' },
        { service_name: 'Porta de Serviço iSIC', internal_port: 37777, protocol: 'TCP' },
        { service_name: 'Stream RTSP', internal_port: 554, protocol: 'TCP/UDP' }
      ]),
      photo_url: '',
      notes: 'Gravador Intelbras Multi-HD com inteligência artificial e suporte ao app iSIC Lite.',
      is_builtin: 1
    },
    {
      id: 'cat_intelbras_sg2404',
      name: 'Intelbras SG 2404 PoE (Switch 24P Gigabit Gerenciável)',
      category: 'switch',
      manufacturer: 'Intelbras',
      model: 'SG 2404 PoE',
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      default_config_path: 'VLAN > 802.1Q / Power over Ethernet',
      default_ports: JSON.stringify([
        { service_name: 'Web Admin Switch', internal_port: 80, protocol: 'TCP' },
        { service_name: 'SSH CLI', internal_port: 22, protocol: 'TCP' }
      ]),
      photo_url: '',
      notes: 'Switch Gigabit 24 portas PoE+ para câmeras IP e terminais faciais.',
      is_builtin: 1
    },
    {
      id: 'cat_ubiquiti_u6lite',
      name: 'Ubiquiti UniFi U6-Lite (Access Point Wi-Fi 6)',
      category: 'access_point',
      manufacturer: 'Ubiquiti',
      model: 'UniFi U6-Lite',
      default_management_port: 443,
      default_protocol: 'https',
      default_username: 'root',
      default_config_path: 'UniFi Network Application > Dispositivos',
      default_ports: JSON.stringify([
        { service_name: 'UniFi Inform', internal_port: 8080, protocol: 'TCP' }
      ]),
      photo_url: '',
      notes: 'Access point de teto para portarias, áreas gourmet e academias do condomínio.',
      is_builtin: 1
    },
    {
      id: 'cat_mikrotik_rb750gr3',
      name: 'MikroTik RB750Gr3 hEX (Roteador / Concentrador)',
      category: 'router_ont',
      manufacturer: 'MikroTik',
      model: 'RB750Gr3 (hEX)',
      default_management_port: 8291,
      default_protocol: 'winbox',
      default_username: 'admin',
      default_config_path: 'IP > Firewall > NAT / IP > DHCP Server > Leases',
      default_ports: JSON.stringify([
        { service_name: 'Winbox Port', internal_port: 8291, protocol: 'TCP' },
        { service_name: 'Webfig Admin', internal_port: 80, protocol: 'TCP' }
      ]),
      photo_url: '',
      notes: 'Roteador robusto com RouterOS para controle de banda, failover e regras de NAT estáticas.',
      is_builtin: 1
    }
  ];

  for (const item of catalogItems) {
    execute(`
      INSERT OR REPLACE INTO equipment_catalog (
        id, name, category, manufacturer, model, default_management_port,
        default_protocol, default_username, default_config_path, default_ports,
        photo_url, notes, is_builtin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      item.id, item.name, item.category, item.manufacturer, item.model,
      item.default_management_port, item.default_protocol, item.default_username,
      item.default_config_path, item.default_ports, item.photo_url, item.notes, item.is_builtin
    );
  }
  console.log(`Catálogo de equipamentos populado com ${catalogItems.length} modelos de referência.`);
}
