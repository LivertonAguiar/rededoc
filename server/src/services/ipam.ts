import { queryAll, queryOne } from '../db/database.js';

export interface CidrInfo {
  networkIp: string;
  prefix: number;
  netmask: string;
  firstUsableIp: string;
  lastUsableIp: string;
  broadcastIp: string;
  totalHosts: number;
}

export interface IpSlot {
  ip: string;
  status: 'free' | 'used' | 'dhcp' | 'dhcp_conflict' | 'conflict' | 'gateway';
  equipment?: {
    id: string;
    name: string;
    model?: string;
    category?: string;
    mac_address?: string;
    is_mac_reserved?: number;
  };
  conflictingEquipments?: Array<{
    id: string;
    name: string;
    model?: string;
    mac_address?: string;
  }>;
}

export interface SubnetUsageReport {
  subnet: any;
  cidrInfo: CidrInfo;
  stats: {
    totalHosts: number;
    usedHosts: number;
    freeHosts: number;
    dhcpHosts: number;
    conflictCount: number;
    usagePercentage: number;
  };
  nextFreeIp: string | null;
  slots: IpSlot[];
}

/**
 * Converte string IPv4 "A.B.C.D" para número inteiro de 32 bits sem sinal
 */
export function ipToLong(ip: string): number {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return 0;
  return (
    ((parseInt(parts[0], 10) << 24) >>> 0) +
    (parseInt(parts[1], 10) << 16) +
    (parseInt(parts[2], 10) << 8) +
    parseInt(parts[3], 10)
  );
}

/**
 * Converte número inteiro de 32 bits sem sinal para string IPv4 "A.B.C.D"
 */
export function longToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.');
}

/**
 * Analisa notação CIDR (ex: "192.168.1.0/24") e extrai faixa utilizável e máscara
 */
export function parseCidr(cidr: string): CidrInfo {
  const [ipPart, prefixPart] = cidr.trim().split('/');
  const prefix = parseInt(prefixPart || '24', 10);
  if (prefix < 0 || prefix > 32) {
    throw new Error('Prefixo CIDR inválido. Deve estar entre 0 e 32.');
  }

  const maskLong = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const ipLong = ipToLong(ipPart);
  const netLong = (ipLong & maskLong) >>> 0;
  const broadcastLong = prefix === 32 ? netLong : (netLong | ~maskLong) >>> 0;

  let firstUsableLong = netLong;
  let lastUsableLong = broadcastLong;
  let totalHosts = 1;

  if (prefix <= 30) {
    firstUsableLong = netLong + 1;
    lastUsableLong = broadcastLong - 1;
    totalHosts = lastUsableLong - firstUsableLong + 1;
  } else if (prefix === 31) {
    totalHosts = 2;
  }

  return {
    networkIp: longToIp(netLong),
    prefix,
    netmask: longToIp(maskLong),
    firstUsableIp: longToIp(firstUsableLong),
    lastUsableIp: longToIp(lastUsableLong),
    broadcastIp: longToIp(broadcastLong),
    totalHosts
  };
}

/**
 * Verifica se um IP pertence à sub-rede informada
 */
export function isIpInSubnet(ip: string, cidr: string): boolean {
  try {
    const { networkIp, prefix } = parseCidr(cidr);
    const maskLong = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    const ipLong = ipToLong(ip);
    const netLong = ipToLong(networkIp);
    return ((ipLong & maskLong) >>> 0) === netLong;
  } catch {
    return false;
  }
}

/**
 * Verifica se um IP está contido no intervalo DHCP
 */
export function isIpInDhcpRange(ip: string, dhcpStart?: string | null, dhcpEnd?: string | null): boolean {
  if (!dhcpStart || !dhcpEnd) return false;
  const ipL = ipToLong(ip);
  const startL = ipToLong(dhcpStart);
  const endL = ipToLong(dhcpEnd);
  return ipL >= startL && ipL <= endL;
}

