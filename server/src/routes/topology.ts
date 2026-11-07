import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';

export const topologyRouter = Router();

topologyRouter.get('/', (req: Request, res: Response): any => {
  const { clientId, locationId } = req.query;
  if (!clientId) {
    return res.status(400).json({ error: 'clientId é obrigatório.' });
  }

  const allClientEquipments = queryAll(`
    SELECT e.* FROM equipments e
    WHERE e.client_id = ? ${locationId ? 'AND e.location_id = ?' : ''}
    ORDER BY CASE WHEN e.category = 'router_ont' THEN 0 ELSE 1 END, e.name ASC
  `, ...(locationId ? [clientId, locationId] : [clientId])) as any[];

  let topo = queryOne(`
    SELECT * FROM network_topology
    WHERE client_id = ? ${locationId ? 'AND location_id = ?' : ''}
    LIMIT 1
  `, ...(locationId ? [clientId, locationId] : [clientId])) as any;

  if (topo) {
    const nodes = JSON.parse(topo.nodes_data || '[]');
    const edges = JSON.parse(topo.edges_data || '[]');
    const nodeIds = new Set(nodes.map((n: any) => n.id));

    // Identifica equipamentos cadastrados que ainda não estão presentes na topologia salva
    const availableEquipments = allClientEquipments.filter(eq => !nodeIds.has(eq.id));

    return res.json({
      id: topo.id,
      client_id: topo.client_id,
      location_id: topo.location_id,
      view_mode: topo.view_mode,
      nodes,
      edges,
      available_equipments: availableEquipments,
      updated_at: topo.updated_at
    });
  }

  const equipments = allClientEquipments;

  // Se o cliente não tem nenhum equipamento cadastrado, retorna topologia vazia (em branco)
  if (equipments.length === 0) {
    return res.json({
      id: 'topo_empty',
      client_id: clientId,
      location_id: locationId || null,
      view_mode: 'detailed',
      nodes: [],
      edges: [],
      available_equipments: [],
      updated_at: new Date().toISOString()
    });
  }

  const router = equipments.find(e => e.category === 'router_ont' || e.category === 'router' || e.category === 'ont' || Boolean(e.public_wan_ip)) || equipments[0];
  const wanIp = router?.public_wan_ip || null;

  const nodes: any[] = [
    {
      id: 'internet',
      label: 'Internet',
      ip: wanIp,
      type: 'internet',
      x: 400,
      y: 40
    }
  ];

  const edges: any[] = [];

  if (router) {
    nodes.push({
      id: router.id,
      label: router.name,
      sublabel: `${router.manufacturer || ''} ${router.model || ''}`.trim(),
      ip: router.local_ip || '192.168.1.1',
      type: router.category || 'router_ont',
      photo_url: router.photo_url || null,
      x: 400,
      y: 160
    });
    edges.push({ from: 'internet', to: router.id, label: 'WAN' });

    const others = equipments.filter(e => e.id !== router.id);
    const startX = 120;
    const spacing = others.length > 1 ? 560 / (others.length - 1) : 0;

    others.forEach((eq, idx) => {
      const ports = queryAll('SELECT external_port, internal_port, status FROM port_forwards WHERE equipment_id = ?', eq.id) as any[];
      let portBadge = '';
      let status = 'sem_regras';

      if (ports.length > 0) {
        portBadge = `${ports[0].external_port} → ${ports[0].internal_port}${ports.length > 1 ? ` +${ports.length - 1}` : ''}`;
        const hasFailure = ports.some(p => p.status === 'com_falha');
        const allWorking = ports.every(p => p.status === 'funcionando');
        status = hasFailure ? 'com_falha' : (allWorking ? 'funcionando' : 'nao_testada');
      }

      nodes.push({
        id: eq.id,
        label: eq.name,
        sublabel: `${eq.manufacturer || ''} ${eq.model || ''}`.trim(),
        ip: eq.local_ip,
        mac: eq.mac_address,
        type: eq.category,
        photo_url: eq.photo_url || null,
        x: others.length === 1 ? 400 : Math.round(startX + idx * spacing),
        y: 300,
        portBadge,
        status
      });

      edges.push({
        from: router.id,
        to: eq.id,
        label: `LAN ${idx + 1}`
      });
    });
  }

  res.json({
    id: 'topo_auto',
    client_id: clientId,
    location_id: locationId || (router?.location_id ?? null),
    view_mode: 'detailed',
    nodes,
    edges,
    available_equipments: [],
    is_auto_generated: true
  });
});

topologyRouter.post('/', (req: Request, res: Response): any => {
  let { client_id, location_id, nodes, edges, view_mode } = req.body;
  if (!client_id) {
    return res.status(400).json({ error: 'client_id é obrigatório.' });
  }

  // Se location_id não foi passado, recupera ou cria a localização padrão do cliente
  if (!location_id) {
    const loc = queryOne('SELECT id FROM locations WHERE client_id = ? LIMIT 1', client_id) as any;
    if (loc) {
      location_id = loc.id;
    } else {
      location_id = 'loc_' + crypto.randomUUID().slice(0, 8);
      execute('INSERT INTO locations (id, client_id, name) VALUES (?, ?, ?)', location_id, client_id, 'Sede Principal');
    }
  }

  const nodesJson = JSON.stringify(nodes || []);
  const edgesJson = JSON.stringify(edges || []);
  const mode = view_mode || 'detailed';

  const existing = queryOne('SELECT id FROM network_topology WHERE client_id = ? AND location_id = ?', client_id, location_id);

  if (existing) {
    execute(`
      UPDATE network_topology
      SET nodes_data = ?, edges_data = ?, view_mode = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, nodesJson, edgesJson, mode, existing.id);
  } else {
    const id = 'topo_' + crypto.randomUUID().slice(0, 8);
    execute(`
      INSERT INTO network_topology (id, client_id, location_id, nodes_data, edges_data, view_mode)
      VALUES (?, ?, ?, ?, ?, ?)
    `, id, client_id, location_id, nodesJson, edgesJson, mode);
  }

  res.json({ message: 'Topologia salva com sucesso.' });
});

// Redefine a topologia para o layout gerado automaticamente a partir dos equipamentos
topologyRouter.delete('/reset', (req: Request, res: Response): any => {
  const { clientId, locationId } = req.query;
  if (!clientId) {
    return res.status(400).json({ error: 'clientId é obrigatório.' });
  }

  execute(`
    DELETE FROM network_topology
    WHERE client_id = ? ${locationId ? 'AND location_id = ?' : ''}
  `, ...(locationId ? [clientId, locationId] : [clientId]));

  res.json({ message: 'Topologia redefinida para o layout padrão com sucesso.' });
});
