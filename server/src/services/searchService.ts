import { db, queryAll, queryOne, execute } from '../db/database.js';

export interface SearchResultItem {
  id: string;
  type: 'client' | 'location' | 'equipment' | 'credential' | 'port_forward' | 'service_order' | 'article' | 'domain';
  title: string;
  subtitle: string;
  clientId?: string | null;
  clientName?: string | null;
  urlHash: string;
  badge?: string;
}

export interface GroupedSearchResults {
  total: number;
  results: SearchResultItem[];
  byType: Record<string, SearchResultItem[]>;
}

/**
 * Remove pontuações de MAC Address para possibilitar buscas flexíveis (ex: 001a2b3c4d5e)
 */
export function normalizeMac(mac?: string | null): string {
  if (!mac) return '';
  return mac.toLowerCase().replace(/[^a-f0-9]/g, '');
}

/**
 * Sanitiza a query do usuário para evitar erros de sintaxe no parser do FTS5
 */
export function sanitizeFtsQuery(raw: string): string {
  const clean = raw.trim().replace(/['"*:^()]/g, ' ');
  const words = clean.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return '';

  // Converte cada palavra em busca por prefixo (ex: "hua*" "192.168*")
  return words.map(w => `"${w}"*`).join(' ');
}

let isFts5Supported = true;

/**
 * Inicializa a tabela virtual FTS5 e os triggers automáticos de sincronização
 */
export function initSearchIndex() {
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
        entity_type UNINDEXED,
        entity_id UNINDEXED,
        client_id UNINDEXED,
        title,
        body,
        tokenize = 'unicode61 remove_diacritics 2'
      );
    `);
    isFts5Supported = true;
  } catch (err: any) {
    console.warn('FTS5 não suportado ou falhou na inicialização. Usando fallback:', err.message);
    isFts5Supported = false;
    return;
  }

  // Verifica se o índice já tem registros; se estiver vazio, popula inicialmente
  try {
    const row = queryOne<any>('SELECT count(*) as count FROM search_index');
    if (!row || row.count === 0) {
      rebuildSearchIndex();
    }
  } catch {
    rebuildSearchIndex();
  }
}

/**
 * Reconstrói o índice de busca global indexando todas as entidades existentes
 */
export function rebuildSearchIndex() {
  if (!isFts5Supported) return;

  try {
    db.exec('DELETE FROM search_index;');

    // 1. Clientes
    const clients = queryAll<any>('SELECT id, name, identification_name, document, phone, email, address, notes FROM clients');
    for (const c of clients) {
      const body = [c.identification_name, c.document, c.phone, c.email, c.address, c.notes].filter(Boolean).join(' ');
      indexEntity('client', c.id, c.id, c.name, body);
    }

    // 2. Locais
    const locations = queryAll<any>(`
      SELECT l.id, l.client_id, l.name, l.address, l.contact_name, l.access_notes, c.name as client_name
      FROM locations l
      JOIN clients c ON c.id = l.client_id
    `);
    for (const loc of locations) {
      const body = [loc.client_name, loc.address, loc.contact_name, loc.access_notes].filter(Boolean).join(' ');
      indexEntity('location', loc.id, loc.client_id, loc.name, body);
    }

    // 3. Equipamentos (Nome, Modelo, Serial, IP, MAC original e MAC normalizado)
    const equipments = queryAll<any>(`
      SELECT e.id, e.client_id, e.name, e.category, e.model, e.serial_number,
             e.local_ip, e.mac_address, e.physical_location, e.notes, c.name as client_name
      FROM equipments e
      JOIN clients c ON c.id = e.client_id
    `);
    for (const eq of equipments) {
      const normMac = normalizeMac(eq.mac_address);
      const body = [
        eq.client_name,
        eq.category,
        eq.model,
        eq.serial_number,
        eq.local_ip,
        eq.mac_address,
        normMac,
        eq.physical_location,
        eq.notes
      ].filter(Boolean).join(' ');
      indexEntity('equipment', eq.id, eq.client_id, eq.name, body);
    }

    // 4. Credenciais (NUNCA incluir senhas!)
    const credentials = queryAll<any>(`
      SELECT cr.id, cr.client_id, cr.name, cr.category, cr.username, cr.access_url, cr.notes, c.name as client_name
      FROM credentials cr
      JOIN clients c ON c.id = cr.client_id
    `);
    for (const cr of credentials) {
      const body = [cr.client_name, cr.category, cr.username, cr.access_url, cr.notes].filter(Boolean).join(' ');
      indexEntity('credential', cr.id, cr.client_id, cr.name, body);
    }

    // 5. Regras de Portas NAT
    const ports = queryAll<any>(`
      SELECT pf.id, pf.client_id, pf.service_name, pf.protocol, pf.external_port,
             pf.internal_port, pf.source_wan_ip, pf.destination_local_ip, c.name as client_name
      FROM port_forwards pf
      JOIN clients c ON c.id = pf.client_id
    `);
    for (const pf of ports) {
      const title = `${pf.service_name} (${pf.external_port} -> ${pf.internal_port})`;
      const body = [
        pf.client_name,
        pf.protocol,
        String(pf.external_port),
        String(pf.internal_port),
        pf.source_wan_ip,
        pf.destination_local_ip
      ].filter(Boolean).join(' ');
      indexEntity('port_forward', pf.id, pf.client_id, title, body);
    }

    // 6. Ordens de Serviço
    const services = queryAll<any>(`
      SELECT so.id, so.client_id, so.service_type, so.problem_description,
             so.technician_name, c.name as client_name
      FROM service_orders so
      JOIN clients c ON c.id = so.client_id
    `);
    for (const so of services) {
      const title = `${so.service_type} - ${so.technician_name}`;
      const body = [so.client_name, so.service_type, so.technician_name, so.problem_description].filter(Boolean).join(' ');
      indexEntity('service_order', so.id, so.client_id, title, body);
    }

    // 7. Artigos da Base de Conhecimento
    const articles = queryAll<any>(`
      SELECT a.id, a.client_id, a.title, a.tags, a.body_md, c.name as client_name
      FROM articles a
      LEFT JOIN clients c ON c.id = a.client_id
    `);
    for (const art of articles) {
      const body = [art.client_name, art.tags, art.body_md].filter(Boolean).join(' ');
      indexEntity('article', art.id, art.client_id, art.title, body);
    }

    // 8. Domínios
    const domains = queryAll<any>(`
      SELECT d.id, d.client_id, d.name, d.registrar, d.notes, c.name as client_name
      FROM domains d
      JOIN clients c ON c.id = d.client_id
    `);
    for (const dom of domains) {
      const body = [dom.client_name, dom.registrar, dom.notes].filter(Boolean).join(' ');
      indexEntity('domain', dom.id, dom.client_id, dom.name, body);
    }
  } catch (err: any) {
    console.error('Erro ao reconstruir o índice de busca global:', err);
  }
}

/**
 * Adiciona ou atualiza uma entidade no índice de busca
 */
export function indexEntity(entityType: string, entityId: string, clientId: string | null, title: string, body: string) {
  if (!isFts5Supported) return;

  try {
    execute('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?', entityType, entityId);
    execute(
      'INSERT INTO search_index (entity_type, entity_id, client_id, title, body) VALUES (?, ?, ?, ?, ?)',
      entityType,
      entityId,
      clientId || null,
      title,
      body
    );
  } catch (err: any) {
    console.error(`Erro ao indexar entidade ${entityType}:${entityId}:`, err);
  }
}

/**
 * Remove uma entidade do índice de busca
 */
export function removeEntityFromIndex(entityType: string, entityId: string) {
  if (!isFts5Supported) return;

  try {
    execute('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?', entityType, entityId);
  } catch {}
}

/**
 * Executa a busca global retornando resultados estruturados com metadados para navegação
 */
export function searchGlobal(query: string, clientId?: string, limit: number = 30): GroupedSearchResults {
  const rawQuery = query.trim();
  if (!rawQuery) {
    return { total: 0, results: [], byType: {} };
  }

  const ftsQuery = sanitizeFtsQuery(rawQuery);
  const normMacQuery = normalizeMac(rawQuery);

  let searchMatches: Array<{ entity_type: string; entity_id: string; client_id: string | null; title: string }> = [];

  if (isFts5Supported && ftsQuery) {
    try {
      let finalFts = ftsQuery;
      if (normMacQuery && normMacQuery !== rawQuery.toLowerCase()) {
        finalFts = `${ftsQuery} OR "${normMacQuery}"*`;
      }

      let sql = 'SELECT entity_type, entity_id, client_id, title FROM search_index WHERE search_index MATCH ?';
      const params: any[] = [finalFts];

      if (clientId) {
        sql += ' AND client_id = ?';
        params.push(clientId);
      }

      sql += ' LIMIT ?';
      params.push(limit);

      searchMatches = queryAll<any>(sql, ...params);
    } catch {
      searchMatches = [];
    }
  }

  // Fallback com LIKE se FTS5 falhou ou retornou vazio para buscas curtas
  if (searchMatches.length === 0) {
    try {
      const pattern = `%${rawQuery}%`;
      const normPattern = normMacQuery ? `%${normMacQuery}%` : pattern;

      let sql = `
        SELECT entity_type, entity_id, client_id, title
        FROM search_index
        WHERE (title LIKE ? OR body LIKE ? OR body LIKE ?)
      `;
      const params: any[] = [pattern, pattern, normPattern];

      if (clientId) {
        sql += ' AND client_id = ?';
        params.push(clientId);
      }

      sql += ' LIMIT ?';
      params.push(limit);

      searchMatches = queryAll<any>(sql, ...params);
    } catch {
      searchMatches = [];
    }
  }

  // Mapeia matches com metadados detalhados de cada entidade
  const results: SearchResultItem[] = [];
  const byType: Record<string, SearchResultItem[]> = {
    client: [],
    equipment: [],
    credential: [],
    port_forward: [],
    service_order: [],
    article: [],
    domain: [],
    location: []
  };

  for (const m of searchMatches) {
    let clientName: string | null = null;
    if (m.client_id) {
      const c = queryOne<any>('SELECT name FROM clients WHERE id = ?', m.client_id);
      if (c) clientName = c.name;
    }

    let subtitle = clientName || 'Geral';
    let urlHash = '';
    let badge = '';

    switch (m.entity_type) {
      case 'client':
        urlHash = `client-network`;
        badge = 'Condomínio / Cliente';
        const cl = queryOne<any>('SELECT address FROM clients WHERE id = ?', m.entity_id);
        if (cl?.address) subtitle = cl.address;
        break;

      case 'equipment':
        urlHash = `equipments/${m.entity_id}`;
        badge = 'Equipamento';
        const eq = queryOne<any>('SELECT model, local_ip FROM equipments WHERE id = ?', m.entity_id);
        if (eq) subtitle = `${clientName ? clientName + ' • ' : ''}${eq.model || ''} (${eq.local_ip || 'Sem IP'})`;
        break;

      case 'credential':
        urlHash = `credentials/${m.entity_id}`;
        badge = 'Credencial';
        const cr = queryOne<any>('SELECT username, category FROM credentials WHERE id = ?', m.entity_id);
        if (cr) subtitle = `${clientName ? clientName + ' • ' : ''}${cr.username || ''} [${cr.category || 'Geral'}]`;
        break;

      case 'port_forward':
        urlHash = `port-forwards/${m.entity_id}`;
        badge = 'Porta (NAT)';
        const pf = queryOne<any>('SELECT external_port, internal_port FROM port_forwards WHERE id = ?', m.entity_id);
        if (pf) subtitle = `${clientName ? clientName + ' • ' : ''}Porta ${pf.external_port} -> ${pf.internal_port}`;
        break;

      case 'service_order':
        urlHash = `service-orders/${m.entity_id}`;
        badge = 'Ordem de Serviço';
        const so = queryOne<any>('SELECT service_date, service_type FROM service_orders WHERE id = ?', m.entity_id);
        if (so) subtitle = `${clientName ? clientName + ' • ' : ''}${so.service_date} (${so.service_type || 'Atendimento'})`;
        break;

      case 'article':
        urlHash = `procedures/${m.entity_id}`;
        badge = 'Procedimento';
        const art = queryOne<any>('SELECT tags FROM articles WHERE id = ?', m.entity_id);
        subtitle = `${clientName ? clientName + ' • ' : 'Global • '}Tags: ${art?.tags || 'procedimento'}`;
        break;

      case 'domain':
        urlHash = `domains/${m.entity_id}`;
        badge = 'Domínio & DNS';
        const dom = queryOne<any>('SELECT registrar, score FROM domains WHERE id = ?', m.entity_id);
        subtitle = `${clientName ? clientName + ' • ' : ''}${dom?.registrar || 'DNS'} • Score: ${dom?.score ?? 0}/100`;
        break;

      case 'location':
        urlHash = `client-network`;
        badge = 'Local Físico';
        break;
    }

    const item: SearchResultItem = {
      id: m.entity_id,
      type: m.entity_type as any,
      title: m.title,
      subtitle,
      clientId: m.client_id,
      clientName,
      urlHash,
      badge
    };

    results.push(item);
    if (!byType[m.entity_type]) byType[m.entity_type] = [];
    byType[m.entity_type].push(item);
  }

  return {
    total: results.length,
    results,
    byType
  };
}
