export type UserRole = 'admin' | 'tecnico' | 'cliente';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  client_id?: string | null;
}

export type EntityType =
  | 'client'
  | 'location'
  | 'equipment'
  | 'credential'
  | 'port_forward'
  | 'service_order'
  | 'article'
  | 'domain'
  | 'subnet'
  | 'attachment';

export interface EntityLink {
  id: string;
  client_id: string;
  source_type: EntityType;
  source_id: string;
  target_type: EntityType;
  target_id: string;
  label?: string | null;
  created_at: string;
  created_by?: string | null;
}

export interface RelatedItem {
  linkId?: string;
  type: EntityType;
  id: string;
  title: string;
  subtitle: string;
  clientId: string;
  origin: 'implicit' | 'manual';
  label?: string | null;
  createdAt?: string;
}

export interface AvailableLinkTarget {
  type: EntityType;
  id: string;
  title: string;
  subtitle: string;
  category: string;
}

export interface Client {
  id: string;
  name: string;
  identification_name: string;
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  total_locations?: number;
  total_equipments?: number;
  total_ports?: number;
  active_ports?: number;
  locations?: Location[];
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  client_id: string;
  name: string;
  address: string;
  contact_name?: string;
  phone?: string;
  access_notes?: string;
  total_equipments?: number;
  total_ports?: number;
  client_name?: string;
  created_at: string;
}

export interface PortForward {
  id: string;
  client_id: string;
  location_id: string;
  equipment_id: string;
  service_name: string;
  source_wan_ip: string;
  external_port: number;
  destination_local_ip: string;
  internal_port: number;
  protocol: 'TCP' | 'UDP' | 'TCP/UDP';
  router_config_path?: string;
  status: 'funcionando' | 'nao_testada' | 'com_falha';
  service_order_id?: string;
  notes?: string;
  internal_notes?: string;
  additional_info?: string;
  configured_at?: string;
  equipment_name?: string;
  equipment_model?: string;
  equipment_category?: string;
  client_name?: string;
  location_name?: string;
  // Suporte a cadastro offline-first
  _isOffline?: boolean;
  _offlineTimestamp?: string;
}

export interface Equipment {
  id: string;
  client_id: string;
  location_id: string;
  name: string;
  category: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  mac_address?: string;
  physical_location?: string;
  photo_url?: string;
  notes?: string;
  internal_notes?: string;
  additional_info?: string;
  warranty_expires_at?: string | null;
  // Rede
  local_ip?: string;
  subnet_mask?: string;
  gateway?: string;
  primary_dns?: string;
  secondary_dns?: string;
  dhcp_range?: string;
  interface_name?: string;
  vlan?: string;
  is_mac_reserved?: number;
  public_wan_ip?: string;
  // Gerenciamento
  access_url?: string;
  management_port?: number | null;
  protocol?: string | null;
  admin_username?: string | null;
  config_path?: string | null;
  access_notes?: string | null;
  custom_fields?: Record<string, any> | string;
  // Enriquecidos
  ports?: PortForward[];
  attachments?: Attachment[];
  credential_id?: string;
  client_name?: string;
  location_name?: string;
  // Suporte a cadastro offline-first
  _isOffline?: boolean;
  _offlineTimestamp?: string;
}

export interface Credential {
  id: string;
  client_id: string;
  equipment_id?: string;
  name: string;
  category: string;
  username: string;
  masked_password?: string;
  access_url?: string;
  port?: number;
  notes?: string;
  rotation_days?: number | null;
  expires_at?: string | null;
  last_changed_at: string;
  equipment_name?: string;
  equipment_model?: string;
  client_name?: string;
}

export interface CredentialAuditLog {
  id: string;
  credential_id: string;
  user_name: string;
  action: string;
  ip_address?: string;
  created_at: string;
}

export interface ServiceOrder {
  id: string;
  client_id: string;
  location_id: string;
  technician_name: string;
  date_time: string;
  service_type: string;
  problem_description: string;
  status: 'agendado' | 'em_andamento' | 'aguardando_retorno' | 'concluido' | 'cancelado';
  service_cost?: number;
  time_spent_minutes?: number;
  additional_info?: string;
  equipments_involved?: string; // JSON array
  changes_made?: string;
  tests_performed?: string;
  test_results?: string;
  technical_notes?: string;
  client_name?: string;
  location_name?: string;
  location_address?: string;
  attachments?: Attachment[];
  audit_entries?: AuditHistory[];
}

export interface TopologyNode {
  id: string;
  label: string;
  sublabel?: string;
  ip?: string;
  mac?: string;
  type: string;
  photo_url?: string | null;
  x: number;
  y: number;
  portBadge?: string;
  status?: string;
}

export interface TopologyEdge {
  from: string;
  to: string;
  label?: string;
}

export interface TopologyData {
  id: string;
  client_id: string;
  location_id: string;
  view_mode: 'simplified' | 'detailed';
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  available_equipments?: Equipment[];
  is_auto_generated?: boolean;
}

