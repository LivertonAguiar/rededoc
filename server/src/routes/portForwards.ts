import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import net from 'node:net';
import { queryAll, queryOne, execute } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

export interface PortTestResult {
  open: boolean;
  latency_ms: number;
  message: string;
  error_code?: string;
}

/**
 * Realiza teste ativo de porta TCP via handshake de socket com medição de latência
 */
export function checkTcpPort(host: string, port: number, timeoutMs = 3500): Promise<PortTestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();

    let resolved = false;
    const finish = (result: PortTestResult) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const latency_ms = Date.now() - startTime;
      finish({
        open: true,
        latency_ms,
        message: `Porta ${port} aberta e respondendo no host ${host} (${latency_ms}ms)`
      });
    });

    socket.on('timeout', () => {
      const latency_ms = Date.now() - startTime;
      finish({
        open: false,
        latency_ms,
        error_code: 'ETIMEDOUT',
        message: `Tempo limite esgotado (${timeoutMs}ms). Possível bloqueio de firewall, CGNAT ou host inacessível.`
      });
    });

    socket.on('error', (err: any) => {
      const latency_ms = Date.now() - startTime;
      const code = err.code || 'UNKNOWN';
      let message = `Falha na conexão (${code})`;
      if (code === 'ECONNREFUSED') {
        message = `Conexão recusada pela porta ${port} no host ${host}. Serviço offline ou regra de NAT ausente no roteador.`;
      } else if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') {
        message = `Host ou rede inalcançável (${host}). Verifique a rota da WAN.`;
      }
      finish({
        open: false,
        latency_ms,
        error_code: code,
        message
      });
    });

    try {
      socket.connect(port, host);
    } catch (err: any) {
      finish({
        open: false,
        latency_ms: 0,
        error_code: 'EXCEPTION',
        message: err.message || 'Erro ao inicializar conexão de socket'
      });
    }
  });
}

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

// Endpoint: Testar conectividade de uma regra específica
portForwardsRouter.post('/:id/test', async (req: AuthRequest, res: Response): Promise<any> => {
  const { id } = req.params;
  const rule = queryOne('SELECT * FROM port_forwards WHERE id = ?', id);
  if (!rule) {
    return res.status(404).json({ error: 'Regra de porta não encontrada.' });
  }

  const result = await checkTcpPort(rule.source_wan_ip, Number(rule.external_port));
  const newStatus = result.open ? 'funcionando' : 'com_falha';

  execute('UPDATE port_forwards SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStatus, id);

  execute(`
    INSERT INTO audit_history (id, client_id, location_id, equipment_id, user_name, action, entity_type, entity_name, field_name, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    'aud_' + crypto.randomUUID().slice(0, 8), rule.client_id, rule.location_id, rule.equipment_id,
    req.user?.name || 'Técnico', 'PORT_TEST', 'port_forward', rule.service_name, 'Teste Real de Porta TCP',
    rule.status, `${newStatus} (${result.latency_ms}ms)`
  );

  const updated = queryOne('SELECT * FROM port_forwards WHERE id = ?', id);
  res.json({
    ...result,
    status: newStatus,
    rule: updated
  });
});

// Endpoint: Testar todas as regras de portas de um cliente em lote
portForwardsRouter.post('/test-all', async (req: AuthRequest, res: Response): Promise<any> => {
  const { clientId } = req.body;
  let query = 'SELECT * FROM port_forwards WHERE 1=1';
  const params: any[] = [];
  if (clientId) {
    query += ' AND client_id = ?';
    params.push(clientId);
  }
  const rules = queryAll(query, ...params);
  const results = [];

  for (const rule of rules) {
    const resTest = await checkTcpPort(rule.source_wan_ip, Number(rule.external_port), 2500);
    const newStatus = resTest.open ? 'funcionando' : 'com_falha';
    execute('UPDATE port_forwards SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', newStatus, rule.id);
    results.push({
      id: rule.id,
      service_name: rule.service_name,
      external_port: rule.external_port,
      open: resTest.open,
      latency_ms: resTest.latency_ms,
      status: newStatus,
      message: resTest.message
    });
  }

  res.json({ tested: results.length, results });
});

// Endpoint: Teste direto avulso de host/porta (sem regra cadastrada)
portForwardsRouter.post('/test-direct', async (req: Request, res: Response): Promise<any> => {
  const { host, port } = req.body;
  if (!host || !port) {
    return res.status(400).json({ error: 'Host e Porta são obrigatórios para o teste.' });
  }
  const result = await checkTcpPort(String(host), Number(port));
  res.json(result);
});
