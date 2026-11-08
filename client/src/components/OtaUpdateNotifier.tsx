import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X, ArrowRight, ShieldCheck, Info } from 'lucide-react';
import { checkForOtaUpdate, applyOtaUpdate, VersionInfo, CURRENT_CLIENT_VERSION } from '../services/otaService';
import { useDialog } from '../context/DialogContext';

interface OtaUpdateNotifierProps {
  onOpenChangelog?: () => void;
}

export const OtaUpdateNotifier: React.FC<OtaUpdateNotifierProps> = ({ onOpenChangelog }) => {
  const { showToast } = useDialog();
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  useEffect(() => {
    // Verifica ao abrir o aplicativo
    const verify = async () => {
      const res = await checkForOtaUpdate();
      if (res.hasUpdate && res.info) {
        setUpdateInfo(res.info);
      }
    };

    verify();

    // Re-checa periodicamente a cada 10 minutos
    const interval = setInterval(verify, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    showToast('Baixando e sincronizando novos recursos do ITFY...', 'info');
    try {
      await applyOtaUpdate();
    } catch {
      setIsUpdating(false);
      showToast('Falha ao aplicar atualização OTA. Tente novamente.', 'error');
    }
  };

  if (!updateInfo || isDismissed) return null;

  return (
    <div
      role="alert"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] w-[94%] max-w-xl bg-[#0C1525]/95 border border-cyan-500/50 shadow-2xl shadow-cyan-950/60 rounded-2xl p-3 sm:p-4 text-white backdrop-blur-md animate-slideDown flex flex-col gap-2.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-600/30 shrink-0">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm tracking-tight text-white">
                Nova Versão Disponível ({updateInfo.version})
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                OTA Instantâneo
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              {updateInfo.releaseName || 'Melhorias de desempenho e correções aplicadas'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition"
          aria-label="Dispensar notificação"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {updateInfo.changelog && updateInfo.changelog.length > 0 && (
        <div className="bg-[#080E1A] border border-[#1E3150] rounded-xl p-2.5 space-y-1.5 text-[11px]">
          {updateInfo.changelog.slice(0, 3).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
              <span className="font-semibold text-cyan-200">{item.tag}:</span>
              <span className="truncate">{item.desc}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        {onOpenChangelog ? (
          <button
            onClick={onOpenChangelog}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Ver notas da versão</span>
          </button>
        ) : (
          <span className="text-[10px] text-slate-400">Instalado: v{CURRENT_CLIENT_VERSION}</span>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDismissed(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
          >
            Depois
          </button>
          <button
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-md shadow-cyan-500/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Atualizando...' : 'Atualizar Agora (OTA)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

