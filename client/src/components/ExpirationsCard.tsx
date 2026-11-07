import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  KeyRound,
  Server,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { ExpirationItem, ExpirationStatus } from '../types';
import { api } from '../services/api';

interface ExpirationsCardProps {
  clientId?: string;
  onNavigateToTab?: (tab: string, entityId?: string) => void;
  className?: string;
}

export const ExpirationsCard: React.FC<ExpirationsCardProps> = ({
  clientId,
  onNavigateToTab,
  className = ''
}) => {
  const [items, setItems] = useState<ExpirationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'urgent'>('all');

  const loadExpirations = async () => {
    try {
      setLoading(true);
      const data = await api.getExpirations(clientId, 30);
      setItems(data);
    } catch (err) {
      console.error('Erro ao carregar vencimentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpirations();
  }, [clientId]);

  const expiredItems = items.filter(i => i.status === 'expired');
  const due7dItems = items.filter(i => i.status === 'due_7d');
  const due30dItems = items.filter(i => i.status === 'due_30d');

  const displayedItems = filterStatus === 'urgent'
    ? items.filter(i => i.status === 'expired' || i.status === 'due_7d')
    : items;

  const getStatusBadge = (status: ExpirationStatus, days: number) => {
    if (status === 'expired') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-rose-400" />
          <span>Vencido ({Math.abs(days)}d atrás)</span>
        </span>
      );
    }
    if (status === 'due_7d') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>{days === 0 ? 'Vence Hoje!' : `Vence em ${days}d`}</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
        <Calendar className="w-3 h-3 text-blue-400" />
        <span>Em {days} dias</span>
      </span>
    );
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'equipment':
        return <Server className="w-4 h-4 text-blue-400" />;
      case 'credential':
        return <KeyRound className="w-4 h-4 text-emerald-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className={`p-5 rounded-2xl bg-[#0b1528] border border-[#1b2b48] text-slate-200 shadow-xl ${className}`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between pb-3 border-b border-[#18263f] mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-sm">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              Vencimentos e Alertas de Infraestrutura
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Fase 3
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Garantias de fabricantes e prazos de rotação de senhas.
            </p>
          </div>
        </div>

        <button
          onClick={loadExpirations}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Recarregar vencimentos"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Resumo Rápido por Indicadores */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div
          onClick={() => setFilterStatus(filterStatus === 'urgent' ? 'all' : 'urgent')}
          className={`p-2.5 rounded-xl border cursor-pointer transition ${
            expiredItems.length > 0
              ? 'bg-rose-950/20 border-rose-500/30 hover:bg-rose-950/30'
              : 'bg-[#070d1a] border-[#18263f]'
          }`}
        >
          <div className="text-[10px] font-semibold text-rose-300 uppercase">Vencidos</div>
          <div className="text-lg font-black text-rose-400 mt-0.5">{expiredItems.length}</div>
        </div>

        <div
          onClick={() => setFilterStatus(filterStatus === 'urgent' ? 'all' : 'urgent')}
          className={`p-2.5 rounded-xl border cursor-pointer transition ${
            due7dItems.length > 0
              ? 'bg-amber-950/20 border-amber-500/30 hover:bg-amber-950/30'
              : 'bg-[#070d1a] border-[#18263f]'
          }`}
        >
          <div className="text-[10px] font-semibold text-amber-300 uppercase">Próximos (7 dias)</div>
          <div className="text-lg font-black text-amber-400 mt-0.5">{due7dItems.length}</div>
        </div>

        <div
          onClick={() => setFilterStatus('all')}
          className="p-2.5 rounded-xl bg-[#070d1a] border border-[#18263f] cursor-pointer hover:bg-slate-900 transition"
        >
          <div className="text-[10px] font-semibold text-blue-300 uppercase">Próximos (30 dias)</div>
          <div className="text-lg font-black text-blue-400 mt-0.5">{due30dItems.length}</div>
        </div>
      </div>

      {/* Lista de Vencimentos */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Verificando prazos e garantias...
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center gap-1.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <span>Nenhum vencimento ou garantia pendente no momento!</span>
          </div>
        ) : (
          displayedItems.map((item) => {
            const isClickable = Boolean(onNavigateToTab);
            const targetTab = item.entityType === 'equipment' ? 'equipments' : 'credentials';

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (onNavigateToTab) {
                    onNavigateToTab(targetTab, item.entityId);
                  }
                }}
                className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                  item.status === 'expired'
                    ? 'bg-rose-950/15 border-rose-500/30 hover:border-rose-500/50'
                    : item.status === 'due_7d'
                    ? 'bg-amber-950/15 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-[#070d1a] border-[#18263f] hover:border-slate-600'
                } ${isClickable ? 'cursor-pointer hover:bg-[#0d182e]' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-800/80 shrink-0">
                    {getEntityIcon(item.entityType)}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-2">
                      <span className="truncate">{item.title}</span>
                      {!clientId && (
                        <span className="text-[10px] text-slate-400 font-normal shrink-0">
                          ({item.clientName})
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {item.subtitle} • Data limite: <strong className="text-slate-300">{item.dueAt}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(item.status, item.daysRemaining)}
                  {isClickable && (
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