export interface AuditHistory {
  id: string;
  client_id: string;
  location_id?: string;
  equipment_id?: string;
  service_order_id?: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_name: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  client_id: string;
  location_id?: string;
  equipment_id?: string;
  service_order_id?: string;
  file_name: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_path: string;
  category: string;
  notes?: string;
  created_at: string;
}

export interface ClientSummary {
  id: string;
  name: string;
  identification_name: string;
  phone?: string;
  email?: string;
  address: string;
  responsible: string;
  total_equipments: number;
  total_ports: number;
  validated_ports: number;
  failed_ports: number;
  wan_ip: string;
  local_ip: string;
  router_model: string;
  last_service_date: string | null;
  last_service_type: string | null;
}

export interface DashboardStats {
  total_clients: number;
  total_equipments: number;
  in_progress_services: number;
  completed_services: number;
  total_port_rules: number;
  validated_port_rules: number;
  failed_port_rules: number;
  equipments_needing_review: any[];
  recent_services: ServiceOrder[];
  clients_summary?: ClientSummary[];
}

export interface TechnicalReportData {
  generated_at: string;
  client: Client;
  location: Location;
  connection_summary: {
    public_wan_ip: string;
    router_name: string;
    router_model: string;
    local_ip: string;
    subnet_mask: string;
    gateway: string;
    primary_dns: string;
    secondary_dns: string;
    dhcp_range: string;
  };
  equipments: Equipment[];
  port_forwards: PortForward[];
  credentials: {
    id: string;
    name: string;
    equipment_name?: string;
    username: string;
    password: string;
    access_url?: string;
    port?: number;
    notes?: string;
  }[];
  latest_service_order?: ServiceOrder;
  service_orders?: ServiceOrder[];
  attachments: Attachment[];
  topology?: {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
    view_mode: string;
  };
}

