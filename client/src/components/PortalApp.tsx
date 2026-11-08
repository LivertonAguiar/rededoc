import React, { useState, useEffect } from 'react';
import {
  Building2,
  Server,
  Wrench,
  BookOpen,
  Calendar,
  LogOut,
  MapPin,
  CheckCircle2,
  Search,
  Printer,
  ChevronRight,
  Shield,
  Phone,
  Mail,
  UserCheck,
  Sparkles,
  Layers,
  FileText,
  Clock
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { User, PortalOverview, PortalEquipment, PortalServiceOrder, PortalArticle } from '../types';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { PullToRefresh } from './PullToRefresh';

interface PortalAppProps {
  currentUser: User;
  onLogout: () => void;
}

export const PortalApp: React.FC<PortalAppProps> = ({ currentUser, onLogout }) => {
  const { showToast } = useDialog();

  const [activeTab, setActiveTab] = useState<'overview' | 'equipments' | 'orders' | 'guides'>('overview');
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [equipments, setEquipments] = useState<PortalEquipment[]>([]);
  const [orders, setOrders] = useState<PortalServiceOrder[]>([]);
  const [articles, setArticles] = useState<PortalArticle[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [eqSearch, setEqSearch] = useState('');
  const [eqCategoryFilter, setEqCategoryFilter] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState<PortalArticle | null>(null);
  const [articleSearch, setArticleSearch] = useState('');

  useEffect(() => {
    loadPortalData();
  }, []);

  const loadPortalData = async () => {
    try {
      setLoading(true);
      const [overviewData, equipmentsData, ordersData, articlesData] = await Promise.all([
        api.getPortalOverview(),
        api.getPortalEquipments(),
        api.getPortalServiceOrders(),
        api.getPortalArticles()
      ]);

      setOverview(overviewData);
      setEquipments(equipmentsData);
      setOrders(ordersData);
      setArticles(articlesData);

      if (articlesData.length > 0 && !selectedArticle) {
        setSelectedArticle(articlesData[0]);
      }
    } catch (err: any) {
      showToast(err.message || 'Falha ao carregar informações do portal.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Categorias únicas dos equipamentos para filtro
  const categories = Array.from(new Set(equipments.map(e => e.category))).filter(Boolean);

  const filteredEquipments = equipments.filter(e => {
    if (eqCategoryFilter !== 'all' && e.category !== eqCategoryFilter) return false;
    if (eqSearch.trim()) {
      const q = eqSearch.toLowerCase().trim();
      const matchName = e.name.toLowerCase().includes(q);
      const matchModel = e.model?.toLowerCase().includes(q);
      const matchManuf = e.manufacturer?.toLowerCase().includes(q);
      const matchLoc = e.physical_location?.toLowerCase().includes(q) || e.location_name?.toLowerCase().includes(q);
      if (!matchName && !matchModel && !matchManuf && !matchLoc) return false;
    }
    return true;
  });

  const filteredArticles = articles.filter(a => {
    if (!articleSearch.trim()) return true;
    const q = articleSearch.toLowerCase().trim();
    return a.title.toLowerCase().includes(q) || a.tags?.toLowerCase().includes(q);
  });

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Não registrado';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const formatCategory = (cat: string) => {
    const map: Record<string, string> = {
      facial_access: 'Reconhecimento Facial',
      cctv_dvr: 'CFTV / Câmeras',
      gate_module: 'Módulo de Portão',
      router_ont: 'Roteador / ONT',
      switch: 'Switch de Rede',
      access_point: 'Access Point Wi-Fi',
      intercom: 'Interfonia / VoIP',
      alarm: 'Alarme / Cerca',
      ups: 'Nobreak / Energia'
    };
    return map[cat] || cat;
  };

  const getCategoryColor = (cat: string) => {
    const map: Record<string, string> = {
      facial_access: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      cctv_dvr: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      gate_module: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      router_ont: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      switch: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      access_point: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    };
    return map[cat] || 'bg-slate-700/50 text-slate-300 border-slate-600/50';
  };

  return (
    <div className="min-h-screen bg-[#070D1B] text-slate-100 flex flex-col font-sans">
      {/* Header Superior do Portal */}
      <header className="bg-[#0B1528] border-b border-[#1A2C49] sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>{overview?.client.name || 'Portal do Condomínio'}</span>
                <span className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Portal Seguro
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Transparência e Gestão de Infraestrutura
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200">{currentUser.name}</span>
              <span className="text-[10px] text-slate-400">Síndico(a) / Gestor(a)</span>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 border border-slate-700/80 text-xs font-semibold transition"
              title="Encerrar sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-[#132238] flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#101C31]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('equipments')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
              activeTab === 'equipments'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#101C31]'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Equipamentos</span>
            {equipments.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-900/60 text-[10px]">
                {equipments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#101C31]'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Atendimentos Concluídos</span>
            {orders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-900/60 text-[10px]">
                {orders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('guides')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 ${
              activeTab === 'guides'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-[#101C31]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Manuais & Guias</span>
            {articles.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-900/60 text-[10px]">
                {articles.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Conteúdo Principal do Portal com Pull-to-Refresh móvel */}
      <PullToRefresh onRefresh={loadPortalData}>
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400 gap-3">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Carregando painel do condomínio...</p>
          </div>
        ) : (
          <>
            {/* ABA 1: VISÃO GERAL */}
            {activeTab === 'overview' && overview && (
              <div className="space-y-6 animate-fadeIn">
                {/* Banner de Boas-vindas */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-[#0B1528] border border-blue-500/30 p-6 sm:p-8 shadow-2xl">
                  <div className="relative z-10 max-w-2xl space-y-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Painel do Gestor
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {overview.client.name}
                    </h1>
                    {overview.client.address && (
                      <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5 pt-1">
                        <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{overview.client.address}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* 4 Cards de Métricas */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#101C31] border border-[#1E3054] rounded-2xl p-4 sm:p-5 shadow-lg">
                    <div className="flex items-center justify-between text-blue-400 pb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Equipamentos</span>
                      <Server className="w-5 h-5" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-white">
                      {overview.stats.total_equipments}
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1">Itens documentados e ativos</p>
                  </div>

                  <div className="bg-[#101C31] border border-[#1E3054] rounded-2xl p-4 sm:p-5 shadow-lg">
                    <div className="flex items-center justify-between text-emerald-400 pb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Atendimentos</span>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-white">
                      {overview.stats.completed_services}
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1">Serviços executados com sucesso</p>
                  </div>

                  <div className="bg-[#101C31] border border-[#1E3054] rounded-2xl p-4 sm:p-5 shadow-lg">
                    <div className="flex items-center justify-between text-amber-400 pb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Última Visita</span>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-white truncate pt-1">
                      {formatDate(overview.stats.last_service_date)}
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1">Data da última intervenção</p>
                  </div>

                  <div className="bg-[#101C31] border border-[#1E3054] rounded-2xl p-4 sm:p-5 shadow-lg">
                    <div className="flex items-center justify-between text-purple-400 pb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Manuais</span>
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-white">
                      {overview.stats.available_guides}
                    </div>
                    <p className="text-[11px] text-slate-400 pt-1">Guias e procedimentos operacionais</p>
                  </div>
                </div>

                {/* Locais do Condomínio & Contatos */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Locais Físicos */}
                  <div className="lg:col-span-2 bg-[#101C31] border border-[#1E3054] rounded-2xl p-5 shadow-lg space-y-4">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      Locais Físicos da Infraestrutura
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {overview.locations.map(loc => (
                        <div key={loc.id} className="p-3 rounded-xl bg-[#0B1528] border border-slate-800 space-y-1">
                          <div className="font-semibold text-sm text-slate-200">{loc.name}</div>
                          {loc.address && (
                            <div className="text-xs text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{loc.address}</span>
                            </div>
                          )}
                          {loc.contact_name && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 pt-1">
                              <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{loc.contact_name} {loc.phone && `(${loc.phone})`}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Informações Cadastrais */}
                  <div className="bg-[#101C31] border border-[#1E3054] rounded-2xl p-5 shadow-lg space-y-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      Dados Cadastrais
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 block">Identificação</span>
                        <span className="font-medium text-slate-200">{overview.client.identification_name || overview.client.name}</span>
                      </div>
                      {overview.client.document && (
                        <div>
                          <span className="text-slate-400 block">CNPJ / Documento</span>
                          <span className="font-medium text-slate-200">{overview.client.document}</span>
                        </div>
                      )}
                      {overview.client.phone && (
                        <div>
                          <span className="text-slate-400 block">Telefone</span>
                          <span className="font-medium text-slate-200 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-500" />
                            {overview.client.phone}
                          </span>
                        </div>
                      )}
                      {overview.client.email && (
                        <div>
                          <span className="text-slate-400 block">E-mail</span>
                          <span className="font-medium text-slate-200 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-500" />
                            {overview.client.email}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: EQUIPAMENTOS */}
            {activeTab === 'equipments' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1A2C49]">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Server className="w-5 h-5 text-blue-400" />
                      Inventário de Equipamentos do Condomínio
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Relação de ativos físicos instalados com fotos, fabricantes e localização.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por nome, modelo..."
                        value={eqSearch}
                        onChange={(e) => setEqSearch(e.target.value)}
                        className="bg-[#101C31] border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 w-52 sm:w-64"
                      />
                    </div>
                  </div>
                </div>

                {/* Filtro por Categorias */}
                {categories.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      onClick={() => setEqCategoryFilter('all')}
                      className={`px-3 py-1 rounded-lg transition ${
                        eqCategoryFilter === 'all'
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-[#101C31] text-slate-400 hover:text-white'
                      }`}
                    >
                      Todas ({equipments.length})
                    </button>
                    {categories.map(cat => {
                      const count = equipments.filter(e => e.category === cat).length;
                      return (
                        <button
                          key={cat}
                          onClick={() => setEqCategoryFilter(cat)}
                          className={`px-3 py-1 rounded-lg transition ${
                            eqCategoryFilter === cat
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'bg-[#101C31] text-slate-400 hover:text-white'
                          }`}
                        >
                          {formatCategory(cat)} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Grade de Equipamentos */}
                {filteredEquipments.length === 0 ? (
                  <div className="p-12 text-center bg-[#101C31] border border-slate-800 rounded-2xl text-slate-400 space-y-2">
                    <Server className="w-8 h-8 mx-auto text-slate-600" />
                    <p className="text-sm">Nenhum equipamento localizado para os filtros informados.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredEquipments.map(eq => (
                      <div
                        key={eq.id}
                        className="bg-[#101C31] border border-[#1E3054] rounded-2xl p-4 shadow-lg hover:border-blue-500/50 transition space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${getCategoryColor(eq.category)}`}>
                              {formatCategory(eq.category)}
                            </span>
                            {eq.location_name && (
                              <span className="text-[11px] text-slate-400 flex items-center gap-1 truncate max-w-[150px]">
                                <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                                <span className="truncate">{eq.location_name}</span>
                              </span>
                            )}
                          </div>

                          {eq.photo_url ? (
                            <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                              <img
                                src={eq.photo_url}
                                alt={eq.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="w-full h-24 rounded-xl bg-[#0B1528] border border-slate-800 flex items-center justify-center text-slate-600">
                              <Server className="w-8 h-8" />
                            </div>
                          )}

                          <div>
                            <h3 className="font-bold text-white text-base leading-snug">{eq.name}</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {eq.manufacturer && `${eq.manufacturer} `}
                              {eq.model && `• ${eq.model}`}
                            </p>
                          </div>
                        </div>

                        {eq.physical_location && (
                          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
                            <span className="text-slate-400 font-medium">Localização:</span>
                            <span className="text-slate-200">{eq.physical_location}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: ATENDIMENTOS CONCLUÍDOS */}
            {activeTab === 'orders' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="pb-4 border-b border-[#1A2C49]">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-emerald-400" />
                    Histórico de Atendimentos Concluídos
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Relatório transparente das manutenções, corretivas e intervenções técnicas realizadas.
                  </p>
                </div>

                {orders.length === 0 ? (
                  <div className="p-12 text-center bg-[#101C31] border border-slate-800 rounded-2xl text-slate-400 space-y-2">
                    <Wrench className="w-8 h-8 mx-auto text-slate-600" />
                    <p className="text-sm">Nenhum atendimento finalizado registrado até o momento.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map(order => (
                      <div
                        key={order.id}
                        className="bg-[#101C31] border border-[#1E3054] rounded-2xl p-5 shadow-lg space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                              Concluído
                            </span>
                            <span className="text-xs text-slate-400">
                              • {formatDate(order.date_time)}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            {order.location_name && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                                {order.location_name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                              {order.technician_name}
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                            Motivo / Descrição do Chamado
                          </span>
                          <h4 className="font-semibold text-white text-sm sm:text-base mt-0.5">
                            {order.problem_description}
                          </h4>
                        </div>

                        {order.changes_made && (
                          <div className="p-3 rounded-xl bg-[#0B1528] border border-slate-800/80 text-xs space-y-1">
                            <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1">
                              <Wrench className="w-3 h-3" /> Ações Realizadas
                            </span>
                            <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                              {order.changes_made}
                            </p>
                          </div>
                        )}

                        {order.test_results && (
                          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs space-y-1">
                            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Resultado dos Testes
                            </span>
                            <p className="text-emerald-200/90 leading-relaxed">
                              {order.test_results}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA 4: MANUAIS E GUIAS (KB) */}
            {activeTab === 'guides' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1A2C49]">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-purple-400" />
                      Manuais e Guias Operacionais
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Procedimentos técnicos explicativos e orientações operacionais para o síndico e portaria.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar manual por título ou tag..."
                        value={articleSearch}
                        onChange={(e) => setArticleSearch(e.target.value)}
                        className="bg-[#101C31] border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 w-60"
                      />
                    </div>
                  </div>
                </div>

                {filteredArticles.length === 0 ? (
                  <div className="p-12 text-center bg-[#101C31] border border-slate-800 rounded-2xl text-slate-400 space-y-2">
                    <BookOpen className="w-8 h-8 mx-auto text-slate-600" />
                    <p className="text-sm">Nenhum procedimento disponível no momento.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Lista Lateral de Artigos */}
                    <div className="lg:col-span-4 space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">
                      {filteredArticles.map(art => {
                        const isSelected = selectedArticle?.id === art.id;
                        return (
                          <div
                            key={art.id}
                            onClick={() => setSelectedArticle(art)}
                            className={`p-3.5 rounded-xl border transition cursor-pointer space-y-1.5 ${
                              isSelected
                                ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-md'
                                : 'bg-[#101C31] border-[#1E3054] text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <h4 className="font-semibold text-xs sm:text-sm line-clamp-2">
                              {art.title}
                            </h4>
                            {art.tags && (
                              <div className="flex flex-wrap gap-1">
                                {art.tags.split(',').map(tag => (
                                  <span
                                    key={tag.trim()}
                                    className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400"
                                  >
                                    #{tag.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Leitor do Artigo Selecionado */}
                    <div className="lg:col-span-8 bg-[#101C31] border border-[#1E3054] rounded-2xl p-6 sm:p-8 shadow-xl space-y-4">
                      {selectedArticle ? (
                        <div>
                          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
                            <div>
                              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                                {selectedArticle.title}
                              </h2>
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Atualizado em: {formatDate(selectedArticle.updated_at)}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => window.print()}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                              title="Imprimir ou salvar PDF"
                            >
                              <Printer className="w-4 h-4 text-slate-400" />
                              <span className="hidden sm:inline">Imprimir</span>
                            </button>
                          </div>

                          {/* Renderização sanitizada de Markdown */}
                          <div
                            className="pt-6 prose prose-invert prose-sm max-w-none prose-headings:text-slate-100 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-pre:bg-[#070D1B] prose-pre:border prose-pre:border-slate-800"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(marked.parse(selectedArticle.body_md) as string)
                            }}
                          />
                        </div>
                      ) : (
                        <div className="py-20 text-center text-slate-500 text-xs">
                          Selecione um manual na lista lateral para leitura.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </PullToRefresh>

    {/* Rodapé simples do Portal */}
      <footer className="border-t border-[#1A2C49] bg-[#070D1B] py-4 text-center text-xs text-slate-400">
        <p>ITFY — Portal de Transparência e Infraestrutura • Todos os direitos reservados</p>
      </footer>
    </div>
  );
};

