import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { queryAll, queryOne, execute } from '../db/database.js';
import { validateBody } from '../middleware/validate.js';
import { linkSchema } from '../schemas/index.js';
import { AuthRequest } from '../middleware/auth.js';

export const linksRouter = Router();

export interface RelatedItemDto {
  linkId?: string;
  type: string;
  id: string;
  title: string;
  subtitle: string;
  clientId: string;
  origin: 'implicit' | 'manual';
  label?: string | null;
  createdAt?: string;
}

/**
 * Resolve metadados legíveis de uma entidade para exibição uniforme
 */
function resolveEntityInfo(type: string, id: string): { title: string; subtitle: string; clientId: string } | null {
  try {
    switch (type) {
      case 'equipment': {
        const eq = queryOne<any>('SELECT name, model, manufacturer, local_ip, client_id FROM equipments WHERE id = ?', id);
        if (!eq) return null;
        return {
          title: eq.name,
          subtitle: `${eq.manufacturer || ''} ${eq.model || ''} (${eq.local_ip || 'Sem IP'})`.trim(),
          clientId: eq.client_id
        };
      }
      case 'credential': {
        const c = queryOne<any>('SELECT name, category, username, client_id FROM credentials WHERE id = ?', id);
        if (!c) return null;
        return {
          title: c.name,
          subtitle: `${c.category || 'Credencial'} • ${c.username || 'Sem usuário'}`.trim(),
          clientId: c.client_id
        };
      }
      case 'port_forward': {
        const pf = queryOne<any>('SELECT service_name, external_port, internal_port, protocol, destination_local_ip, client_id FROM port_forwards WHERE id = ?', id);
        if (!pf) return null;
        return {
          title: pf.service_name,
          subtitle: `WAN ${pf.external_port} → LAN ${pf.destination_local_ip || ''}:${pf.internal_port} (${pf.protocol?.toUpperCase()})`,
          clientId: pf.client_id
        };
      }
      case 'service_order': {
        const so = queryOne<any>('SELECT service_type, status, date_time, client_id FROM service_orders WHERE id = ?', id);
        if (!so) return null;
        return {
          title: so.service_type,
          subtitle: `${so.status === 'concluido' ? 'Concluído' : 'Em andamento'} • ${so.date_time ? so.date_time.slice(0, 10) : ''}`,
          clientId: so.client_id
        };
      }
      case 'attachment': {
        const att = queryOne<any>('SELECT original_name, category, file_size, client_id FROM attachments WHERE id = ?', id);
        if (!att) return null;
        return {
          title: att.original_name,
          subtitle: `${att.category || 'Anexo'} • ${Math.round(att.file_size / 1024)} KB`,
          clientId: att.client_id
        };
      }
      case 'client': {
        const cl = queryOne<any>('SELECT name, document FROM clients WHERE id = ?', id);
        if (!cl) return null;
        return {
          title: cl.name,
          subtitle: cl.document || 'Cliente',
          clientId: id
        };
      }
      case 'location': {
        const loc = queryOne<any>('SELECT name, address, client_id FROM locations WHERE id = ?', id);
        if (!loc) return null;
        return {
          title: loc.name,
          subtitle: loc.address || 'Localização',
          clientId: loc.client_id
        };
      }
      case 'article': {
        const art = queryOne<any>('SELECT title, tags, client_id FROM articles WHERE id = ?', id);
        if (!art) return null;
        return {
          title: art.title,
          subtitle: art.tags || 'Procedimento Técnico',
          clientId: art.client_id || ''
        };
      }
      case 'domain': {
        const dom = queryOne<any>('SELECT name, registrar, client_id FROM domains WHERE id = ?', id);
        if (!dom) return null;
        return {
          title: dom.name,
          subtitle: dom.registrar || 'Domínio / DNS',
          clientId: dom.client_id
        };
      }
      case 'subnet': {
        const sub = queryOne<any>('SELECT name, cidr, client_id FROM subnets WHERE id = ?', id);
        if (!sub) return null;
        return {
          title: sub.name,
          subtitle: sub.cidr || 'Sub-rede IPAM',
          clientId: sub.client_id
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * GET /api/links?type=...&id=...
 * Retorna todos os vínculos (implícitos por foreign keys + explícitos em entity_links)
 */
linksRouter.get('/', (req: AuthRequest, res: Response): any => {
  const { type, id } = req.query;
  if (!type || !id || typeof type !== 'string' || typeof id !== 'string') {
    return res.status(400).json({ error: 'Parâmetros type e id são obrigatórios.' });
  }

  const itemsMap = new Map<string, RelatedItemDto>();

  // 1. Busca Vínculos Implícitos baseados no modelo de dados
  if (type === 'equipment') {
    // Credenciais vinculadas ao equipamento
    const creds = queryAll<any>('SELECT id FROM credentials WHERE equipment_id = ?', id);
    for (const c of creds) {
      const info = resolveEntityInfo('credential', c.id);
      if (info) {
        itemsMap.set(`credential:${c.id}`, {
          type: 'credential',
          id: c.id,
          ...info,
          origin: 'implicit',
          label: 'Credencial de Acesso'
        });
      }
    }

    // Regras NAT vinculadas ao equipamento
    const pfs = queryAll<any>('SELECT id FROM port_forwards WHERE equipment_id = ?', id);
    for (const pf of pfs) {
      const info = resolveEntityInfo('port_forward', pf.id);
      if (info) {
        itemsMap.set(`port_forward:${pf.id}`, {
          type: 'port_forward',
          id: pf.id,
          ...info,
          origin: 'implicit',
          label: 'Regra de NAT'
        });
      }
    }

    // Atendimentos envolvendo o equipamento
    const sos = queryAll<any>("SELECT id FROM service_orders WHERE equipments_involved LIKE '%' || ? || '%'", id);
    for (const so of sos) {
      const info = resolveEntityInfo('service_order', so.id);
      if (info) {
        itemsMap.set(`service_order:${so.id}`, {
          type: 'service_order',
          id: so.id,
          ...info,
          origin: 'implicit',
          label: 'Ordem de Serviço'
        });
      }
    }

    // Anexos vinculados ao equipamento
    const atts = queryAll<any>('SELECT id FROM attachments WHERE equipment_id = ?', id);
    for (const att of atts) {
      const info = resolveEntityInfo('attachment', att.id);
      if (info) {
        itemsMap.set(`attachment:${att.id}`, {
          type: 'attachment',
          id: att.id,
          ...info,
          origin: 'implicit',
          label: 'Arquivo Anexado'
        });
      }
    }
  } else if (type === 'credential') {
    const cred = queryOne<any>('SELECT equipment_id FROM credentials WHERE id = ?', id);
    if (cred?.equipment_id) {
      const info = resolveEntityInfo('equipment', cred.equipment_id);
      if (info) {
        itemsMap.set(`equipment:${cred.equipment_id}`, {
          type: 'equipment',
          id: cred.equipment_id,
          ...info,
          origin: 'implicit',
          label: 'Equipamento Vinculado'
        });
      }
    }
  } else if (type === 'port_forward') {
    const pf = queryOne<any>('SELECT equipment_id FROM port_forwards WHERE id = ?', id);
    if (pf?.equipment_id) {
      const info = resolveEntityInfo('equipment', pf.equipment_id);
      if (info) {
        itemsMap.set(`equipment:${pf.equipment_id}`, {
          type: 'equipment',
          id: pf.equipment_id,
          ...info,
          origin: 'implicit',
          label: 'Equipamento de Destino'
        });
      }
    }
  } else if (type === 'service_order') {
    const so = queryOne<any>('SELECT equipments_involved FROM service_orders WHERE id = ?', id);
    if (so?.equipments_involved) {
      const eqIds: string[] = typeof so.equipments_involved === 'string'
        ? (so.equipments_involved.startsWith('[') ? JSON.parse(so.equipments_involved) : so.equipments_involved.split(','))
        : [];
      for (const eqId of eqIds) {
        const cleanId = String(eqId).trim();
        if (cleanId) {
          const info = resolveEntityInfo('equipment', cleanId);
          if (info) {
            itemsMap.set(`equipment:${cleanId}`, {
              type: 'equipment',
              id: cleanId,
              ...info,
              origin: 'implicit',
              label: 'Equipamento Atendido'
            });
          }
        }
      }
    }
  } else if (type === 'attachment') {
    const att = queryOne<any>('SELECT equipment_id, service_order_id FROM attachments WHERE id = ?', id);
    if (att?.equipment_id) {
      const info = resolveEntityInfo('equipment', att.equipment_id);
      if (info) {
        itemsMap.set(`equipment:${att.equipment_id}`, {
          type: 'equipment',
          id: att.equipment_id,
          ...info,
          origin: 'implicit',
          label: 'Equipamento'
        });
      }
    }
    if (att?.service_order_id) {
      const info = resolveEntityInfo('service_order', att.service_order_id);
      if (info) {
        itemsMap.set(`service_order:${att.service_order_id}`, {
          type: 'service_order',
          id: att.service_order_id,
          ...info,
          origin: 'implicit',
          label: 'Ordem de Serviço'
        });
      }
    }
  }

  // 2. Busca Vínculos Explícitos (tabela entity_links) nos dois sentidos
  const explicitLinks = queryAll<any>(`
    SELECT * FROM entity_links
    WHERE (source_type = ? AND source_id = ?)
       OR (target_type = ? AND target_id = ?)
    ORDER BY created_at DESC
  `, type, id, type, id);

  for (const l of explicitLinks) {
    const isSource = (l.source_type === type && l.source_id === id);
    const relatedType = isSource ? l.target_type : l.source_type;
    const relatedId = isSource ? l.target_id : l.source_id;

    const info = resolveEntityInfo(relatedType, relatedId);
    if (info) {
      itemsMap.set(`${relatedType}:${relatedId}`, {
        linkId: l.id,
        type: relatedType,
        id: relatedId,
        ...info,
        origin: 'manual',
        label: l.label || (isSource ? 'Vinculado' : 'Referenciado por'),
        createdAt: l.created_at
      });
    }
  }

  res.json(Array.from(itemsMap.values()));
});

/**
 * GET /api/links/available?clientId=...&excludeType=...&excludeId=...
 * Lista candidatos do mesmo cliente disponíveis para criação de novo vínculo
 */
linksRouter.get('/available', (req: AuthRequest, res: Response): any => {
  const { clientId, excludeType, excludeId } = req.query;
  if (!clientId || typeof clientId !== 'string') {
    return res.status(400).json({ error: 'clientId é obrigatório.' });
  }

  const results: Array<{ type: string; id: string; title: string; subtitle: string; category: string }> = [];

  // Equipamentos
  const eqs = queryAll<any>('SELECT id, name, model, local_ip FROM equipments WHERE client_id = ? ORDER BY name ASC', clientId);
  for (const eq of eqs) {
    if (excludeType === 'equipment' && excludeId === eq.id) continue;
    results.push({
      type: 'equipment',
      id: eq.id,
      title: eq.name,
      subtitle: `${eq.model || 'Equipamento'} (${eq.local_ip || 'Sem IP'})`,
      category: 'Equipamentos'
    });
  }

  // Credenciais
  const creds = queryAll<any>('SELECT id, name, username, category FROM credentials WHERE client_id = ? ORDER BY name ASC', clientId);
  for (const c of creds) {
    if (excludeType === 'credential' && excludeId === c.id) continue;
    results.push({
      type: 'credential',
      id: c.id,
      title: c.name,
      subtitle: `${c.category} • ${c.username || 'Sem usuário'}`,
      category: 'Credenciais'
    });
  }

  // Regras de NAT / Portas
  const pfs = queryAll<any>('SELECT id, service_name, external_port, internal_port FROM port_forwards WHERE client_id = ? ORDER BY service_name ASC', clientId);
  for (const pf of pfs) {
    if (excludeType === 'port_forward' && excludeId === pf.id) continue;
    results.push({
      type: 'port_forward',
      id: pf.id,
      title: pf.service_name,
      subtitle: `Porta WAN ${pf.external_port} → LAN ${pf.internal_port}`,
      category: 'Redirecionamento de Portas'
    });
  }

  // Atendimentos / Ordens de Serviço
  const sos = queryAll<any>('SELECT id, service_type, date_time FROM service_orders WHERE client_id = ? ORDER BY date_time DESC', clientId);
  for (const so of sos) {
    if (excludeType === 'service_order' && excludeId === so.id) continue;
    results.push({
      type: 'service_order',
      id: so.id,
      title: so.service_type,
      subtitle: so.date_time ? so.date_time.slice(0, 10) : 'Atendimento',
      category: 'Atendimentos'
    });
  }

  // Artigos de Base de Conhecimento (globais ou do cliente)
  try {
    const arts = queryAll<any>('SELECT id, title, tags FROM articles WHERE client_id = ? OR client_id IS NULL ORDER BY title ASC', clientId);
    for (const a of arts) {
      if (excludeType === 'article' && excludeId === a.id) continue;
      results.push({
        type: 'article',
        id: a.id,
        title: a.title,
        subtitle: a.tags || 'Procedimento',
        category: 'Procedimentos'
      });
    }
  } catch {}

  res.json(results);
});

/**
 * POST /api/links
 * Cria um vínculo explícito manual entre duas entidades
 */
linksRouter.post('/', validateBody(linkSchema), (req: AuthRequest, res: Response): any => {
  const { client_id, source_type, source_id, target_type, target_id, label } = req.body;
  const userName = req.user?.name || 'Sistema';

  // Verifica se o vínculo já existe em qualquer um dos dois sentidos
  const existing = queryOne<any>(`
    SELECT id FROM entity_links
    WHERE (source_type = ? AND source_id = ? AND target_type = ? AND target_id = ?)
       OR (source_type = ? AND source_id = ? AND target_type = ? AND target_id = ?)
  `, source_type, source_id, target_type, target_id, target_type, target_id, source_type, source_id);

  if (existing) {
    return res.status(409).json({ error: 'Este vínculo entre os dois registros já existe.', linkId: existing.id });
  }

  const id = 'link_' + crypto.randomUUID().slice(0, 8);
  execute(`
    INSERT INTO entity_links (id, client_id, source_type, source_id, target_type, target_id, label, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, id, client_id, source_type, source_id, target_type, target_id, label || null, userName);

  // Registro de auditoria
  try {
    execute(`
      INSERT INTO audit_history (
        id, client_id, user_name, action, entity_type, entity_name, field_name, new_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      'aud_' + crypto.randomUUID().slice(0, 8),
      client_id,
      userName,
      'create',
      'entity_link',
      `${source_type} -> ${target_type}`,
      'link',
      `${source_id} <-> ${target_id} (${label || 'manual'})`
    );
  } catch {}

  const created = queryOne('SELECT * FROM entity_links WHERE id = ?', id);
  res.status(201).json(created);
});

/**
 * DELETE /api/links/:id
 * Remove um vínculo explícito manual
 */
linksRouter.delete('/:id', (req: AuthRequest, res: Response): any => {
  const { id } = req.params;
  const link = queryOne<any>('SELECT * FROM entity_links WHERE id = ?', id);
  if (!link) {
    return res.status(404).json({ error: 'Vínculo não encontrado.' });
  }

  execute('DELETE FROM entity_links WHERE id = ?', id);

  // Registro de auditoria
  try {
    execute(`
      INSERT INTO audit_history (
        id, client_id, user_name, action, entity_type, entity_name, field_name, old_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      'aud_' + crypto.randomUUID().slice(0, 8),
      link.client_id,
      req.user?.name || 'Sistema',
      'delete',
      'entity_link',
      `${link.source_type} -> ${link.target_type}`,
      'link',
      `${link.source_id} <-> ${link.target_id}`
    );
  } catch {}

  res.json({ message: 'Vínculo removido com sucesso.' });
});
