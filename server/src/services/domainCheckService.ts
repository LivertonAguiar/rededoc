import tls from 'node:tls';
import dns from 'node:dns/promises';
import { queryOne, execute } from '../db/database.js';

export interface DnsSnapshot {
  a_records?: string[];
  mx_records?: Array<{ exchange: string; priority: number }>;
  ns_records?: string[];
  txt_records?: string[];
  spf?: string | null;
  dmarc?: string | null;
  caa?: Array<{ critical: number; issue?: string }>;
  ddns_status?: {
    is_ddns: boolean;
    resolved_ip?: string;
    expected_wan_ip?: string;
    mismatch: boolean;
  };
  ssl?: {
    valid_from?: string;
    valid_to?: string;
    issuer?: string;
    subject?: string;
    days_remaining?: number;
    valid?: boolean;
  };
  rdap?: {
    expires_at?: string;
    registrar?: string;
  };
}

/**
 * Consulta certificado SSL via node:tls nativo
 */
export async function checkSsl(domainName: string): Promise<{ validTo: string | null; issuer: string | null; daysRemaining: number | null }> {
  return new Promise((resolve) => {
    const cleanDomain = domainName.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

    const socket = tls.connect(
      {
        host: cleanDomain,
        port: 443,
        servername: cleanDomain,
        timeout: 5000,
        rejectUnauthorized: false
      },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          socket.end();

          if (!cert || !cert.valid_to) {
            return resolve({ validTo: null, issuer: null, daysRemaining: null });
          }

          const validToDate = new Date(cert.valid_to);
          const validToStr = validToDate.toISOString().slice(0, 10);
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const diffDays = Math.round((validToDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          const issuerStr = (cert.issuer && (cert.issuer.O || cert.issuer.CN))
            ? `${cert.issuer.O || cert.issuer.CN}`
            : 'Desconhecido';

          resolve({ validTo: validToStr, issuer: issuerStr, daysRemaining: diffDays });
        } catch {
          resolve({ validTo: null, issuer: null, daysRemaining: null });
        }
      }
    );

    socket.on('error', () => {
      resolve({ validTo: null, issuer: null, daysRemaining: null });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ validTo: null, issuer: null, daysRemaining: null });
    });
  });
}

/**
 * Consulta registros DNS via node:dns/promises
 */
export async function checkDns(domainName: string): Promise<Partial<DnsSnapshot>> {
  const cleanDomain = domainName.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  const snapshot: Partial<DnsSnapshot> = {};

  // 1. Registros A (IPv4)
  try {
    snapshot.a_records = await dns.resolve4(cleanDomain);
  } catch {
    snapshot.a_records = [];
  }

  // 2. Registros MX (E-mail)
  try {
    snapshot.mx_records = await dns.resolveMx(cleanDomain);
  } catch {
    snapshot.mx_records = [];
  }

  // 3. Registros NS (Servidores de Nomes)
  try {
    snapshot.ns_records = await dns.resolveNs(cleanDomain);
  } catch {
    snapshot.ns_records = [];
  }

  // 4. Registros TXT (SPF)
  try {
    const txts = await dns.resolveTxt(cleanDomain);
    const flatTxt = txts.map(t => t.join(''));
    snapshot.txt_records = flatTxt;

    const spf = flatTxt.find(t => t.toLowerCase().startsWith('v=spf1'));
    snapshot.spf = spf || null;
  } catch {
    snapshot.txt_records = [];
    snapshot.spf = null;
  }

  // 5. Registro DMARC (_dmarc.<dominio>)
  try {
    const dmarcTxts = await dns.resolveTxt(`_dmarc.${cleanDomain}`);
    const flatDmarc = dmarcTxts.map(t => t.join(''));
    const dmarc = flatDmarc.find(t => t.toLowerCase().startsWith('v=dmarc1'));
    snapshot.dmarc = dmarc || null;
  } catch {
    snapshot.dmarc = null;
  }

  // 6. Registros CAA (Autoridade de Certificação)
  try {
    snapshot.caa = await dns.resolveCaa(cleanDomain);
  } catch {
    snapshot.caa = [];
  }

  return snapshot;
}

/**
 * Consulta RDAP (Registration Data Access Protocol) em modo best-effort
 * Falha de rede ou timeout nunca interrompe a verificação
 */
