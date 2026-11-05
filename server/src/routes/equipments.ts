import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { pingHost } from '../services/pingService.js';
import { validateBody } from '../middleware/validate.js';
import { equipmentSchema } from '../schemas/index.js';

export const equipmentsRouter = Router();

equipmentsRouter.get('/', (req: Request, res: Response) => {
  const { clientId, locationId, category, q } = req.query;
  let query = `
    SELECT e.*, c.name AS client_name, l.name AS location_name,
      (SELECT COUNT(*) FROM port_forwards pf WHERE pf.equipment_id = e.id) AS total_ports,
      (SELECT cred.id FROM credentials cred WHERE cred.equipment_id = e.id LIMIT 1) AS credential_id
    FROM equipments e
    JOIN clients c ON c.id = e.client_id
    JOIN locations l ON l.id = e.location_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (clientId) {
    query += ' AND e.client_id = ?';
    params.push(clientId);
  }
  if (locationId) {
    query += ' AND e.location_id = ?';
    params.push(locationId);
  }
  if (category) {
    query += ' AND e.category = ?';
    params.push(category);
  }
  if (q) {
    query += ' AND (e.name LIKE ? OR e.model LIKE ? OR e.local_ip LIKE ? OR e.mac_address LIKE ?)';
    const term = `%${q}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY e.created_at ASC';
  const equipments = queryAll(query, ...params);

  // Anexa regras de portas a cada equipamento
  const enriched = equipments.map((eq: any) => {
    const ports = queryAll(`
      SELECT id, service_name, external_port, internal_port, protocol, status, router_config_path
      FROM port_forwards
      WHERE equipment_id = ?
    `, eq.id);
    return { ...eq, ports };
  });

  res.json(enriched);
});

// Varredura de ping em todos os equipamentos do cliente
equipmentsRouter.post('/ping-all', async (req: Request, res: Response): Promise<any> => {
  const { clientId } = req.body;
  let query = 'SELECT id, name, local_ip FROM equipments WHERE local_ip IS NOT NULL AND local_ip != ""';
  const params: any[] = [];
  if (clientId) {
    query += ' AND client_id = ?';
    params.push(clientId);
  }
  const equipments = queryAll(query, ...params);
  const results = await Promise.all(
    equipments.map(async (eq: any) => {
      const ping = await pingHost(eq.local_ip, true);
      return {
        equipment_id: eq.id,
        equipment_name: eq.name,
        ...ping
      };
    })
  );
  res.json(results);
});

// Teste de ping individual para um equipamento
equipmentsRouter.post('/:id/ping', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const eq = queryOne('SELECT id, name, local_ip FROM equipments WHERE id = ?', id);
  if (!eq) {
    return res.status(404).json({ error: 'Equipamento não encontrado.' });
  }
  if (!eq.local_ip) {
    return res.status(400).json({ error: 'Equipamento não possui endereço IP local configurado.' });
  }
  const result = await pingHost(eq.local_ip, true);
  res.json({ equipment_id: eq.id, equipment_name: eq.name, ...result });
});

equipmentsRouter.get('/:id', (req: Request, res: Response): any => {
  const equipment = queryOne(`
    SELECT e.*, c.name AS client_name, l.name AS location_name
    FROM equipments e
    JOIN clients c ON c.id = e.client_id
    JOIN locations l ON l.id = e.location_id
    WHERE e.id = ?
  `, req.params.id);

  if (!equipment) {
    return res.status(404).json({ error: 'Equipamento não encontrado.' });
  }

  const ports = queryAll('SELECT * FROM port_forwards WHERE equipment_id = ?', equipment.id);
  const credentials = queryAll(`
    SELECT id, name, category, username, access_url, port, notes, last_changed_at
    FROM credentials
    WHERE equipment_id = ?
  `, equipment.id);

  res.json({ ...equipment, ports, credentials });
});

