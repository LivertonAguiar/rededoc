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
  client_id: z.string().min(1, 'O cliente vinculado é obrigatório.'),
  location_id: z.string().min(1, 'O local vinculado é obrigatório.'),
  name: z.string().min(2, 'O nome do equipamento é obrigatório.'),
  category: z.enum([
    'router_ont',
    'facial_recognition',
    'gate_module',
    'dvr_nvr',
    'ip_camera',
    'switch',
    'access_point',
    'intercom',
    'server',
    'other'
  ], { message: 'Categoria de equipamento não reconhecida.' }),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  mac_address: z.string().refine(
    (val) => !val || macRegex.test(val) || val.length === 12,
    { message: 'Formato de Endereço MAC inválido. Utilize o formato 00:1A:2B:3C:4D:5E.' }
  ).optional().nullable(),
  physical_location: z.string().optional().nullable(),
  local_ip: z.string().refine(
    (val) => !val || ipRegex.test(val),
    { message: 'Endereço IPv4 local inválido.' }
  ).optional().nullable(),
  subnet_mask: z.string().optional().nullable(),
  gateway: z.string().refine(
    (val) => !val || ipRegex.test(val),
    { message: 'Endereço IPv4 de Gateway inválido.' }
  ).optional().nullable(),
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
});

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