/**
 * Calcula o mapa de ocupação completo e estatísticas de uma sub-rede
 */
export function getSubnetUsage(subnetId: string): SubnetUsageReport {
  const subnet = queryOne<any>('SELECT * FROM subnets WHERE id = ?', subnetId);
  if (!subnet) {
    throw new Error('Sub-rede não encontrada.');
  }

  const cidrInfo = parseCidr(subnet.cidr);
  const firstL = ipToLong(cidrInfo.firstUsableIp);
  const lastL = ipToLong(cidrInfo.lastUsableIp);

  // Equipamentos do cliente que possuem local_ip
  let eqSql = 'SELECT id, name, model, category, mac_address, local_ip, is_mac_reserved FROM equipments WHERE client_id = ? AND local_ip IS NOT NULL';
  const eqParams: any[] = [subnet.client_id];
  if (subnet.location_id) {
    eqSql += ' AND location_id = ?';
    eqParams.push(subnet.location_id);
  }

  const equipments = queryAll<any>(eqSql, ...eqParams);

  // Mapeia equipamentos por IP (para identificar duplicidades)
  const ipEquipmentsMap = new Map<string, any[]>();
  for (const eq of equipments) {
    const cleanIp = eq.local_ip?.trim();
    if (!cleanIp) continue;
    const list = ipEquipmentsMap.get(cleanIp) || [];
    list.push(eq);
    ipEquipmentsMap.set(cleanIp, list);
  }

  const gatewayIp = subnet.gateway?.trim() || null;
  const dhcpStart = subnet.dhcp_start?.trim() || null;
  const dhcpEnd = subnet.dhcp_end?.trim() || null;

  const slots: IpSlot[] = [];
  let usedCount = 0;
  let conflictCount = 0;
  let dhcpCount = 0;
  let nextFreeIp: string | null = null;

  for (let l = firstL; l <= lastL; l++) {
    const currentIp = longToIp(l);
    const matchedEquipments = ipEquipmentsMap.get(currentIp) || [];
    const isGateway = gatewayIp === currentIp;
    const inDhcp = isIpInDhcpRange(currentIp, dhcpStart, dhcpEnd);

    if (inDhcp) dhcpCount++;

    let status: IpSlot['status'] = 'free';

    if (isGateway) {
      status = 'gateway';
    } else if (matchedEquipments.length > 1) {
      status = 'conflict';
      conflictCount++;
      usedCount++;
    } else if (matchedEquipments.length === 1) {
      const eq = matchedEquipments[0];
      usedCount++;
      if (inDhcp && !eq.is_mac_reserved) {
        status = 'dhcp_conflict'; // Dentro do DHCP sem reserva estática por MAC
        conflictCount++;
      } else {
        status = 'used';
      }
    } else if (inDhcp) {
      status = 'dhcp';
    } else {
      status = 'free';
      if (!nextFreeIp && !isGateway) {
        nextFreeIp = currentIp;
      }
    }

    slots.push({
      ip: currentIp,
      status,
      equipment: matchedEquipments.length === 1 ? matchedEquipments[0] : undefined,
      conflictingEquipments: matchedEquipments.length > 1 ? matchedEquipments : undefined
    });
  }

  const totalHosts = cidrInfo.totalHosts;
  const freeHosts = slots.filter(s => s.status === 'free').length;
  const usagePercentage = totalHosts > 0 ? Math.round((usedCount / totalHosts) * 100) : 0;

  return {
    subnet,
    cidrInfo,
    stats: {
      totalHosts,
      usedHosts: usedCount,
      freeHosts,
      dhcpHosts: dhcpCount,
      conflictCount,
      usagePercentage
    },
    nextFreeIp,
    slots
  };
}

/**
 * Sugere sub-redes para um condomínio com base nos equipamentos cadastrados
 */