equipmentsRouter.post('/', validateBody(equipmentSchema), (req: AuthRequest, res: Response): any => {
  const {
    client_id, location_id, name, category, manufacturer, model, serial_number,
    mac_address, physical_location, photo_url, notes,
    local_ip, subnet_mask, gateway, primary_dns, secondary_dns, dhcp_range,
    interface_name, vlan, is_mac_reserved, public_wan_ip,
    access_url, management_port, protocol, admin_username, config_path, access_notes,
    internal_notes, additional_info
  } = req.body;

  if (!client_id || !location_id || !name || !category) {
    return res.status(400).json({ error: 'Cliente, Local, Nome e Categoria são obrigatórios.' });
  }

  const id = 'eq_' + crypto.randomUUID().slice(0, 8);
  execute(`
    INSERT INTO equipments (
      id, client_id, location_id, name, category, manufacturer, model, serial_number,
      mac_address, physical_location, photo_url, notes,
      local_ip, subnet_mask, gateway, primary_dns, secondary_dns, dhcp_range,
      interface_name, vlan, is_mac_reserved, public_wan_ip,
      access_url, management_port, protocol, admin_username, config_path, access_notes,
      internal_notes, additional_info
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?
    )
  `,
    id, client_id, location_id, name, category, manufacturer || null, model || null, serial_number || null,
    mac_address || null, physical_location || null, photo_url || null, notes || null,
    local_ip || null, subnet_mask || '255.255.255.0', gateway || null, primary_dns || null, secondary_dns || null, dhcp_range || null,
    interface_name || null, vlan || null, is_mac_reserved ? 1 : 0, public_wan_ip || null,
    access_url || null, management_port ? Number(management_port) : null, protocol || 'http', admin_username || null, config_path || null, access_notes || null,
    internal_notes || null, additional_info || null
  );

  // Histórico técnico
  execute(`
    INSERT INTO audit_history (
      id, client_id, location_id, equipment_id, user_name, action, entity_type, entity_name, field_name, new_value
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    'aud_' + crypto.randomUUID().slice(0, 8),
    client_id, location_id, id,
    req.user?.name || 'Técnico',
    'CRIACAO', 'equipment', name, 'Equipamento', `${name} (${model || category}) cadastrado`
  );

  const created = queryOne('SELECT * FROM equipments WHERE id = ?', id);
  res.status(201).json(created);
});

equipmentsRouter.put('/:id', validateBody(equipmentSchema.partial()), (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM equipments WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Equipamento não encontrado.' });
  }

  const {
    name, category, manufacturer, model, serial_number,
    mac_address, physical_location, photo_url, notes,
    local_ip, subnet_mask, gateway, primary_dns, secondary_dns, dhcp_range,
    interface_name, vlan, is_mac_reserved, public_wan_ip,
    access_url, management_port, protocol, admin_username, config_path, access_notes,
    internal_notes, additional_info
  } = req.body;

  execute(`
    UPDATE equipments SET
      name = ?, category = ?, manufacturer = ?, model = ?, serial_number = ?,
      mac_address = ?, physical_location = ?, photo_url = ?, notes = ?,
      local_ip = ?, subnet_mask = ?, gateway = ?, primary_dns = ?, secondary_dns = ?, dhcp_range = ?,
      interface_name = ?, vlan = ?, is_mac_reserved = ?, public_wan_ip = ?,
      access_url = ?, management_port = ?, protocol = ?, admin_username = ?, config_path = ?, access_notes = ?,
      internal_notes = ?, additional_info = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    name !== undefined ? name : existing.name,
    category !== undefined ? category : existing.category,
    manufacturer !== undefined ? manufacturer : existing.manufacturer,
    model !== undefined ? model : existing.model,
    serial_number !== undefined ? serial_number : existing.serial_number,
    mac_address !== undefined ? mac_address : existing.mac_address,
    physical_location !== undefined ? physical_location : existing.physical_location,
    photo_url !== undefined ? photo_url : existing.photo_url,
    notes !== undefined ? notes : existing.notes,
    local_ip !== undefined ? (local_ip || null) : existing.local_ip,
    subnet_mask !== undefined ? (subnet_mask || '255.255.255.0') : existing.subnet_mask,
    gateway !== undefined ? (gateway || null) : existing.gateway,
    primary_dns !== undefined ? (primary_dns || null) : existing.primary_dns,
    secondary_dns !== undefined ? (secondary_dns || null) : existing.secondary_dns,
    dhcp_range !== undefined ? (dhcp_range || null) : existing.dhcp_range,
    interface_name !== undefined ? interface_name : existing.interface_name,
    vlan !== undefined ? vlan : existing.vlan,
    is_mac_reserved !== undefined ? (is_mac_reserved ? 1 : 0) : existing.is_mac_reserved,
    public_wan_ip !== undefined ? (public_wan_ip || null) : existing.public_wan_ip,
    access_url !== undefined ? access_url : existing.access_url,
    management_port !== undefined ? (management_port ? Number(management_port) : null) : existing.management_port,
    protocol !== undefined ? protocol : existing.protocol,
    admin_username !== undefined ? admin_username : existing.admin_username,
    config_path !== undefined ? config_path : existing.config_path,
    access_notes !== undefined ? access_notes : existing.access_notes,
    internal_notes !== undefined ? internal_notes : (existing as any).internal_notes,
    additional_info !== undefined ? additional_info : (existing as any).additional_info,
    id
  );

  const user = req.user?.name || 'Técnico';
  if (public_wan_ip && existing.public_wan_ip && public_wan_ip !== existing.public_wan_ip) {
    execute(`
      INSERT INTO audit_history (id, client_id, location_id, equipment_id, user_name, action, entity_type, entity_name, field_name, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, 'aud_' + crypto.randomUUID().slice(0, 8), existing.client_id, existing.location_id, id, user, 'ALTERACAO_WAN', 'equipment', name || existing.name, 'IP WAN (Público)', existing.public_wan_ip, public_wan_ip);
  }
  if (local_ip && local_ip !== existing.local_ip) {
    execute(`
      INSERT INTO audit_history (id, client_id, location_id, equipment_id, user_name, action, entity_type, entity_name, field_name, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, 'aud_' + crypto.randomUUID().slice(0, 8), existing.client_id, existing.location_id, id, user, 'ALTERACAO_IP', 'equipment', name || existing.name, 'IP Local', existing.local_ip, local_ip);
  }
  if (mac_address && mac_address !== existing.mac_address) {
    execute(`
      INSERT INTO audit_history (id, client_id, location_id, equipment_id, user_name, action, entity_type, entity_name, field_name, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, 'aud_' + crypto.randomUUID().slice(0, 8), existing.client_id, existing.location_id, id, user, 'ALTERACAO_MAC', 'equipment', name || existing.name, 'MAC Address', existing.mac_address, mac_address);
  }
  if (primary_dns !== undefined && primary_dns !== existing.primary_dns) {
    execute(`
      INSERT INTO audit_history (id, client_id, location_id, equipment_id, user_name, action, entity_type, entity_name, field_name, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, 'aud_' + crypto.randomUUID().slice(0, 8), existing.client_id, existing.location_id, id, user, 'ALTERACAO_DNS', 'equipment', name || existing.name, 'DNS Primário', existing.primary_dns || '(vazio)', primary_dns || '(vazio)');
  }
  if (secondary_dns !== undefined && secondary_dns !== existing.secondary_dns) {
    execute(`
      INSERT INTO audit_history (id, client_id, location_id, equipment_id, user_name, action, entity_type, entity_name, field_name, old_value, new_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, 'aud_' + crypto.randomUUID().slice(0, 8), existing.client_id, existing.location_id, id, user, 'ALTERACAO_DNS', 'equipment', name || existing.name, 'DNS Secundário', existing.secondary_dns || '(vazio)', secondary_dns || '(vazio)');
  }

  const updated = queryOne('SELECT * FROM equipments WHERE id = ?', id);
  res.json(updated);
});

equipmentsRouter.delete('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM equipments WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Equipamento não encontrado.' });
  }

  execute('DELETE FROM equipments WHERE id = ?', id);

  execute(`
    INSERT INTO audit_history (id, client_id, location_id, equipment_id, user_name, action, entity_type, entity_name, field_name, old_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, 'aud_' + crypto.randomUUID().slice(0, 8), existing.client_id, existing.location_id, id, req.user?.name || 'Técnico', 'EXCLUSAO', 'equipment', existing.name, 'Equipamento', `${existing.name} removido`);

  res.json({ message: 'Equipamento excluído com sucesso.' });
});
