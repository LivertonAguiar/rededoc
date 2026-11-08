import { Equipment, ServiceOrder } from '../types';
import { api } from './api';

export interface OfflineMutation {
  id: string; // ID local único (ex: offline_eq_1715000000)
  entityType: 'equipment' | 'service_order' | 'credential' | 'port_forward';
  action: 'create' | 'update' | 'delete';
  payload: any;
  clientId: string;
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
  retryCount: number;
}

const DB_NAME = 'itfy_offline_db';
const DB_VERSION = 2;
const MUTATIONS_STORE = 'offline_mutations';
const CACHE_STORE = 'offline_cache';

let dbInstance: IDBDatabase | null = null;
const listeners = new Set<(pendingCount: number, isOnline: boolean) => void>();

function notifyListeners(count: number, isOnline: boolean) {
  listeners.forEach(fn => fn(count, isOnline));
}

export function subscribeOfflineStatus(callback: (pendingCount: number, isOnline: boolean) => void): () => void {
  listeners.add(callback);
  getPendingMutationsCount().then(c => callback(c, typeof navigator !== 'undefined' ? navigator.onLine : true)).catch(() => {});
  return () => listeners.delete(callback);
}

function openOfflineDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não suportado neste ambiente.'));
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(MUTATIONS_STORE)) {
        const store = db.createObjectStore(MUTATIONS_STORE, { keyPath: 'id' });
        store.createIndex('clientId', 'clientId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: 'cacheKey' });
      }
    };

    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(req.result);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Salva uma mutação de cadastro ou alteração offline com segurança total contra perda de dados.
 */
export async function queueOfflineMutation(
  entityType: OfflineMutation['entityType'],
  action: OfflineMutation['action'],
  payload: any,
  clientId: string
): Promise<OfflineMutation> {
  const db = await openOfflineDb();
  const id = `offline_${entityType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const mutation: OfflineMutation = {
    id,
    entityType,
    action,
    payload: {
      ...payload,
      id: payload.id || id,
      _isOffline: true,
      _offlineTimestamp: new Date().toISOString()
    },
    clientId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MUTATIONS_STORE, 'readwrite');
    const store = tx.objectStore(MUTATIONS_STORE);
    const req = store.add(mutation);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Notifica ouvintes
  const count = await getPendingMutationsCount();
  notifyListeners(count, navigator.onLine);

  // Dispara evento global para o frontend atualizar as telas
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:offline-item-queued', { detail: mutation }));
  }

  // Tenta sincronizar imediatamente se estiver online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    syncAllPendingMutations().catch(console.warn);
  }

  return mutation;
}

/**
 * Retorna o número de itens pendentes de sincronização
 */
export async function getPendingMutationsCount(): Promise<number> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve) => {
      const tx = db.transaction(MUTATIONS_STORE, 'readonly');
      const store = tx.objectStore(MUTATIONS_STORE);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Retorna a lista de todas as mutações pendentes
 */
export async function getAllPendingMutations(): Promise<OfflineMutation[]> {
  try {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(MUTATIONS_STORE, 'readonly');
      const store = tx.objectStore(MUTATIONS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as OfflineMutation[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/**
 * Remove uma mutação sincronizada com sucesso
 */
async function removeMutation(id: string): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MUTATIONS_STORE, 'readwrite');
    const store = tx.objectStore(MUTATIONS_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Atualiza o status de uma mutação (ex: erro ou em sincronização)
 */
async function updateMutationStatus(id: string, status: OfflineMutation['status'], errorMessage?: string): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve) => {
    const tx = db.transaction(MUTATIONS_STORE, 'readwrite');
    const store = tx.objectStore(MUTATIONS_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as OfflineMutation;
      if (item) {
        item.status = status;
        if (errorMessage) item.errorMessage = errorMessage;
        if (status === 'failed') item.retryCount = (item.retryCount || 0) + 1;
        store.put(item);
      }
      resolve();
    };
    getReq.onerror = () => resolve();
  });
}

let isSyncing = false;

/**
 * Executa a sincronização de todas as mutações pendentes contra o servidor backend
 */
export async function syncAllPendingMutations(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;

  try {
    const items = await getAllPendingMutations();
    if (items.length === 0) {
      isSyncing = false;
      return { synced: 0, failed: 0 };
    }

    // Ordena por data de criação para manter integridade referencial
    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const item of items) {
      await updateMutationStatus(item.id, 'syncing');

      try {
        const payload = { ...item.payload };
        // Remove marcadores locais antes de enviar ao servidor
        delete payload._isOffline;
        delete payload._offlineTimestamp;
        if (typeof payload.id === 'string' && payload.id.startsWith('offline_')) {
          delete payload.id;
        }

        if (item.entityType === 'equipment') {
          if (item.action === 'create') {
            await api.createEquipment(payload);
          } else if (item.action === 'update') {
            const realId = item.payload.realId || item.payload.id;
            await api.updateEquipment(realId, payload);
          } else if (item.action === 'delete') {
            const realId = item.payload.realId || item.payload.id;
            await api.deleteEquipment(realId);
          }
        } else if (item.entityType === 'service_order') {
          if (item.action === 'create') {
            await api.createServiceOrder(payload);
          } else if (item.action === 'update') {
            const realId = item.payload.realId || item.payload.id;
            await api.updateServiceOrder(realId, payload);
          }
        } else if (item.entityType === 'port_forward') {
          if (item.action === 'create') {
            await api.createPortForward(payload);
          } else if (item.action === 'update') {
            const realId = item.payload.realId || item.payload.id;
            await api.updatePortForward(realId, payload);
          }
        }

        await removeMutation(item.id);
        synced++;
      } catch (err: any) {
        console.error(`Falha ao sincronizar item offline ${item.id}:`, err);
        await updateMutationStatus(item.id, 'failed', err.message || 'Erro de comunicação');
        failed++;
      }
    }

    const remaining = await getPendingMutationsCount();
    notifyListeners(remaining, navigator.onLine);

    if (synced > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app:offline-sync-completed', { detail: { synced, failed } }));
    }
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

/**
 * Retorna equipamentos cadastrados offline para exibição imediata na tela
 */
export async function getOfflineEquipmentsForClient(clientId: string): Promise<Equipment[]> {
  try {
    const items = await getAllPendingMutations();
    return items
      .filter(item => item.clientId === clientId && item.entityType === 'equipment')
      .map(item => ({
        ...item.payload,
        id: item.payload.id || item.id,
        _isOffline: true,
        _offlineTimestamp: item.createdAt
      } as Equipment));
  } catch {
    return [];
  }
}

/**
 * Retorna todas as mutações offline de um cliente específico
 */
export async function getPendingMutationsForClient(clientId: string): Promise<OfflineMutation[]> {
  try {
    const items = await getAllPendingMutations();
    return items.filter(item => item.clientId === clientId);
  } catch {
    return [];
  }
}

// Inicializador de escuta de rede para sincronização automática
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Dispositivo reconectado! Sincronizando dados pendentes...');
    getPendingMutationsCount().then(c => notifyListeners(c, true));
    syncAllPendingMutations().catch(console.warn);
  });

  window.addEventListener('offline', () => {
    console.log('[OfflineSync] Dispositivo offline.');
    getPendingMutationsCount().then(c => notifyListeners(c, false));
  });
}
