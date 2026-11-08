import { api } from './api';

export const CURRENT_CLIENT_VERSION = '1.0.3'; // Versão instalada no bundle local
export const CURRENT_CLIENT_BUILD = 4;

export interface VersionInfo {
  version: string;
  buildNumber: number;
  releaseName: string;
  releaseDate: string;
  otaSupported: boolean;
  minSupportedVersion: string;
  changelog: { tag: string; desc: string }[];
  apkDownloadUrl: string;
}

/**
 * Compara se a versão remota é superior à versão local
 */
export function isNewerVersion(remoteVer: string, remoteBuild?: number): boolean {
  if (remoteBuild && remoteBuild > CURRENT_CLIENT_BUILD) {
    return true;
  }

  const parseParts = (v: string) => v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const [rMaj, rMin, rPatch] = parseParts(remoteVer);
  const [lMaj, lMin, lPatch] = parseParts(CURRENT_CLIENT_VERSION);

  if (rMaj > lMaj) return true;
  if (rMaj === lMaj && rMin > lMin) return true;
  if (rMaj === lMaj && rMin === lMin && rPatch > lPatch) return true;

  return false;
}

/**
 * Consulta o servidor para verificar se há atualização OTA disponível
 */
export async function checkForOtaUpdate(): Promise<{ hasUpdate: boolean; info?: VersionInfo }> {
  try {
    const info = await api.getAppVersion();
    const hasUpdate = isNewerVersion(info.version, info.buildNumber);
    return { hasUpdate, info };
  } catch (err) {
    console.warn('[OTA] Falha ao verificar versão no servidor:', err);
    return { hasUpdate: false };
  }
}

/**
 * Aplica a atualização OTA instantaneamente no aplicativo
 * 1. Limpa Service Workers e caches locais de arquivos estáticos
 * 2. Recarrega o WebView/aplicativo com os arquivos atualizados
 */
export async function applyOtaUpdate(): Promise<void> {
  try {
    // 1. Limpa todas as instâncias de CacheStorage do navegador/WebView
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // 2. Atualiza ou desregistra os Service Workers antigos
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update().catch(() => {});
      }
    }

    // 3. Marca que a atualização foi aplicada
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('itfy_last_ota_update', new Date().toISOString());
    }

    // 4. Recarrega o aplicativo forçando busca de novos recursos
    setTimeout(() => {
      window.location.reload();
    }, 400);
  } catch (err) {
    console.error('[OTA] Erro ao aplicar atualização:', err);
    window.location.reload();
  }
}
