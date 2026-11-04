import { Router, Request, Response } from 'express';
import { queryAll, queryOne } from '../db/database.js';
import { checkClientWanStatus } from '../services/wanService.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', (req: Request, res: Response) => {
  const { clientId } = req.query;

  let clientFilter = clientId ? 'WHERE client_id = ?' : '';
  const params = clientId ? [clientId] : [];

  const totalClients = (queryOne('SELECT COUNT(*) as count FROM clients') as any).count;
  const totalEquipments = (queryOne(`SELECT COUNT(*) as count FROM equipments ${clientFilter}`, ...params) as any).count;
  
  const inProgressServices = (queryOne(`SELECT COUNT(*) as count FROM service_orders WHERE status = 'em_andamento' ${clientId ? 'AND client_id = ?' : ''}`, ...params) as any).count;
  const completedServices = (queryOne(`SELECT COUNT(*) as count FROM service_orders WHERE status = 'concluido' ${clientId ? 'AND client_id = ?' : ''}`, ...params) as any).count;

  const totalPortRules = (queryOne(`SELECT COUNT(*) as count FROM port_forwards ${clientFilter}`, ...params) as any).count;
  const validatedPortRules = (queryOne(`SELECT COUNT(*) as count FROM port_forwards WHERE status = 'funcionando' ${clientId ? 'AND client_id = ?' : ''}`, ...params) as any).count;
  const failedPortRules = (queryOne(`SELECT COUNT(*) as count FROM port_forwards WHERE status = 'com_falha' ${clientId ? 'AND client_id = ?' : ''}`, ...params) as any).count;

  const needingReview = queryAll(`
    SELECT DISTINCT e.id, e.name, e.model, e.local_ip, c.name as client_name, pf.status as issue_status, pf.service_name
    FROM equipments e
    JOIN clients c ON c.id = e.client_id
    JOIN port_forwards pf ON pf.equipment_id = e.id
    WHERE pf.status = 'com_falha' ${clientId ? 'AND e.client_id = ?' : ''}
    LIMIT 5
  `, ...params);

  const recentServices = queryAll(`
    SELECT so.*, c.name as client_name, l.name as location_name
    FROM service_orders so
    JOIN clients c ON c.id = so.client_id
    JOIN locations l ON l.id = so.location_id
    ${clientId ? 'WHERE so.client_id = ?' : ''}
    ORDER BY so.date_time DESC
    LIMIT 6
  `, ...params);

  // Resumo de clientes para a Visão Geral global
  const allClients = queryAll(`SELECT * FROM clients ORDER BY name ASC`) as any[];
  const clientsSummary = allClients.map(c => {
    const loc = queryOne(`SELECT * FROM locations WHERE client_id = ? LIMIT 1`, c.id) as any;
    const eqCount = (queryOne(`SELECT COUNT(*) as count FROM equipments WHERE client_id = ?`, c.id) as any)?.count || 0;
    const portCount = (queryOne(`SELECT COUNT(*) as count FROM port_forwards WHERE client_id = ?`, c.id) as any)?.count || 0;
    const valPortCount = (queryOne(`SELECT COUNT(*) as count FROM port_forwards WHERE client_id = ? AND status = 'funcionando'`, c.id) as any)?.count || 0;
    const failPortCount = (queryOne(`SELECT COUNT(*) as count FROM port_forwards WHERE client_id = ? AND status = 'com_falha'`, c.id) as any)?.count || 0;
    const mainRouter = queryOne(`SELECT model, public_wan_ip, local_ip FROM equipments WHERE client_id = ? AND category = 'router_ont' LIMIT 1`, c.id) as any;
    const lastService = queryOne(`SELECT date_time, service_type FROM service_orders WHERE client_id = ? ORDER BY date_time DESC LIMIT 1`, c.id) as any;

    return {
      id: c.id,
      name: c.name,
      identification_name: c.identification_name,
      phone: c.phone,
      email: c.email,
      address: c.address || loc?.address || 'Endereço não informado',
      responsible: loc?.responsible_person || 'Não informado',
      total_equipments: eqCount,
      total_ports: portCount,
      validated_ports: valPortCount,
      failed_ports: failPortCount,
      wan_ip: mainRouter?.public_wan_ip || '—',
      local_ip: mainRouter?.local_ip || '—',
      router_model: mainRouter?.model || (eqCount === 0 ? 'Nenhum' : 'Equipamento'),
      last_service_date: lastService?.date_time || null,
      last_service_type: lastService?.service_type || null
    };
  });

  res.json({
    total_clients: totalClients,
    total_equipments: totalEquipments,
    in_progress_services: inProgressServices,
    completed_services: completedServices,
    total_port_rules: totalPortRules,
    validated_port_rules: validatedPortRules,
    failed_port_rules: failedPortRules,
    equipments_needing_review: needingReview,
    recent_services: recentServices,
    clients_summary: clientsSummary
  });
});

