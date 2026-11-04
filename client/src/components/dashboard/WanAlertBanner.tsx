import React from 'react';
import { AlertTriangle, Globe } from 'lucide-react';

interface WanAuditData {
  currentPublicIp: string | null;
  registeredIp: string | null;
  hasChanged: boolean;
  status: 'ok' | 'mismatch' | 'unregistered' | 'offline';
  message: string;
}

interface WanAlertBannerProps {
  wanAudit: WanAuditData | null;
  onOpenNetworkModal: () => void;
}

export const WanAlertBanner: React.FC<WanAlertBannerProps> = ({
  wanAudit,
  onOpenNetworkModal
}) => {
  if (!wanAudit || !wanAudit.hasChanged) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-start justify-between gap-4 animate-fadeIn shadow-lg">
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <span>Alteração de IP WAN Detectada</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200">
              IP Dinâmico
            </span>
          </h4>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {wanAudit.message}
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs font-mono">
            <span className="text-slate-400">
              IP Registrado no Sistema: <strong className="text-rose-400 font-bold">{wanAudit.registeredIp || 'Nenhum'}</strong>
            </span>
            <span className="text-slate-400">
              IP Público Real na Rede: <strong className="text-emerald-400 font-bold">{wanAudit.currentPublicIp}</strong>
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenNetworkModal}
        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5 self-center"
      >
        <Globe className="w-4 h-4" />
        <span>Sincronizar IP WAN</span>
      </button>
    </div>
  );
};