export function suggestSubnetsForClient(clientId: string) {
  const equipments = queryAll<any>(`
    SELECT id, name, category, model, local_ip, subnet_mask, gateway, dhcp_range, location_id
    FROM equipments
    WHERE client_id = ? AND local_ip IS NOT NULL AND local_ip != ''
  `, clientId);

  const suggestions: Array<{
    name: string;
    cidr: string;
    gateway: string;
    vlan?: string;
    dhcp_start?: string;
    dhcp_end?: string;
    location_id?: string;
    matchedEquipmentsCount: number;
  }> = [];

  const foundPrefixes = new Set<string>();

  for (const eq of equipments) {
    const ip = eq.local_ip.trim();
    const parts = ip.split('.');
    if (parts.length !== 4) continue;

    const classCPrefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
    if (foundPrefixes.has(classCPrefix)) continue;
    foundPrefixes.add(classCPrefix);

    const gateway = eq.gateway?.trim() || `${classCPrefix}.1`;
    let dhcpStart = `${classCPrefix}.100`;
    let dhcpEnd = `${classCPrefix}.200`;

    if (eq.dhcp_range && eq.dhcp_range.includes('-')) {
      const [s, e] = eq.dhcp_range.split('-').map((t: string) => t.trim());
      if (s) dhcpStart = s.includes('.') ? s : `${classCPrefix}.${s}`;
      if (e) dhcpEnd = e.includes('.') ? e : `${classCPrefix}.${e}`;
    }

    const matchedCount = equipments.filter(e => e.local_ip?.startsWith(`${classCPrefix}.`)).length;

    suggestions.push({
      name: `LAN Principal (${classCPrefix}.0/24)`,
      cidr: `${classCPrefix}.0/24`,
      gateway,
      vlan: '1',
      dhcp_start: dhcpStart,
      dhcp_end: dhcpEnd,
      location_id: eq.location_id || undefined,
      matchedEquipmentsCount: matchedCount
    });
  }

  return suggestions;
}

/**
 * Detecta todos os conflitos de rede de um cliente (IP duplicado ou fora de sub-rede)
 */
export function detectClientIpConflicts(clientId: string) {
  const equipments = queryAll<any>(`
    SELECT e.id, e.name, e.model, e.local_ip, e.mac_address, e.is_mac_reserved, e.location_id, c.name as client_name
    FROM equipments e
    JOIN clients c ON c.id = e.client_id
    WHERE e.client_id = ? AND e.local_ip IS NOT NULL AND TRIM(e.local_ip) != ''
  `, clientId);

  const subnets = queryAll<any>('SELECT * FROM subnets WHERE client_id = ?', clientId);

  const duplicates: Array<{ ip: string; equipments: any[] }> = [];
  const ipMap = new Map<string, any[]>();

  for (const eq of equipments) {
    const list = ipMap.get(eq.local_ip) || [];
    list.push(eq);
    ipMap.set(eq.local_ip, list);
  }

  for (const [ip, list] of ipMap.entries()) {
    if (list.length > 1) {
      duplicates.push({ ip, equipments: list });
    }
  }

  const outOfSubnet: any[] = [];
  const dhcpWithoutReservation: any[] = [];

  if (subnets.length > 0) {
    for (const eq of equipments) {
      const inAnySubnet = subnets.some(sub => isIpInSubnet(eq.local_ip, sub.cidr));
      if (!inAnySubnet) {
        outOfSubnet.push(eq);
      }

      for (const sub of subnets) {
        if (isIpInSubnet(eq.local_ip, sub.cidr)) {
          if (isIpInDhcpRange(eq.local_ip, sub.dhcp_start, sub.dhcp_end) && !eq.is_mac_reserved) {
            dhcpWithoutReservation.push({ equipment: eq, subnet: sub });
          }
        }
      }
    }
  }

  return {
    duplicates,
    outOfSubnet,
    dhcpWithoutReservation,
    hasIssues: duplicates.length > 0 || outOfSubnet.length > 0 || dhcpWithoutReservation.length > 0
  };
}
