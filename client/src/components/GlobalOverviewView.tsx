import React, { useState, useEffect } from 'react';
import {
  Building2,
  Server,
  Share2,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Globe,
  Radio,
  Plus,
  ExternalLink,
  Search,
  Activity,
  FileText,
  Star,
  History,
  KeyRound,
  BookOpen
} from 'lucide-react';
import { DashboardStats, ClientSummary, ServiceOrder, DashboardOverviewData, FavoriteItem } from '../types';
import { api } from '../services/api';
import { ExpirationsCard } from './ExpirationsCard';

interface GlobalOverviewViewProps {
  onSelectClientAndOpenNetwork: (clientId: string) => void;
  onOpenClients: () => void;
  onOpenServiceOrders: () => void;
  onOpenEquipments: () => void;
}

export const GlobalOverviewView: React.FC<GlobalOverviewViewProps> = ({
  onSelectClientAndOpenNetwork,
  onOpenClients,
  onOpenServiceOrders,
  onOpenEquipments
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overviewData, setOverviewData] = useState<DashboardOverviewData | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [recentClients, setRecentClients] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, overviewRes] = await Promise.all([
        api.getDashboardStats(),
        api.getDashboardOverview().catch(() => null)
      ]);
      setStats(statsRes);
      if (overviewRes) {
        setOverviewData(overviewRes);
        setFavorites(overviewRes.favorites || []);
      }

      // Carrega recentes do localStorage
      try {
        const rawRecent = localStorage.getItem('rededoc_recent_clients');
        if (rawRecent) {
          setRecentClients(JSON.parse(rawRecent));
        }
      } catch {}
    } catch (err) {
      console.error('Erro ao carregar estatísticas gerais:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenClientWithRecent = (clientId: string, clientName: string) => {
    // Atualiza lista de recentes no localStorage
    try {
      const existing: Array<{ id: string; name: string }> = JSON.parse(
        localStorage.getItem('rededoc_recent_clients') || '[]'
      );
      const updated = [{ id: clientId, name: clientName }, ...existing.filter(c => c.id !== clientId)].slice(0, 5);
      localStorage.setItem('rededoc_recent_clients', JSON.stringify(updated));
      setRecentClients(updated);
    } catch {}

    onSelectClientAndOpenNetwork(clientId);
  };

  const handleToggleFavorite = async (entityType: string, entityId: string) => {
    const isFav = favorites.some(f => f.entityType === entityType && f.entityId === entityId);
    try {
      if (isFav) {
        await api.removeFavorite(entityType, entityId);
        setFavorites(prev => prev.filter(f => !(f.entityType === entityType && f.entityId === entityId)));
      } else {
        const res = await api.addFavorite(entityType, entityId);
        if (res.isFavorite) {
          const client = stats?.clients_summary?.find(c => c.id === entityId);
          setFavorites(prev => [
            {
              id: res.id,
              entityType: entityType as any,
              entityId,
              title: client?.name || 'Item Favorito',
              subtitle: client?.address || '',
              clientId: entityId,
              urlHash: 'client-network'
            },
            ...prev
          ]);
        }
      }
    } catch (err) {
      console.error('Erro ao alternar favorito:', err);
    }
  };

  const isFavorite = (entityType: string, entityId: string) => {
    return favorites.some(f => f.entityType === entityType && f.entityId === entityId);
  };

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
        <Activity className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="text-sm">Carregando visão geral do sistema...</span>
      </div>
    );
  }

  const clients = stats.clients_summary || [];
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.identification_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.wan_ip.includes(searchTerm) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Cabeçalho da Visão Geral */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#1E2E48]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Visão Geral do Sistema</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Central de Operações TI
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Monitoramento consolidado de clientes, infraestruturas de rede, atendimentos técnicos e saúde dos serviços.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenServiceOrders}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#15253F] hover:bg-[#1B2F4E] border border-[#233A5E] text-slate-200 text-xs font-medium transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            Novo Atendimento
          </button>
          <button
            onClick={onOpenClients}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition"
          >
            <Building2 className="w-4 h-4" />
            Gerenciar Condomínios
          </button>
        </div>
      </div>

      {/* Barra de Acesso Rápido: Favoritos & Recentes (Fase 5) */}
      {(favorites.length > 0 || recentClients.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Favoritos */}
          {favorites.length > 0 && (
            <div className="bg-[#101C31] border border-[#1E3150] rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>Condomínios e Itens Favoritos</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {favorites.map((fav) => (
                  <button
                    key={fav.id}
                    onClick={() => {
                      if (fav.clientId) {
                        handleOpenClientWithRecent(fav.clientId, fav.title);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C1525] hover:bg-[#182844] border border-[#1E3150] hover:border-amber-400/50 text-xs text-slate-200 transition shadow-sm"
                  >
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-semibold">{fav.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recentes */}
          {recentClients.length > 0 && (
            <div className="bg-[#101C31] border border-[#1E3150] rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span>Acessados Recentemente</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentClients.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => handleOpenClientWithRecent(rec.id, rec.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0C1525] hover:bg-[#182844] border border-[#1E3150] hover:border-blue-400/50 text-xs text-slate-300 transition"
                  >
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{rec.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards de Métricas Consolidadas (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Condomínios / Clientes */}
        <div
          onClick={onOpenClients}
          className="bg-[#101C31] border border-[#1E3150] hover:border-blue-500/50 p-5 rounded-xl cursor-pointer transition shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Condomínios Atendidos</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{stats.total_clients}</span>
            <span className="text-xs text-slate-400">ativos documentados</span>
          </div>
          <div className="mt-3 flex items-center text-xs text-blue-400 font-medium">
            <span>Ver todos os clientes</span>
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition" />
          </div>
        </div>

        {/* Total de Equipamentos */}
        <div
          onClick={onOpenEquipments}
          className="bg-[#101C31] border border-[#1E3150] hover:border-cyan-500/50 p-5 rounded-xl cursor-pointer transition shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Dispositivos Mapeados</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{stats.total_equipments}</span>
            <span className="text-xs text-slate-400">equipamentos de rede</span>
          </div>
          <div className="mt-3 flex items-center text-xs text-cyan-400 font-medium">
            <span>Abrir inventário geral</span>
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition" />
          </div>
        </div>

        {/* Atendimentos Técnicos */}
        <div
          onClick={onOpenServiceOrders}
          className="bg-[#101C31] border border-[#1E3150] hover:border-emerald-500/50 p-5 rounded-xl cursor-pointer transition shadow-sm group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Atendimentos Técnicos</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{stats.completed_services}</span>
            <span className="text-xs text-emerald-400 font-medium">concluídos</span>
            {stats.in_progress_services > 0 && (
              <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 ml-auto">
                {stats.in_progress_services} em aberto
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center text-xs text-emerald-400 font-medium">
            <span>Consultar atendimentos</span>
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition" />
          </div>
        </div>

        {/* Regras de Portas e NAT */}
        <div className="bg-[#101C31] border border-[#1E3150] p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Redirecionamento NAT</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{stats.total_port_rules}</span>
            <span className="text-xs text-slate-400">regras cadastradas</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {stats.validated_port_rules} validadas
            </span>
            {stats.failed_port_rules > 0 && (
              <span className="flex items-center gap-1 text-rose-400 font-medium ml-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                {stats.failed_port_rules} com falha
              </span>
            )}
          </div>
        </div>
      </div>

      {/* PAINEL DE VENCIMENTOS E ALERTAS GERAIS (FASE 3) */}
      <ExpirationsCard />

      {/* Seção Principal: Carteira de Condomínios / Clientes com Status de Rede */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Condomínios e Unidades Documentadas
            </h2>
            <p className="text-xs text-slate-400">
              Selecione qualquer condomínio para acessar sua ficha técnica, topologia e painel de rede completo.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por condomínio, IP ou rua..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#101C31] border border-[#1E3150] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <div className="bg-[#101C31] border border-[#1E3150] rounded-xl p-8 text-center text-slate-400 text-xs">
            Nenhum cliente ou condomínio encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredClients.map((clientItem) => {
              const hasFailure = clientItem.failed_ports > 0;
              return (
                <div
                  key={clientItem.id}
                  className="bg-[#101C31] border border-[#1E3150] hover:border-blue-500/60 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 shadow-md group relative overflow-hidden"
                >
                  {/* Faixa decorativa superior com status */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      hasFailure ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                  />

                  <div>
                    {/* Cabeçalho do Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-100 text-base group-hover:text-blue-400 transition">
                            {clientItem.name}
                          </h3>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite('client', clientItem.id);
                            }}
                            className={`p-1 rounded-md border transition ${
                              isFavorite('client', clientItem.id)
                                ? 'text-amber-400 bg-amber-400/10 border-amber-400/30 hover:bg-amber-400/20'
                                : 'text-slate-500 hover:text-amber-300 hover:bg-slate-800 border-transparent'
                            }`}
                            title={isFavorite('client', clientItem.id) ? 'Remover dos favoritos' : 'Marcar como favorito'}
                          >
                            <Star className={`w-3.5 h-3.5 ${isFavorite('client', clientItem.id) ? 'fill-amber-400' : ''}`} />
                          </button>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{clientItem.identification_name}</span>
                          <span>•</span>
                          <span className="truncate max-w-[180px]">{clientItem.address}</span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                          hasFailure
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {hasFailure ? 'Atenção' : 'Operacional'}
                      </span>
                    </div>

                    {/* Resumo Técnico de Rede */}
                    <div className="mt-4 grid grid-cols-2 gap-2 bg-[#0C1525] p-3 rounded-lg border border-[#17253E] text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">IP WAN Público</div>
                        <div className="font-mono font-medium text-slate-200 mt-0.5 truncate">
                          {clientItem.wan_ip}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase">Roteador / ONT</div>
                        <div className="font-medium text-slate-200 mt-0.5 truncate" title={clientItem.router_model}>
                          {clientItem.router_model}
                        </div>
                      </div>
                      <div className="mt-1">
                        <div className="text-[10px] text-slate-400 uppercase">Equipamentos</div>
                        <div className="font-semibold text-blue-400 mt-0.5">
                          {clientItem.total_equipments} dispositivos
                        </div>
                      </div>
                      <div className="mt-1">
                        <div className="text-[10px] text-slate-400 uppercase">Regras de Portas</div>
                        <div className="font-semibold text-slate-300 mt-0.5 flex items-center gap-1">
                          <span>{clientItem.total_ports}</span>
                          <span className="text-[10px] text-slate-400">
                            ({clientItem.validated_ports} validadas)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Último Atendimento */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {clientItem.last_service_date ? (
                          <>
                            {clientItem.last_service_date.split('T')[0].split('-').reverse().join('/')} -{' '}
                            <span className="truncate max-w-[120px]">{clientItem.last_service_type}</span>
                          </>
                        ) : (
                          'Nenhum atendimento registrado'
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="mt-5 pt-3 border-t border-[#1E3150] flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenClientWithRecent(clientItem.id, clientItem.name)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      Acessar Painel da Rede
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Seção Inferior: Atendimentos Recentes & Alertas Preventivos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atendimentos Recentes da Equipe */}
        <div className="bg-[#101C31] border border-[#1E3150] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1E3150]">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Últimos Atendimentos Técnicos</h3>
              </div>
              <button
                onClick={onOpenServiceOrders}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
              >
                Ver todos <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {stats.recent_services.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Nenhum atendimento técnico registrado recentemente.
                </div>
              ) : (
                stats.recent_services.map((service) => {
                  const isDone = service.status === 'concluido';
                  return (
                    <div
                      key={service.id}
                      className="p-3 rounded-lg bg-[#0C1525] border border-[#17253E] hover:border-slate-600 transition flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{service.service_type}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-blue-400 font-medium">{service.client_name}</span>
                        </div>
                        <p className="text-slate-400 line-clamp-1">{service.problem_description}</p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                          <span>Técnico: <strong className="text-slate-300">{service.technician_name}</strong></span>
                          <span>•</span>
                          <span>
                            {service.date_time.replace('T', ' ').slice(0, 16)}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded shrink-0 border ${
                          isDone
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        }`}
                      >
                        {service.status.replace('_', ' ')}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Equipamentos e Conexões que Requerem Revisão */}
        <div className="bg-[#101C31] border border-[#1E3150] rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1E3150]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-white text-sm">Dispositivos & Regras sob Revisão</h3>
              </div>
              <span className="text-xs text-slate-400">Diagnóstico Preventivo</span>
            </div>

            <div className="mt-3 space-y-3">
              {stats.equipments_needing_review.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-80" />
                  <div>Todos os serviços e redirecionamentos estão operando normalmente.</div>
                </div>
              ) : (
                stats.equipments_needing_review.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-[#0C1525] border border-rose-900/30 hover:border-rose-700/50 transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-rose-300">{item.name}</span>
                        <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                          {item.local_ip}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Cliente: <strong className="text-slate-300">{item.client_name}</strong> • Serviço: {item.service_name}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Com Falha
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-[#0B1424] border border-[#162742] flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Cofre de credenciais protegido e auditado.
            </span>
            <span className="text-slate-400 font-mono text-[11px]">AES-256-GCM Ativo</span>
          </div>
        </div>
      </div>

      {/* Painel de Atividade Recente do Sistema (Audit History - Fase 5) */}
      {overviewData?.recent_activity && overviewData.recent_activity.length > 0 && (
        <div className="bg-[#101C31] border border-[#1E3150] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E3150]">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              <h3 className="font-bold text-white text-sm">Histórico e Atividades Recentes</h3>
            </div>
            <span className="text-xs text-slate-400">Auditoria Unificada</span>
          </div>

          <div className="mt-3 divide-y divide-slate-800/60">
            {overviewData.recent_activity.map((act) => (
              <div key={act.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-slate-200">{act.user_name}</span>{' '}
                    <span className="text-slate-400">{act.action.toLowerCase().replace(/_/g, ' ')}</span>{' '}
                    <span className="text-blue-400 font-medium">{act.entity_name}</span>
                    {act.client_name && (
                      <span className="text-slate-500 text-[11px] ml-1.5">({act.client_name})</span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 font-mono shrink-0">
                  {act.created_at.slice(0, 16).replace('T', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