export async function checkRdap(domainName: string): Promise<{ expiresAt: string | null; registrar: string | null }> {
  const cleanDomain = domainName.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const rdapEndpoint = cleanDomain.endsWith('.br')
      ? `https://rdap.registro.br/domain/${cleanDomain}`
      : `https://rdap.org/domain/${cleanDomain}`;

    const res = await fetch(rdapEndpoint, {
      headers: { Accept: 'application/rdap+json' },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { expiresAt: null, registrar: null };
    }

    const data: any = await res.json();
    let expiresAt: string | null = null;

    if (Array.isArray(data.events)) {
      const expEvent = data.events.find((e: any) => e.eventAction === 'expiration');
      if (expEvent && expEvent.eventDate) {
        expiresAt = expEvent.eventDate.slice(0, 10);
      }
    }

    let registrar: string | null = null;
    if (Array.isArray(data.entities)) {
      const reg = data.entities.find((e: any) => Array.isArray(e.roles) && e.roles.includes('registrar'));
      if (reg && reg.vcardArray && Array.isArray(reg.vcardArray[1])) {
        const fn = reg.vcardArray[1].find((prop: any) => prop[0] === 'fn');
        if (fn) registrar = fn[3];
      }
    }

    return { expiresAt, registrar };
  } catch {
    return { expiresAt: null, registrar: null };
  }
}

/**
 * Executa checagem completa de um domínio por ID e persiste no banco
 */
export async function checkDomain(domainId: string): Promise<any> {
  const domain = queryOne<any>('SELECT * FROM domains WHERE id = ?', domainId);
  if (!domain) {
    throw new Error('Domínio não encontrado.');
  }

  // 1. SSL
  const ssl = await checkSsl(domain.name);

  // 2. DNS
  const dnsSnapshot = await checkDns(domain.name);

  // 3. RDAP (best-effort)
  const rdap = await checkRdap(domain.name);

  // 4. DDNS Check (se o cliente tiver IP WAN cadastrado)
  let ddnsMismatch = false;
  let clientWanIp: string | null = null;

  try {
    const clientRouter = queryOne<any>(`
      SELECT public_wan_ip FROM equipments
      WHERE client_id = ? AND public_wan_ip IS NOT NULL AND TRIM(public_wan_ip) != ''
      LIMIT 1
    `, domain.client_id);

    if (clientRouter && clientRouter.public_wan_ip) {
      clientWanIp = clientRouter.public_wan_ip;
      const resolvedIp = dnsSnapshot.a_records?.[0];
      if (resolvedIp && resolvedIp !== clientWanIp) {
        ddnsMismatch = true;
      }
      dnsSnapshot.ddns_status = {
        is_ddns: Boolean(domain.name.includes('ddns') || domain.name.includes('no-ip') || domain.name.includes('duckdns') || domain.name.includes('linkpc')),
        resolved_ip: resolvedIp,
        expected_wan_ip: clientWanIp || undefined,
        mismatch: ddnsMismatch
      };
    }
  } catch {}

  // 5. Cálculo de Pontuação (Score 0 a 100)
  let score = 0;
  if (ssl.validTo && (ssl.daysRemaining ?? 0) > 14) score += 30;
  else if (ssl.validTo && (ssl.daysRemaining ?? 0) > 0) score += 15;

  if (dnsSnapshot.spf) score += 25;
  if (dnsSnapshot.dmarc) score += 25;
  if (dnsSnapshot.caa && dnsSnapshot.caa.length > 0) score += 20;

  dnsSnapshot.ssl = {
    valid_to: ssl.validTo || undefined,
    issuer: ssl.issuer || undefined,
    days_remaining: ssl.daysRemaining || undefined,
    valid: Boolean(ssl.validTo && (ssl.daysRemaining ?? 0) > 0)
  };

  if (rdap.expiresAt) {
    dnsSnapshot.rdap = {
      expires_at: rdap.expiresAt,
      registrar: rdap.registrar || undefined
    };
  }

  const updatedExpiresAt = rdap.expiresAt || domain.expires_at;
  const updatedRegistrar = rdap.registrar || domain.registrar;

  execute(`
    UPDATE domains SET
      ssl_expires_at = ?,
      ssl_issuer = ?,
      expires_at = ?,
      registrar = ?,
      dns_snapshot = ?,
      score = ?,
      last_checked_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    ssl.validTo || null,
    ssl.issuer || null,
    updatedExpiresAt || null,
    updatedRegistrar || null,
    JSON.stringify(dnsSnapshot),
    score,
    domainId
  );

  return queryOne('SELECT * FROM domains WHERE id = ?', domainId);
}
