import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

export const portForwardsRouter = Router();

portForwardsRouter.get('/', (req: Request, res: Response) => {
  const { clientId, locationId, equipmentId } = req.query;
  let query = `
    SELECT pf.*, 
      e.name AS equipment_name, e.model AS equipment_model, e.category AS equipment_category,
      c.name AS client_name, l.name AS location_name
    FROM port_forwards pf
    JOIN equipments e ON e.id = pf.equipment_id
    JOIN clients c ON c.id = pf.client_id
    JOIN locations l ON l.id = pf.location_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (clientId) {
    query += ' AND pf.client_id = ?';
    params.push(clientId);
  }
  if (locationId) {
    query += ' AND pf.location_id = ?';
    params.push(locationId);
  }
  if (equipmentId) {
    query += ' AND pf.equipment_id = ?';
    params.push(equipmentId);
  }

  query += ' ORDER BY pf.external_port ASC';
  const rules = queryAll(query, ...params);
  res.json(rules);
});

portForwardsRouter.post('/', (req: AuthRequest, res: Response): any => {
  const {
    client_id, location_id, equipment_id, service_name,
    source_wan_ip, external_port, destination_local_ip, internal_port,
    protocol, router_config_path, status, service_order_id, notes,
    internal_notes, additional_info
  } = req.body;

  if (!client_id || !location_id || !equipment_id || !service_name || !source_wan_ip || !external_port || !destination_local_ip || !internal_port) {
    return res.status(400).json({ error: 'Todos os campos obrigatórios da regra devem ser preenchidos.' });
  }

  const extPortNum = Number(external_port);
  const intPortNum = Number(internal_port);
  const proto = protocol || 'TCP';

  // Validação de conflito de portas externas no mesmo IP WAN e protocolo
  const conflict = queryOne(`
    SELECT pf.*, e.name AS equipment_name 
    FROM port_forwards pf
    JOIN equipments e ON e.id = pf.equipment_id
    WHERE pf.source_wan_ip = ? AND pf.external_port = ? AND (pf.protocol = ? OR pf.protocol = 'TCP/UDP' OR ? = 'TCP/UDP')
  `, source_wan_ip, extPortNum, proto, proto);

  if (conflict) {
    return res.status(409).json({
      error: `Conflito de Porta Externa! A porta WAN ${extPortNum} (${proto}) já está em uso pelo serviço "${conflict.service_name}" no equipamento ${conflict.equipment_name}.`,
      conflictWith: conflict
    });
  }

  const id = 'pf_' + crypto.randomUUID().slice(0, 8);
  execute(`
    INSERT INTO port_forwards (
      id, client_id, location_id, equipment_id, service_name, source_wan_ip,
      external_port, destination_local_ip, internal_port, protocol,
      router_config_path, status, service_order_id, notes,
      internal_notes, additional_info
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    id, client_id, location_id, equipment_id, service_name, source_wan_ip,
    extPortNum, destination_local_ip, intPortNum, proto,
    router_config_path || null, status || 'nao_testada', service_order_id || null, notes || null,
    internal_notes || null, additional_info || null
  );

  execute(`
    INSERT INTO audit_history (id, client_id, location_id, equipment_id, user_name, action, entity_type, entity_name, field_name, new_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    'aud_' + crypto.randomUUID().slice(0, 8), client_id, location_id, equipment_id,
    req.user?.name || 'Técnico', 'PORT_FORWARD_ADD', 'port_forward', service_name,
    'Redirecionamento', `${source_wan_ip}:${extPortNum} -> ${destination_local_ip}:${intPortNum} (${proto})`
  );

  const created = queryOne('SELECT * FROM port_forwards WHERE id = ?', id);
  res.status(201).json(created);
});

portForwardsRouter.put('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM port_forwards WHERE id = ?', id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Regra de porta não encontrada.' });
  }

  const {
    equipment_id, service_name, source_wan_ip, external_port,
    destination_local_ip, internal_port, protocol,
    router_config_path, status, service_order_id, notes,
    internal_notes, additional_info
  } = req.body;

  const extPortNum = Number(external_port);
  const intPortNum = Number(internal_port);
  const proto = protocol || 'TCP';

  const conflict = queryOne(`
    SELECT pf.*, e.name AS equipment_name 
    FROM port_forwards pf
    JOIN equipments e ON e.id = pf.equipment_id
    WHERE pf.source_wan_ip = ? AND pf.external_port = ? AND (pf.protocol = ? OR pf.protocol = 'TCP/UDP' OR ? = 'TCP/UDP') AND pf.id != ?
  `, source_wan_ip, extPortNum, proto, proto, id);

  if (conflict) {
    return res.status(409).json({
      error: `Conflito de Porta Externa! A porta WAN ${extPortNum} (${proto}) já está em uso pelo serviço "${conflict.service_name}" no equipamento ${conflict.equipment_name}.`,
      conflictWith: conflict
    });
  }

  execute(`
    UPDATE port_forwards SET
      equipment_id = ?, service_name = ?, source_wan_ip = ?, external_port = ?,
      destination_local_ip = ?, internal_port = ?, protocol = ?,
      router_config_path = ?, status = ?, service_order_id = ?, notes = ?,
      internal_notes = ?, additional_info = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    equipment_id, service_name, source_wan_ip, extPortNum,
    destination_local_ip, intPortNum, proto,
    router_config_path || null, status || 'nao_testada', service_order_id || null, notes || null,
    internal_notes !== undefined ? internal_notes : existing.internal_notes,
    additional_info !== undefined ? additional_info : existing.additional_info,
    id
  );

  const updated = queryOne('SELECT * FROM port_forwards WHERE id = ?', id);
  res.json(updated);
});

portForwardsRouter.patch('/:id/status', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['funcionando', 'nao_testada', 'com_falha'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Use funcionando, nao_testada ou com_falha.' });
  }

  const existing = queryOne('SELECT * FROM port_forwards WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Regra de porta não encontrada.' });
  }

  execute('UPDATE port_forwards SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', status, id);

  execute(`
    INSERT INTO audit_history (id, client_id, location_id, equipment_id, user_name, action, entity_type, entity_name, field_name, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    'aud_' + crypto.randomUUID().slice(0, 8), existing.client_id, existing.location_id, existing.equipment_id,
    req.user?.name || 'Técnico', 'STATUS_CHANGE', 'port_forward', existing.service_name, 'Status de Teste', existing.status, status
  );

  const updated = queryOne('SELECT * FROM port_forwards WHERE id = ?', id);
  res.json(updated);
});

portForwardsRouter.delete('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const existing = queryOne('SELECT * FROM port_forwards WHERE id = ?', id);
  if (!existing) {
    return res.status(404).json({ error: 'Regra não encontrada.' });
  }

  execute('DELETE FROM port_forwards WHERE id = ?', id);

  execute(`
    INSERT INTO audit_history (id, client_id, location_id, equipment_id, user_name, action, entity_type, entity_name, field_name, old_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    'aud_' + crypto.randomUUID().slice(0, 8), existing.client_id, existing.location_id, existing.equipment_id,
    req.user?.name || 'Técnico', 'PORT_FORWARD_DELETE', 'port_forward', existing.service_name, 'Regra Removida', `${existing.source_wan_ip}:${existing.external_port}`
  );

  res.json({ message: 'Regra de porta excluída com sucesso.' });
});
