import React from 'react';
import { Equipment, Client } from '../../types';

interface DashboardKpisProps {
  wanIp: string | null;
  routerOnt: Equipment | null | undefined;
  totalEquipments: number;
  totalPorts: number;
  activePorts: number;
  failedPorts: number;
  hasEquipments: boolean;
  client: Client;
  onOpenNetworkModal: () => void;
  onOpenEditEquipment: (eq: Equipment) => void;
  onOpenAddEquipmentFromCatalog: () => void;
}

export const DashboardKpis: React.FC<DashboardKpisProps> = ({
  wanIp,
  routerOnt,
  totalEquipments,
  totalPorts,
  activePorts,
  failedPorts,
  hasEquipments,
  client,
  onOpenNetworkModal,
  onOpenEditEquipment,
  onOpenAddEquipmentFromCatalog
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {/* 1. IP WAN */}
      <div 
        onClick={onOpenNetworkModal}
        className="bg-[#101C31] border border-[#1D3054] hover:border-blue-500/50 rounded-xl p-4 flex flex-col justify-between shadow-md cursor-pointer transition group"
      >
        <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
          <span className="group-hover:text-blue-300 transition-colors">IP WAN (público)</span>
          {wanIp ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-600"></span>
              Não configurado
            </span>
          )}
        </div>
        <div className="text-lg font-bold font-mono text-white mt-2 tracking-tight group-hover:text-blue-200 transition-colors truncate">
          {wanIp || '—'}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
          <span>{wanIp ? 'IP Dedicado' : 'Sem IP Público'}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenNetworkModal();
            }}
            className="text-blue-400 hover:text-blue-300 font-semibold text-[11px]"
          >
            {wanIp ? 'Editar' : 'Configurar'}
          </button>
        </div>
      </div>

      {/* 2. Roteador / Gateway Principal */}
      <div className="bg-[#101C31] border border-[#1D3054] rounded-xl p-4 flex flex-col justify-between shadow-md">
        <div className="text-xs text-slate-400 font-medium">Roteador / ONT</div>
        <div className="text-base font-bold text-white mt-2 truncate">
          {routerOnt ? `${routerOnt.manufacturer || ''} ${routerOnt.model || routerOnt.name}` : 'Nenhum cadastrado'}
        </div>
        <div className="text-[11px] font-mono text-emerald-400 mt-1 flex items-center justify-between">
          <span>{routerOnt?.local_ip || '—'}</span>
          {routerOnt ? (
            <button
              onClick={() => onOpenEditEquipment(routerOnt)}
              className="text-blue-400 hover:text-blue-300 font-sans font-semibold text-[11px]"
            >
              Editar
            </button>
          ) : (
            <button
              onClick={onOpenAddEquipmentFromCatalog}
              className="text-blue-400 hover:text-blue-300 font-sans font-semibold text-[11px]"
            >
              + Cadastrar
            </button>
          )}
        </div>
      </div>

      {/* 3. Equipamentos Ativos */}
      <div className="bg-[#101C31] border border-[#1D3054] rounded-xl p-4 flex flex-col justify-between shadow-md">
        <div className="text-xs text-slate-400 font-medium">Equipamentos Ativos</div>
        <div className="text-2xl font-bold text-white mt-1">
          {totalEquipments}
        </div>
        <div className="text-[11px] text-slate-400 mt-1">Dispositivos mapeados</div>
      </div>

      {/* 4. Regras de Portas */}
      <div className="bg-[#101C31] border border-[#1D3054] rounded-xl p-4 flex flex-col justify-between shadow-md">
        <div className="text-xs text-slate-400 font-medium">Regras de Portas</div>
        <div className="text-base font-bold text-white mt-2 flex items-baseline gap-2">
          <span>{totalPorts} ativas</span>
          {totalPorts > 0 && (
            <span className="text-xs font-semibold text-emerald-400">({activePorts} validadas)</span>
          )}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 font-medium">
          {totalPorts === 0
            ? 'Nenhum redirecionamento'
            : failedPorts > 0
            ? `• ${failedPorts} com falha / bloqueio`
            : '• 100% operacionais'}
        </div>
      </div>

      {/* 5. Última Alteração */}
      <div className="bg-[#101C31] border border-[#1D3054] rounded-xl p-4 flex flex-col justify-between shadow-md col-span-2 md:col-span-1">
        <div className="text-xs text-slate-400 font-medium">Última alteração</div>
        <div className="text-sm font-bold font-mono text-white mt-2">
          {client.updated_at ? new Date(client.updated_at).toLocaleDateString('pt-BR') : 'Hoje'}
        </div>
        <div className="text-[11px] text-slate-400 mt-1 truncate">
          {hasEquipments ? 'Infraestrutura atualizada' : 'Cadastro inicial'}
        </div>
      </div>
    </div>
  );
};
