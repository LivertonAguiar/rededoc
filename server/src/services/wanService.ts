/**
 * Serviço de detecção e auditoria de IP WAN público.
 */

let cachedWanIp: { ip: string; expiresAt: number } | null = null;
const WAN_CACHE_TTL = 30000; // 30 segundos

export async function detectPublicWanIp(): Promise<string | null> {
  const now = Date.now();
  if (cachedWanIp && cachedWanIp.expiresAt > now) {
    return cachedWanIp.ip;
  }

  // Tenta múltiplos provedores públicos com timeout curto
  const providers = [
    async () => {
      const res = await fetch('https://api64.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
      const data = await res.json() as any;
      return data.ip as string;
    },
    async () => {
      const res = await fetch('https://icanhazip.com', { signal: AbortSignal.timeout(3000) });
      const text = await res.text();
      return text.trim();
    },
    async () => {
      const res = await fetch('https://ifconfig.me/ip', { signal: AbortSignal.timeout(3000) });
      const text = await res.text();
      return text.trim();
    }
  ];

  for (const check of providers) {
    try {
      const ip = await check();
      if (ip && /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
        cachedWanIp = { ip, expiresAt: now + WAN_CACHE_TTL };
        return ip;
      }
    } catch {
      // Tenta próximo provedor
    }
  }

  return null;
}

export async function checkClientWanStatus(registeredIp: string | null): Promise<{
  currentPublicIp: string | null;
  registeredIp: string | null;
  hasChanged: boolean;
  status: 'ok' | 'mismatch' | 'unregistered' | 'offline';
  message: string;
}> {
  const current = await detectPublicWanIp();

  if (!current) {
    return {
      currentPublicIp: null,
      registeredIp,
      hasChanged: false,
      status: 'offline',
      message: 'Não foi possível consultar o IP público da conexão atual.'
    };
  }

  if (!registeredIp || registeredIp.trim() === '') {
    return {
      currentPublicIp: current,
      registeredIp: null,
      hasChanged: false,
      status: 'unregistered',
      message: `IP WAN ainda não cadastrado. IP público detectado na rede: ${current}.`
    };
  }

  const cleanRegistered = registeredIp.trim();
  const hasChanged = cleanRegistered !== current;

  return {
    currentPublicIp: current,
    registeredIp: cleanRegistered,
    hasChanged,
    status: hasChanged ? 'mismatch' : 'ok',
    message: hasChanged
      ? `Atenção: O IP WAN registrado (${cleanRegistered}) difere do IP público atual da rede (${current}). As regras de redirecionamento podem estar inoperantes externamente.`
      : `IP WAN sincronizado com a conexão externa (${current}).`
  };
}

