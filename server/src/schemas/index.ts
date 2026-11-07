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
  location_id: z.string().min(1, 'O local vinculado é obrigatório.').optional(),
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

