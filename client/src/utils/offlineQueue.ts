import { api } from '../services/api';

export interface QueuedUploadItem {
  id: string;
  clientId: string;
  locationId?: string;
  equipmentId?: string;
  serviceOrderId?: string;
  category: string;
  notes?: string;
  fileName: string;
  fileBlob: Blob;
  createdAt: string;
  status: 'pending' | 'uploading' | 'failed';
  errorMessage?: string;
}

const DB_NAME = 'rededoc_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'upload_queue';

let dbInstance: IDBDatabase | null = null;
const listeners = new Set<(count: number) => void>();

function notifyListeners(count: number) {
  listeners.forEach(fn => fn(count));
}

export function subscribeToQueue(callback: (count: number) => void): () => void {
  listeners.add(callback);
  getPendingCount().then(callback).catch(() => {});
  return () => listeners.delete(callback);
}

function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não suportado neste navegador.'));
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
 * Adiciona uma foto ou anexo na fila offline
 */
export async function enqueueUpload(
  file: File | Blob,
  meta: {
    clientId: string;
    locationId?: string;
    equipmentId?: string;
    serviceOrderId?: string;
    category?: string;
    notes?: string;
    fileName?: string;
  }
): Promise<string> {
  const db = await openDb();
  const id = 'queue_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

  const item: QueuedUploadItem = {
    id,
    clientId: meta.clientId,
    locationId: meta.locationId,
    equipmentId: meta.equipmentId,
    serviceOrderId: meta.serviceOrderId,
    category: meta.category || 'foto_campo',
    notes: meta.notes,
    fileName: meta.fileName || (file instanceof File ? file.name : 'foto_campo.jpg'),
    fileBlob: file,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(item);

    req.onsuccess = () => {
      getPendingCount().then(notifyListeners);
      resolve(id);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retorna todos os itens pendentes na fila
 */
export async function getPendingUploads(): Promise<QueuedUploadItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Contagem rápida de itens pendentes
 */
export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Remove um item concluído da fila
 */
export async function removeQueuedUpload(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => {
      getPendingCount().then(notifyListeners);
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

let isProcessing = false;

/**
 * Processa todos os itens da fila offline e realiza o upload para o servidor
 */
export async function processOfflineQueue(
  onProgress?: (remaining: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  if (isProcessing) return { success: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: 0, failed: 0 };
  }

  isProcessing = true;
  let successCount = 0;
  let failCount = 0;

  try {
    const items = await getPendingUploads();
    const total = items.length;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        await api.uploadAttachment(item.fileBlob, {
          clientId: item.clientId,
          locationId: item.locationId,
          equipmentId: item.equipmentId,
          serviceOrderId: item.serviceOrderId,
          category: item.category,
          notes: item.notes,
          fileName: item.fileName
        });

        await removeQueuedUpload(item.id);
        successCount++;
      } catch (err: any) {
        failCount++;
        // Se falhou por falta de conexão, interrompe o loop para tentar novamente depois
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break;
        }
      }

      if (onProgress) {
        onProgress(total - (i + 1), total);
      }
    }
  } finally {
    isProcessing = false;
    getPendingCount().then(notifyListeners);
  }

  return { success: successCount, failed: failCount };
}

// Dispara reenvio automático assim que o navegador detectar conexão restaurada
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Conexão restaurada. Processando fila de uploads pendentes...');
    processOfflineQueue().catch(() => {});
  });
}
