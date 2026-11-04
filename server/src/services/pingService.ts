import { execFile } from 'node:child_process';
import net from 'node:net';

export interface PingResult {
  ip: string;
  online: boolean;
  latencyMs: number | null;
  method: 'icmp' | 'tcp' | 'none';
  lastChecked: string;
  error?: string;
}

// Cache em memória para evitar tempestade de requisições de ping
const pingCache = new Map<string, { result: PingResult; expiresAt: number }>();
const CACHE_TTL_MS = 10000; // 10 segundos

/**
 * Executa ping ICMP via comando nativo do SO
 */
function execIcmpPing(ip: string, timeoutMs: number): Promise<{ online: boolean; latencyMs: number | null }> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const args = isWin
      ? ['-n', '1', '-w', String(timeoutMs), ip]
      : ['-c', '1', '-W', String(Math.ceil(timeoutMs / 1000)), ip];

    execFile('ping', args, { timeout: timeoutMs + 500 }, (error, stdout) => {
      if (error || !stdout) {
        return resolve({ online: false, latencyMs: null });
      }

      // Procura por resposta de sucesso em PT ou EN
      const isSuccess = /bytes[=:]/i.test(stdout) || /ttl[=:]/i.test(stdout);
      if (!isSuccess) {
        return resolve({ online: false, latencyMs: null });
      }

      // Extrai latência
      let latency: number | null = null;
      const match = stdout.match(/tempo[=<](\d+)ms/i) || stdout.match(/time[=<](\d+(\.\d+)?)ms/i);
      if (match) {
        latency = Math.max(1, Math.round(Number(match[1])));
      } else if (stdout.includes('tempo<1ms') || stdout.includes('time<1ms')) {
        latency = 1;
      }

      resolve({ online: true, latencyMs: latency });
    });
  });
}

/**
 * Fallback TCP em portas comuns (80, 443, 8080) caso o equipamento desative ICMP Echo
 */
function execTcpPing(ip: string, port = 80, timeoutMs = 1500): Promise<{ online: boolean; latencyMs: number | null }> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();
    let settled = false;

    socket.setTimeout(timeoutMs);

    const finish = (online: boolean) => {
      if (settled) return;
      settled = true;
      const latency = Math.round(performance.now() - start);
      socket.destroy();
      resolve({ online, latencyMs: online ? latency : null });
    };

    socket.on('connect', () => finish(true));
    // Se a porta recusar (ECONNREFUSED), o host ainda assim está ONLINE e respondendo na rede!
    socket.on('error', (err: any) => {
      if (err.code === 'ECONNREFUSED') {
        finish(true);
      } else {
        finish(false);
      }
    });
    socket.on('timeout', () => finish(false));

    socket.connect(port, ip);
  });
}

/**
 * Testa a disponibilidade de um endereço IP (ICMP com fallback TCP)
 */
export async function pingHost(ip: string, force = false): Promise<PingResult> {
  const cleanIp = ip?.trim();
  const now = Date.now();

  if (!cleanIp || cleanIp === 'N/A' || cleanIp === '0.0.0.0') {
    return {
      ip: cleanIp || '',
      online: false,
      latencyMs: null,
      method: 'none',
      lastChecked: new Date().toISOString(),
      error: 'IP inválido'
    };
  }

  // Consulta cache
  if (!force) {
    const cached = pingCache.get(cleanIp);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }
  }

  // 1. Tenta ICMP Ping
  const icmp = await execIcmpPing(cleanIp, 1200);
  if (icmp.online) {
    const result: PingResult = {
      ip: cleanIp,
      online: true,
      latencyMs: icmp.latencyMs,
      method: 'icmp',
      lastChecked: new Date().toISOString()
    };
    pingCache.set(cleanIp, { result, expiresAt: now + CACHE_TTL_MS });
    return result;
  }

  // 2. Fallback TCP (porta 80 HTTP)
  const tcp80 = await execTcpPing(cleanIp, 80, 1000);
  if (tcp80.online) {
    const result: PingResult = {
      ip: cleanIp,
      online: true,
      latencyMs: tcp80.latencyMs,
      method: 'tcp',
      lastChecked: new Date().toISOString()
    };
    pingCache.set(cleanIp, { result, expiresAt: now + CACHE_TTL_MS });
    return result;
  }

  // 3. Fallback TCP (porta 443 HTTPS)
  const tcp443 = await execTcpPing(cleanIp, 443, 1000);
  if (tcp443.online) {
    const result: PingResult = {
      ip: cleanIp,
      online: true,
      latencyMs: tcp443.latencyMs,
      method: 'tcp',
      lastChecked: new Date().toISOString()
    };
    pingCache.set(cleanIp, { result, expiresAt: now + CACHE_TTL_MS });
    return result;
  }

  const offlineResult: PingResult = {
    ip: cleanIp,
    online: false,
    latencyMs: null,
    method: 'none',
    lastChecked: new Date().toISOString()
  };
  pingCache.set(cleanIp, { result: offlineResult, expiresAt: now + CACHE_TTL_MS });
  return offlineResult;
}

