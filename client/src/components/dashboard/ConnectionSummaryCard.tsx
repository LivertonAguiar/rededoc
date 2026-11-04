import React from 'react';
import { Globe, Edit } from 'lucide-react';
import { Equipment } from '../../types';

interface ConnectionSummaryCardProps {
  routerOnt: Equipment | null | undefined;
  wanIp: string | null;
  onOpenNetworkModal: () => void;
}

export const ConnectionSummaryCard: React.FC<ConnectionSummaryCardProps> = ({
  routerOnt,
  wanIp,
  onOpenNetworkModal
}) => {
  return (
    <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-[#1D3054] mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-400" />
          Informações da Conexão
        </h3>
        <button
          onClick={onOpenNetworkModal}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#172744] hover:bg-[#20365D] text-blue-400 hover:text-blue-300 text-xs font-semibold transition-colors"
          title="Editar parâmetros de sub-rede e DNS"
        >
          <Edit className="w-3 h-3" /> {routerOnt ? 'Editar' : 'Configurar'}
        </button>
      </div>

      <div className="space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">IP WAN (público)</span>
          <span className="font-mono font-bold text-white">{wanIp || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">IP do roteador</span>
          <span className="font-mono text-emerald-400 font-semibold">{routerOnt?.local_ip || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Rede local</span>
          <span className="font-mono text-slate-200">
            {routerOnt?.local_ip ? `${routerOnt.local_ip.split('.').slice(0, 3).join('.')}.0 / ${routerOnt.subnet_mask || '255.255.255.0'}` : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Gateway</span>
          <span className="font-mono text-slate-200">{routerOnt?.gateway || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">DNS primário</span>
          <span className="font-mono text-slate-200">{routerOnt?.primary_dns || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">DNS secundário</span>
          <span className="font-mono text-slate-200">{routerOnt?.secondary_dns || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Faixa DHCP</span>
          <span className="font-mono text-slate-200">{routerOnt?.dhcp_range || '—'}</span>
        </div>
      </div>
    </div>
  );
};
