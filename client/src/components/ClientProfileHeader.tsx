import React, { useState, useEffect } from 'react';
import {
  Radio,
  Server,
  Network,
  Share2,
  KeyRound,
  Wrench,
  FileText,
  Building2,
  History,
  Globe,
  Layers,
  Star
} from 'lucide-react';
import { Client, Equipment, PortForward } from '../types';
import { api } from '../services/api';

interface ClientProfileHeaderProps {
  client: Client;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  equipments: Equipment[];
  portForwards: PortForward[];
  onOpenReport: () => void;
}

export const ClientProfileHeader: React.FC<ClientProfileHeaderProps> = ({
  client,
  activeTab,
  onSelectTab,
  equipments,
  portForwards,
  onOpenReport
}) => {
  const [isFav, setIsFav] = useState<boolean>(false);

  useEffect(() => {
    if (client?.id) {
      api.checkFavorite('client', client.id)
        .then(res => setIsFav(Boolean(res.isFavorite)))
        .catch(() => setIsFav(false));
    }
  }, [client?.id]);

  const handleToggleFav = async () => {
    if (!client?.id) return;
    try {
      if (isFav) {
        await api.removeFavorite('client', client.id);
        setIsFav(false);
      } else {
        await api.addFavorite('client', client.id);
        setIsFav(true);
      }
    } catch (err) {
      console.error('Erro ao alternar favorito:', err);
    }
  };
  const tabs = [
    {
      id: 'client-network',
      label: 'Painel da Rede',
      icon: Radio
    },
    {
      id: 'equipments',
      label: 'Equipamentos',
      icon: Server,
      badge: equipments.length
    },
    {
      id: 'topology',
      label: 'Topologia Visual',
      icon: Network
    },
    {
      id: 'ipam',
      label: 'IPAM / Sub-redes',
      icon: Layers
    },
    {
      id: 'port-forwards',
      label: 'Portas (NAT)',
      icon: Share2,
      badge: portForwards.length
    },
    {
      id: 'credentials',
      label: 'Cofre de Senhas',
      icon: KeyRound
    },
    {
      id: 'domains',
      label: 'Domínios & DNS',
      icon: Globe
    },
    {
      id: 'service-orders',
      label: 'Atendimentos & O.S.',
      icon: Wrench
    },
    {
      id: 'audit-history',
      label: 'Histórico & Auditoria',
      icon: History
    },
    {
      id: 'reports',
      label: 'Laudo / PDF',
      icon: FileText
    }
  ];

  return (
    <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-3 sm:p-4 mb-6 shadow-xl space-y-3">
      {/* Informações Resumidas do Cliente */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1D3054]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {client.name}
              </h2>
              <button
                type="button"
                onClick={handleToggleFav}
                className={`p-1 rounded-lg border transition ${
                  isFav
                    ? 'text-amber-400 bg-amber-400/10 border-amber-400/30 hover:bg-amber-400/20'
                    : 'text-slate-500 hover:text-amber-300 hover:bg-slate-800 border-transparent'
                }`}
                title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
              </button>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                Cliente Ativo
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              {client.address || 'Local Principal'} • {equipments.length} equipamentos • {portForwards.length} regras NAT
            </p>
          </div>
        </div>

        {/* Botão de Laudo / Relatório Rápido */}
        <button
          onClick={onOpenReport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-semibold transition shrink-0"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Emitir Laudo Técnico</span>
        </button>
      </div>

      {/* Abas Horizontais do Cliente */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#16253F]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[#182B49] text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
