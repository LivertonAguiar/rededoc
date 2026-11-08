import { z } from 'zod';

const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

/**
 * Esquema de validação para cadastro e atualização de Clientes
 */
export const clientSchema = z.object({
  name: z.string().min(2, 'O nome do condomínio/cliente deve conter ao menos 2 caracteres.'),
  identification_name: z.string().optional().nullable(),
  document: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('E-mail em formato inválido.').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

/**
 * Esquema de validação para Equipamentos de Rede
 */
export const equipmentSchema = z.object({
  client_id: z.string().min(1, 'O cliente vinculado é obrigatório.').optional(),
  location_id: z.string().optional().nullable().or(z.literal('')),
  name: z.string().min(1, 'O nome do equipamento é obrigatório.').optional(),
  category: z.string().min(1, 'A categoria do equipamento é obrigatória.').optional(),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  mac_address: z.string().optional().nullable(),
  physical_location: z.string().optional().nullable(),
  local_ip: z.string().optional().nullable(),
  subnet_mask: z.string().optional().nullable(),
  gateway: z.string().optional().nullable(),
  primary_dns: z.string().optional().nullable(),
  secondary_dns: z.string().optional().nullable(),
  dhcp_range: z.string().optional().nullable(),
  interface_name: z.string().optional().nullable(),
  vlan: z.string().optional().nullable(),
  public_wan_ip: z.string().optional().nullable(),
  is_mac_reserved: z.union([z.boolean(), z.number()]).optional().nullable(),
  notes: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  protocol: z.string().optional().nullable(),
  management_port: z.union([z.number(), z.string()]).optional().nullable(),
  access_url: z.string().optional().nullable(),
  admin_username: z.string().optional().nullable(),
  config_path: z.string().optional().nullable(),
  access_notes: z.string().optional().nullable(),
  additional_info: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable()
}).passthrough();

/**
 * Esquema de validação para Regras de Redirecionamento de Portas (NAT)
 */
export const portForwardSchema = z.object({
  client_id: z.string().min(1, 'O cliente vinculado é obrigatório.'),
  equipment_id: z.string().min(1, 'O equipamento de destino é obrigatório.'),
  service_name: z.string().min(2, 'O nome do serviço ou aplicação é obrigatório.'),
  external_port: z.coerce.number().int().min(1).max(65535, 'A porta externa deve estar entre 1 e 65535.'),
  internal_port: z.coerce.number().int().min(1).max(65535, 'A porta interna deve estar entre 1 e 65535.'),
  protocol: z.enum(['tcp', 'udp', 'both']).default('tcp'),
  destination_local_ip: z.string().refine(
    (val) => !val || ipRegex.test(val),
    { message: 'Endereço IPv4 de destino inválido.' }
  ).optional().nullable(),
  status: z.enum(['funcionando', 'nao_testada', 'com_falha']).default('nao_testada'),
  notes: z.string().optional().nullable()
});

/**
 * Esquema de validação para Vínculos entre Entidades (Itens Relacionados)
 */
export const validEntityTypes = [
  'client',
  'location',
  'equipment',
  'credential',
  'port_forward',
  'service_order',
  'article',
  'domain',
  'subnet',
  'attachment'
] as const;

export type ValidEntityType = typeof validEntityTypes[number];

export const linkSchema = z.object({
  client_id: z.string().min(1, 'O cliente vinculado é obrigatório.'),
  source_type: z.enum(validEntityTypes),
  source_id: z.string().min(1, 'source_id é obrigatório.'),
  target_type: z.enum(validEntityTypes),
  target_id: z.string().min(1, 'target_id é obrigatório.'),
  label: z.string().optional().nullable()
}).refine(data => !(data.source_type === data.target_type && data.source_id === data.target_id), {
  message: 'Não é possível vincular um registro a si mesmo.'
});

/**
 * Esquema de validação para Artigos da Base de Conhecimento (Procedimentos)
 */
export const articleSchema = z.object({
  client_id: z.string().optional().nullable(),
  title: z.string().min(2, 'O título do procedimento deve conter ao menos 2 caracteres.'),
  body_md: z.string().min(1, 'O conteúdo do procedimento em Markdown é obrigatório.'),
  tags: z.string().optional().nullable(),
  visible_in_portal: z.union([z.boolean(), z.number()]).optional().default(0)
});

/**
 * Esquema de validação para Sub-redes e IPAM (Fase 6)
 */
export const subnetSchema = z.object({
  client_id: z.string().min(1, 'O cliente vinculado é obrigatório.'),
  location_id: z.string().optional().nullable(),
  name: z.string().min(2, 'O nome da sub-rede deve conter ao menos 2 caracteres.'),
  cidr: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/, 'Formato CIDR inválido (ex: 192.168.1.0/24)'),
  gateway: z.string().optional().nullable(),
  vlan: z.string().optional().nullable(),
  dhcp_start: z.string().optional().nullable(),
  dhcp_end: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

/**
 * Esquema de validação para Criação de Usuários do Sistema e Portal (Fase 4)
 */
export const createUserSchema = z.object({
  name: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres.'),
  email: z.string().email('E-mail em formato inválido.'),
  password: z.string().min(6, 'A senha deve conter ao menos 6 caracteres.'),
  role: z.enum(['admin', 'tecnico', 'cliente']),
  client_id: z.string().optional().nullable(),
  is_active: z.union([z.boolean(), z.number()]).optional().default(1)
}).refine(data => {
  if (data.role === 'cliente' && (!data.client_id || data.client_id.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Usuários com papel "cliente" devem ser vinculados obrigatoriamente a um condomínio.',
  path: ['client_id']
});

/**
 * Esquema de validação para Atualização de Usuários (Fase 4)
 */
export const updateUserSchema = z.object({
  name: z.string().min(2, 'O nome deve ter no mínimo 2 caracteres.').optional(),
  email: z.string().email('E-mail em formato inválido.').optional(),
  role: z.enum(['admin', 'tecnico', 'cliente']).optional(),
  client_id: z.string().optional().nullable(),
  is_active: z.union([z.boolean(), z.number()]).optional()
}).refine(data => {
  if (data.role === 'cliente' && (!data.client_id || data.client_id.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Usuários com papel "cliente" devem ser vinculados obrigatoriamente a um condomínio.',
  path: ['client_id']
});

/**
 * Esquema de validação para Redefinição de Senha de Usuários (Fase 4)
 */
export const resetPasswordSchema = z.object({
  password: z.string().min(6, 'A nova senha deve conter ao menos 6 caracteres.')
});

/**
 * Esquema de validação para Modelos de Equipamento e Campos Personalizados (Fase 8)
 */
export const allowedFieldTypes = ['text', 'number', 'ip', 'mac', 'select', 'boolean', 'date'] as const;
export type AllowedFieldType = typeof allowedFieldTypes[number];

export const equipmentFieldSchema = z.object({
  key: z.string().min(1, 'A chave do campo é obrigatória.').regex(/^[a-z0-9_]+$/, 'A chave do campo deve conter apenas letras minúsculas, números e sublinhado (_).'),
  label: z.string().min(1, 'O rótulo do campo é obrigatório.'),
  type: z.enum(allowedFieldTypes),
  required: z.boolean().optional().default(false),
  options: z.array(z.string()).optional()
}).refine(field => {
  // Regra do plano: NÃO existe tipo "senha". Segredos continuam exclusivamente no cofre criptografado.
  const lowerKey = field.key.toLowerCase();
  if ((field.type as string) === 'password' || lowerKey.includes('password') || lowerKey.includes('senha')) {
    return false;
  }
  return true;
}, {
  message: 'Campos do tipo senha não são permitidos em modelos. Credenciais devem ser mantidas no cofre criptografado.',
  path: ['type']
});

export const equipmentTemplateSchema = z.object({
  category: z.string().min(1, 'A categoria do equipamento é obrigatória.'),
  name: z.string().min(2, 'O nome do modelo de equipamento deve conter ao menos 2 caracteres.'),
  fields: z.array(equipmentFieldSchema).default([])
});