export interface Article {
  id: string;
  client_id?: string | null;
  client_name?: string | null;
  title: string;
  body_md: string;
  tags?: string | null;
  visible_in_portal?: number;
  version: number;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ArticleVersion {
  id: string;
  article_id: string;
  version: number;
  title: string;
  body_md: string;
  changed_by?: string | null;
  created_at: string;
}

export interface EquipmentCatalogItem {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  default_management_port: number;
  default_protocol: string;
  default_username: string;
  default_config_path?: string;
  default_ports?: {
    service_name: string;
    internal_port: number;
    protocol: string;
  }[];
  photo_url?: string;
  notes?: string;
  is_builtin?: number;
  created_at?: string;
  updated_at?: string;
}

export type ExpirationStatus = 'expired' | 'due_7d' | 'due_30d' | 'ok';
export type ExpirationKind = 'warranty' | 'credential_rotation' | 'domain' | 'ssl';

export interface ExpirationItem {
  id: string;
  kind: ExpirationKind;
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string;
  clientId: string;
  clientName: string;
  dueAt: string;
  daysRemaining: number;
  status: ExpirationStatus;
}

export interface NotificationSetting {
  id: string;
  channel: string;
  target_url: string | null;
  advance_days: string;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationLog {
  id: string;
  entity_type: string;
  entity_id: string;
  channel: string;
  status: string;
  sent_at: string;
  message: string;
  created_at: string;
}

export interface DomainDnsSnapshot {
  a_records?: string[];
  mx_records?: Array<{ exchange: string; priority: number }>;
  ns_records?: string[];
  txt_records?: string[];
  spf?: string | null;
  dmarc?: string | null;
  caa?: Array<{ critical: number; issue?: string }>;
  ddns_status?: {
    is_ddns: boolean;
    resolved_ip?: string;
    expected_wan_ip?: string;
    mismatch: boolean;
  };
  ssl?: {
    valid_from?: string;
    valid_to?: string;
    issuer?: string;
    subject?: string;
    days_remaining?: number;
    valid?: boolean;
  };
  rdap?: {
    expires_at?: string;
    registrar?: string;
  };
}

export interface Domain {
  id: string;
  client_id: string;
  client_name?: string;
  name: string;
  registrar?: string | null;
  expires_at?: string | null;
  nameservers?: string | null;
  notes?: string | null;
  auto_check: number;
  last_checked_at?: string | null;
  ssl_expires_at?: string | null;
  ssl_issuer?: string | null;
  dns_snapshot?: DomainDnsSnapshot | null;
  score: number;
  created_at?: string;
  updated_at?: string;
}

export interface FavoriteItem {
  id: string;
  entityType: 'client' | 'equipment' | 'credential' | 'article' | 'domain';
  entityId: string;
  title: string;
  subtitle: string;
  clientId?: string | null;
  clientName?: string | null;
  urlHash: string;
  createdAt?: string;
}

export interface SearchResultItem {
  id: string;
  type: 'client' | 'location' | 'equipment' | 'credential' | 'port_forward' | 'service_order' | 'article' | 'domain';
  title: string;
  subtitle: string;
  clientId?: string | null;
  clientName?: string | null;
  urlHash: string;
  badge?: string;
}

export interface GroupedSearchResults {
  total: number;
  results: SearchResultItem[];
  byType: Record<string, SearchResultItem[]>;
}

export interface DashboardOverviewData {
  counts: {
    clients: number;
    equipments: number;
    credentials: number;
    port_forwards: number;
    articles: number;
    domains: number;
    pending_orders: number;
  };
  favorites: FavoriteItem[];
  recent_activity: Array<{
    id: string;
    client_id?: string;
    client_name?: string;
    user_name: string;
    action: string;
    entity_type: string;
    entity_name: string;
    details?: string;
    created_at: string;
  }>;
  expirations: ExpirationItem[];
}

export interface Subnet {
  id: string;
  client_id: string;
  location_id?: string | null;
  name: string;
  cidr: string;
  gateway?: string | null;
  vlan?: string | null;
  dhcp_start?: string | null;
  dhcp_end?: string | null;
  notes?: string | null;
  client_name?: string;
  location_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SubnetIpSlot {
  ip: string;
  status: 'free' | 'used' | 'dhcp' | 'dhcp_conflict' | 'conflict' | 'gateway';
  equipment?: {
    id: string;
    name: string;
    model?: string;
    category?: string;
    mac_address?: string;
    is_mac_reserved?: number;
  };
  conflictingEquipments?: Array<{
    id: string;
    name: string;
    model?: string;
    mac_address?: string;
  }>;
}

export interface SubnetUsageReport {
  subnet: Subnet;
  cidrInfo: {
    networkIp: string;
    prefix: number;
    netmask: string;
    firstUsableIp: string;
    lastUsableIp: string;
    broadcastIp: string;
    totalHosts: number;
  };
  stats: {
    totalHosts: number;
    usedHosts: number;
    freeHosts: number;
    dhcpHosts: number;
    conflictCount: number;
    usagePercentage: number;
  };
  nextFreeIp: string | null;
  slots: SubnetIpSlot[];
}

export interface SubnetSuggestion {
  name: string;
  cidr: string;
  gateway: string;
  vlan?: string;
  dhcp_start?: string;
  dhcp_end?: string;
  location_id?: string;
  matchedEquipmentsCount: number;
}

export interface ClientIpConflictsReport {
  duplicates: Array<{ ip: string; equipments: any[] }>;
  outOfSubnet: any[];
  dhcpWithoutReservation: any[];
  hasIssues: boolean;
}

// ==========================================
// Tipos para Gestão de Usuários (Fase 4)
// ==========================================
export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  client_id?: string | null;
  client_name?: string | null;
  client_identification?: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ==========================================
// Tipos para Portal do Cliente (Fase 4)
// ==========================================
export interface PortalClientInfo {
  id: string;
  name: string;
  identification_name?: string;
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface PortalLocation {
  id: string;
  name: string;
  address?: string;
  contact_name?: string;
  phone?: string;
}

export interface PortalOverview {
  client: PortalClientInfo;
  locations: PortalLocation[];
  stats: {
    total_equipments: number;
    completed_services: number;
    last_service_date: string | null;
    available_guides: number;
  };
}

export interface PortalEquipment {
  id: string;
  name: string;
  category: string;
  manufacturer?: string;
  model?: string;
  physical_location?: string;
  location_name?: string;
  photo_url?: string;
}

export interface PortalServiceOrder {
  id: string;
  date_time: string;
  service_type: string;
  problem_description: string;
  changes_made?: string;
  test_results?: string;
  technician_name: string;
  location_name?: string;
}

export interface PortalArticle {
  id: string;
  title: string;
  body_md: string;
  tags?: string;
  updated_at: string;
}

// ==========================================
// Tipos para Modelos de Equipamento (Fase 8)
// ==========================================
export type EquipmentFieldType = 'text' | 'number' | 'ip' | 'mac' | 'select' | 'boolean' | 'date';

export interface EquipmentFieldDefinition {
  key: string;
  label: string;
  type: EquipmentFieldType;
  required?: boolean;
  options?: string[];
}

export interface EquipmentTemplate {
  id: string;
  category: string;
  name: string;
  fields: EquipmentFieldDefinition[];
  created_at: string;
  updated_at: string;
}

// ==========================================
// Proteção e Snapshots de Banco de Dados
// ==========================================
export interface BackupSnapshot {
  filename: string;
  path: string;
  type: 'automated' | 'manual' | 'pre-restore' | 'pre-import';
  label?: string;
  created_at: string;
  size_bytes: number;
  size_formatted: string;
  sha256: string;
  integrity: string;
  counts?: {
    clients: number;
    equipments: number;
    credentials: number;
    users: number;
    service_orders: number;
    articles: number;
  };
}

export interface DatabaseIntegrityStatus {
  ok: boolean;
  result: string;
  database_file: string;
  database_size_bytes: number;
  wal_size_bytes: number;
  journal_mode: string;
  synchronous: string;
  busy_timeout: number;
  checked_at: string;
}