dashboardRouter.get('/wan-check', async (req: Request, res: Response): Promise<any> => {
  const { clientId } = req.query;
  if (!clientId || typeof clientId !== 'string') {
    return res.json({ hasChanged: false, status: 'ok' });
  }

  // Verifica se há registro recente de alteração de IP WAN no histórico deste cliente específico
  const recentWanChange = queryOne(`
    SELECT ah.*, eq.name AS equipment_name
    FROM audit_history ah
    LEFT JOIN equipments eq ON eq.id = ah.equipment_id
    WHERE ah.client_id = ? AND ah.action = 'ALTERACAO_WAN'
    ORDER BY ah.created_at DESC
    LIMIT 1
  `, clientId) as any;

  if (recentWanChange) {
    return res.json({
      hasChanged: true,
      status: 'changed_in_history',
      registeredIp: recentWanChange.old_value,
      currentPublicIp: recentWanChange.new_value,
      changedAt: recentWanChange.created_at,
      userName: recentWanChange.user_name || 'Técnico',
      equipmentName: recentWanChange.equipment_name || recentWanChange.entity_name || 'Roteador / ONT',
      message: `Alteração de IP WAN registrada no histórico em ${recentWanChange.created_at} por ${recentWanChange.user_name || 'Técnico'}. IP anterior: ${recentWanChange.old_value} ➔ Novo IP: ${recentWanChange.new_value}.`
    });
  }

  return res.json({
    hasChanged: false,
    status: 'ok',
    message: 'IP WAN estável conforme registrado no cadastro.'
  });
});

dashboardRouter.get('/quick-search', (req: Request, res: Response): any => {
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.json({ clients: [], equipments: [], ports: [], service_orders: [] });
  }

  const term = `%${q.trim()}%`;

  const clients = queryAll(`
    SELECT id, name, identification_name, phone FROM clients
    WHERE name LIKE ? OR identification_name LIKE ? OR document LIKE ?
    LIMIT 5
  `, term, term, term);

  const equipments = queryAll(`
    SELECT e.id, e.name, e.model, e.local_ip, e.mac_address, e.category, e.client_id, c.name as client_name
    FROM equipments e
    JOIN clients c ON c.id = e.client_id
    WHERE e.name LIKE ? OR e.model LIKE ? OR e.local_ip LIKE ? OR e.mac_address LIKE ? OR e.serial_number LIKE ?
    LIMIT 8
  `, term, term, term, term, term);

  const ports = queryAll(`
    SELECT pf.id, pf.service_name, pf.external_port, pf.destination_local_ip, pf.internal_port, pf.protocol, pf.status, pf.client_id, c.name as client_name
    FROM port_forwards pf
    JOIN clients c ON c.id = pf.client_id
    WHERE pf.service_name LIKE ? OR CAST(pf.external_port AS TEXT) LIKE ? OR pf.destination_local_ip LIKE ? OR CAST(pf.internal_port AS TEXT) LIKE ?
    LIMIT 8
  `, term, term, term, term);

  const serviceOrders = queryAll(`
    SELECT so.id, so.service_type, so.technician_name, so.date_time, so.status, so.client_id, c.name as client_name
    FROM service_orders so
    JOIN clients c ON c.id = so.client_id
    WHERE so.service_type LIKE ? OR so.problem_description LIKE ? OR so.technician_name LIKE ?
    LIMIT 5
  `, term, term, term);

  res.json({
    clients,
    equipments,
    ports,
    service_orders: serviceOrders
  });
});
