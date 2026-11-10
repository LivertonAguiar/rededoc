import { api } from './api';
import { Capacitor } from '@capacitor/core';

export const CURRENT_CLIENT_VERSION = '1.0.5'; // Versão instalada no bundle local
export const CURRENT_CLIENT_BUILD = 6;

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
 * Detecta se a execução atual é no aplicativo nativo Android/iOS via Capacitor
 */
export function isNativeMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    Capacitor.isNativePlatform() ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && window.location.port === '')
  );
}

/**
 * Compara se a versão remota é superior à versão local e se não foi dispensada
 */
export function isNewerVersion(remoteVer: string, remoteBuild?: number): boolean {
  if (typeof localStorage !== 'undefined') {
    // 1. Se o usuário dispensou esta versão nesta instalação, respeita e não exibe novamente
    const dismissed = localStorage.getItem(`itfy_dismissed_update_${remoteVer}`);
    if (dismissed === 'true') {
      return false;
    }
    // 2. Se o usuário já acionou a atualização para esta versão, não reexibe
    const applied = localStorage.getItem('itfy_applied_version');
    if (applied === remoteVer) {
      return false;
    }
  }

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
 * Aplica a atualização:
 * - No APK nativo Android: redireciona para download do novo instalador APK.
 * - No Web / PWA: limpa CacheStorage e Service Workers e recarrega.
 */
export async function applyOtaUpdate(apkDownloadUrl?: string): Promise<void> {
  const downloadUrl = apkDownloadUrl || 'https://itfy.lpaguiar.com.br/download/apk';

  // No APK nativo, o pacote estático está gravado na pasta assets do app.
  // Baixamos o APK para o Android disparar a instalação/atualização.
  if (isNativeMobile()) {
    if (typeof window !== 'undefined') {
      window.location.href = downloadUrl;
    }
    return;
  }

  // No navegador Web ou PWA convencional
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update().catch(() => {});
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('itfy_last_ota_update', new Date().toISOString());
    }

    setTimeout(() => {
      window.location.reload();
    }, 400);
  } catch (err) {
    console.error('[OTA] Erro ao aplicar atualização:', err);
    window.location.reload();
  }
}
