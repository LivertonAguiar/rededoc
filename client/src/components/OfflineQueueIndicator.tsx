import React, { useState, useEffect } from 'react';
import { CloudUpload, RefreshCw, CheckCircle2, WifiOff, Database } from 'lucide-react';
import { subscribeToQueue, processOfflineQueue } from '../utils/offlineQueue';
import { subscribeOfflineStatus, syncAllPendingMutations } from '../services/offlineSyncService';
import { useDialog } from '../context/DialogContext';

export const OfflineQueueIndicator: React.FC = () => {
  const { showToast } = useDialog();
  const [photosCount, setPhotosCount] = useState<number>(0);
  const [mutationsCount, setMutationsCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const totalPending = photosCount + mutationsCount;

  useEffect(() => {
    const unsubPhotos = subscribeToQueue(count => {
      setPhotosCount(count);
    });

    const unsubMutations = subscribeOfflineStatus((count, online) => {
      setMutationsCount(count);
      setIsOnline(online);
    });

    const handleOnline = () => {
      setIsOnline(true);
      handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubPhotos();
      unsubMutations();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSync = async () => {
    if (!navigator.onLine) {
      showToast('Aparelho sem conexão com a internet. O envio ocorrerá automaticamente ao reconectar.', 'warning');
      return;
    }

    try {
      setIsSyncing(true);
      const [resMutations, resPhotos] = await Promise.all([
        syncAllPendingMutations(),
        processOfflineQueue()
      ]);

      const totalSuccess = (resMutations?.synced || 0) + (resPhotos?.success || 0);
      if (totalSuccess > 0) {
        showToast(`${totalSuccess} ${totalSuccess === 1 ? 'item sincronizado' : 'itens sincronizados'} com sucesso!`, 'success');
      }
    } catch (err: any) {
      showToast('Falha na sincronização da fila: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  if (totalPending === 0) return null;

  return (
    <aside
      aria-label="Fila de sincronização offline"
      className="fixed bottom-20 lg:bottom-6 right-4 z-50 bg-[#0F172A] border border-amber-500/50 rounded-2xl p-3 shadow-2xl flex items-center gap-3 animate-slideUp text-xs text-white max-w-sm backdrop-blur-md"
    >
      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
        {isOnline ? (
          <CloudUpload className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
        ) : (
          <WifiOff className="w-4 h-4 text-amber-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-bold flex items-center gap-1.5 truncate">
          <span>{totalPending} {totalPending === 1 ? 'item pendente de envio' : 'itens pendentes de envio'}</span>
        </div>
        <p className="text-[10px] text-slate-400 truncate">
          {mutationsCount > 0 && photosCount > 0
            ? `${mutationsCount} cadastros, ${photosCount} fotos`
            : mutationsCount > 0
            ? `${mutationsCount} cadastros offline`
            : `${photosCount} fotos anexadas`} • {isOnline ? 'Pronto para sincronizar' : 'Salvo no aparelho'}
        </p>
      </div>

      <button
        onClick={handleSync}
        disabled={isSyncing || !isOnline}
        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold transition flex items-center gap-1.5 text-xs shrink-0 cursor-pointer"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
        <span>{isSyncing ? 'Enviando...' : 'Sincronizar'}</span>
      </button>
    </aside>
  );
};

