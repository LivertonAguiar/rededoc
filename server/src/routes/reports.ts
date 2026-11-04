import { Router, Request, Response } from 'express';
import { queryAll, queryOne } from '../db/database.js';
import { decryptCredential } from '../services/crypto.js';
import { AuthRequest } from '../middleware/auth.js';

export const reportsRouter = Router();

reportsRouter.get('/client/:clientId', (req: AuthRequest, res: Response): any => {
  const { clientId } = req.params;
  const { locationId, includePasswords } = req.query;

  const client = queryOne('SELECT * FROM clients WHERE id = ?', clientId) as any;
  if (!client) {
    return res.status(404).json({ error: 'Cliente não encontrado.' });
  }

  const location = queryOne(`
    SELECT * FROM locations 
    WHERE client_id = ? ${locationId ? 'AND id = ?' : ''}
    ORDER BY created_at ASC LIMIT 1
  `, ...(locationId ? [clientId, locationId] : [clientId])) as any;

  const equipments = queryAll(`
    SELECT * FROM equipments 
    WHERE client_id = ? ${location ? 'AND location_id = ?' : ''}
    ORDER BY CASE WHEN category = 'router_ont' THEN 0 ELSE 1 END, name ASC
  `, ...(location ? [clientId, location.id] : [clientId])) as any[];

  const portForwards = queryAll(`
    SELECT pf.*, e.name AS equipment_name, e.model AS equipment_model
    FROM port_forwards pf
    JOIN equipments e ON e.id = pf.equipment_id
    WHERE pf.client_id = ? ${location ? 'AND pf.location_id = ?' : ''}
    ORDER BY pf.external_port ASC
  `, ...(location ? [clientId, location.id] : [clientId])) as any[];

  const allServiceOrders = queryAll(`
    SELECT * FROM service_orders
    WHERE client_id = ? ${location ? 'AND location_id = ?' : ''}
    ORDER BY date_time DESC
  `, ...(location ? [clientId, location.id] : [clientId])) as any[];

  const latestServiceOrder = allServiceOrders[0] || null;

  const rawAttachments = queryAll(`
    SELECT a.*, e.name AS equipment_name, e.model AS equipment_model
    FROM attachments a
    LEFT JOIN equipments e ON e.id = a.equipment_id
    WHERE a.client_id = ? ${location ? 'AND a.location_id = ?' : ''}
    ORDER BY a.created_at DESC
  `, ...(location ? [clientId, location.id] : [clientId])) as any[];

  const attachments = rawAttachments.map(a => ({
    ...a,
    file_path: a.file_path ? (a.file_path.startsWith('/') ? a.file_path : '/' + a.file_path) : ''
  }));

  const enrichedEquipments = equipments.map(eq => {
    const eqAttachments = attachments.filter(a => a.equipment_id === eq.id);
    return {
      ...eq,
      attachments: eqAttachments
    };
  });

  const topology = queryOne(`
    SELECT nodes_data, edges_data, view_mode FROM network_topology
    WHERE client_id = ? ${location ? 'AND location_id = ?' : ''}
    LIMIT 1
  `, ...(location ? [clientId, location.id] : [clientId])) as any;

  const shouldReveal = includePasswords === 'true' || includePasswords === '1';
  const rawCredentials = queryAll(`
    SELECT cred.*, e.name as equipment_name
    FROM credentials cred
    LEFT JOIN equipments e ON e.id = cred.equipment_id
    WHERE cred.client_id = ?
  `, clientId) as any[];

  const credentials = rawCredentials.map(c => {
    let password = '••••••••';
    if (shouldReveal) {
      try {
        password = decryptCredential(c.encrypted_password, c.iv, c.auth_tag);
      } catch {
        password = '[ERRO DE DECRIPTO]';
      }
    }
    return {
      id: c.id,
      name: c.name,
      equipment_name: c.equipment_name,
      username: c.username,
      password,
      access_url: c.access_url,
      port: c.port,
      notes: c.notes
    };
  });

  const router = equipments.find(e => e.category === 'router_ont');

  res.json({
    generated_at: new Date().toISOString(),
    client,
    location,
    connection_summary: {
      public_wan_ip: router?.public_wan_ip || '203.0.113.45',
      router_name: router?.name || 'Roteador/ONT',
      router_model: router ? `${router.manufacturer || ''} ${router.model || ''}`.trim() : 'N/A',
      local_ip: router?.local_ip || '192.168.1.1',
      subnet_mask: router?.subnet_mask || '255.255.255.0',
      gateway: router?.gateway || '192.168.1.1',
      primary_dns: router?.primary_dns || '8.8.8.8',
      secondary_dns: router?.secondary_dns || '8.8.4.4',
      dhcp_range: router?.dhcp_range || '192.168.1.100-199'
    },
    equipments: enrichedEquipments,
    port_forwards: portForwards,
    credentials,
    latest_service_order: latestServiceOrder,
    service_orders: allServiceOrders,
    attachments,
    topology: topology ? {
      nodes: JSON.parse(topology.nodes_data || '[]'),
      edges: JSON.parse(topology.edges_data || '[]'),
      view_mode: topology.view_mode
    } : null
  });
});
