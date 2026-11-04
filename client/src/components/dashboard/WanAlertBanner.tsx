import React, { useState } from 'react';
import { History, X, Globe } from 'lucide-react';

interface WanAuditData {
  currentPublicIp: string | null;
  registeredIp: string | null;
  hasChanged: boolean;
  status: string;
  message: string;
  changedAt?: string;
  userName?: string;
  equipmentName?: string;
}

interface WanAlertBannerProps {
  wanAudit: WanAuditData | null;
  onOpenNetworkModal: () => void;
}

export const WanAlertBanner: React.FC<WanAlertBannerProps> = ({
  wanAudit,
  onOpenNetworkModal
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (!wanAudit || !wanAudit.hasChanged || dismissed) return null;

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex flex-wrap items-start justify-between gap-4 animate-fadeIn shadow-lg">
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-blue-300 flex items-center gap-2">
            <span>Histórico de Alteração de IP WAN</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-200">
              Registrado
            </span>
          </h4>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {wanAudit.message}
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs font-mono">
            <span className="text-slate-400">
              IP Anterior: <strong className="text-slate-300 font-bold">{wanAudit.registeredIp || 'Nenhum'}</strong>
            </span>
            <span className="text-slate-400">
              Novo IP Ativo: <strong className="text-emerald-400 font-bold">{wanAudit.currentPublicIp}</strong>
            </span>
            {wanAudit.userName && (
              <span className="text-slate-400">
                Alterado por: <strong className="text-slate-200">{wanAudit.userName}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-center">
        <button
          type="button"
          onClick={onOpenNetworkModal}
          className="px-3.5 py-1.5 rounded-xl bg-[#172744] hover:bg-[#20365D] text-blue-300 hover:text-white font-semibold text-xs border border-blue-500/30 transition flex items-center gap-1.5"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Ver Parâmetros</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          title="Dispensar aviso"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

