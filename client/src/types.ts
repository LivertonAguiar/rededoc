export type UserRole = 'admin' | 'tecnico' | 'cliente';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  client_id?: string | null;
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
  // Enriquecidos
  ports?: PortForward[];
  attachments?: Attachment[];
  credential_id?: string;
  client_name?: string;
  location_name?: string;
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
