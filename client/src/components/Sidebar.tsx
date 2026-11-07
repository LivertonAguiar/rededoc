import React, { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Server,
  Network,
  Share2,
  KeyRound,
  Wrench,
  History,
  FileText,
  Database,
  ShieldCheck,
  Radio,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
  ChevronRightSquare,
  BookOpen,
  Globe,
  Layers
} from 'lucide-react';
import { User } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedClientName?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  selectedClientName,
  isOpenMobile = false,
  onCloseMobile,
  currentUser,
  onLogout
}) => {
  const [isInfraOpen, setIsInfraOpen] = useState(true);
  const [isOpsOpen, setIsOpsOpen] = useState(true);

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const isClientTab = [
    'client-network',
    'equipments',
    'topology',
    'port-forwards',
    'credentials',
    'service-orders',
    'audit-history',
    'reports',
    'procedures',
    'domains',
    'ipam'
  ].includes(activeTab);

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full text-slate-300 select-none">
      {/* Cabeçalho do App / Logo */}
      <div className="p-4 sm:p-5 flex-1 overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between pb-4 border-b border-[#1D3054]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                ITFY
                <span className="text-[10px] uppercase font-semibold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">Pro</span>
              </div>
              <div className="text-[11px] text-slate-400">Documentação de Redes</div>
            </div>
          </div>

          {/* Botão fechar em telas móveis */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1A2C49] transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* GRUPO 1: GESTÃO GLOBAL */}
        <div className="mt-5 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
            Sistema Geral
          </div>

          <button
            onClick={() => handleSelectTab('overview')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'overview'
                ? 'bg-[#1D3250] text-white shadow-sm border-l-4 border-blue-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'overview' ? 'text-amber-400' : 'text-slate-400'}`} />
            <span className="truncate">Visão Geral</span>
          </button>

          <button
            onClick={() => handleSelectTab('clients')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'clients'
                ? 'bg-[#1D3250] text-white shadow-sm border-l-4 border-blue-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
            }`}
          >
            <Building2 className={`w-4 h-4 shrink-0 ${activeTab === 'clients' ? 'text-blue-400' : 'text-slate-400'}`} />
            <span className="truncate">Clientes e Locais</span>
          </button>

          <button
            onClick={() => handleSelectTab('procedures')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'procedures'
                ? 'bg-[#1D3250] text-white shadow-sm border-l-4 border-cyan-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
            }`}
          >
            <BookOpen className={`w-4 h-4 shrink-0 ${activeTab === 'procedures' ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span className="truncate">Procedimentos (KB)</span>
          </button>

          <button
            onClick={() => handleSelectTab('domains')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'domains'
                ? 'bg-[#1D3250] text-white shadow-sm border-l-4 border-indigo-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
            }`}
          >
            <Globe className={`w-4 h-4 shrink-0 ${activeTab === 'domains' ? 'text-indigo-400' : 'text-slate-400'}`} />
            <span className="truncate">Domínios e SSL</span>
          </button>
        </div>

        {/* GRUPO 2: CONTEXTO DO CLIENTE ATIVO */}
        <div className="mt-6 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1 flex items-center justify-between">
            <span>Cliente Ativo</span>
            {selectedClientName && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            )}
          </div>

          {selectedClientName ? (
            <>
              {/* Card Resumo do Cliente Selecionado */}
              <div
                onClick={() => handleSelectTab('client-network')}
                className={`p-2.5 rounded-xl border mb-2 cursor-pointer transition-all ${
                  isClientTab
                    ? 'bg-[#14233D] border-blue-500/40 shadow-sm'
                    : 'bg-[#101C31] border-[#1D3054] hover:border-slate-600'
                }`}
                title="Clique para abrir o painel deste cliente"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-xs font-bold text-white truncate">{selectedClientName}</span>
                </div>
                <div className="text-[10px] text-blue-300 mt-0.5 flex items-center justify-between">
                  <span>Perfil selecionado</span>
                  <span className="text-[9px] bg-blue-500/20 px-1 py-0.2 rounded border border-blue-500/30">Abrir</span>
                </div>
              </div>

              {/* Itens do Cliente */}
              <button
                onClick={() => handleSelectTab('client-network')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'client-network'
                    ? 'bg-[#1D3250] text-white shadow-sm border-l-4 border-blue-500 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
                }`}
              >
                <Radio className={`w-4 h-4 shrink-0 ${activeTab === 'client-network' ? 'text-blue-400' : 'text-slate-400'}`} />
                <span className="truncate">Painel da Rede</span>
              </button>

              {/* Sub-seção: Infraestrutura */}
              <div className="pt-1">
                <button
                  onClick={() => setIsInfraOpen(!isInfraOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  <span className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-blue-400" />
                    <span>Infraestrutura</span>
                  </span>
                  {isInfraOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {isInfraOpen && (
                  <div className="pl-4 space-y-0.5 border-l border-[#1D3054] ml-3.5 my-1">
                    <button
                      onClick={() => handleSelectTab('equipments')}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'equipments'
                          ? 'bg-[#1D3250] text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
                      }`}
                    >
                      <Server className="w-3.5 h-3.5 text-slate-400" />
                      <span>Equipamentos</span>
                    </button>

                    <button
                      onClick={() => handleSelectTab('topology')}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'topology'
                          ? 'bg-[#1D3250] text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
                      }`}
                    >
                      <Network className="w-3.5 h-3.5 text-slate-400" />
                      <span>Topologia da Rede</span>
                    </button>

                    <button
                      onClick={() => handleSelectTab('ipam')}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'ipam'
                          ? 'bg-[#1D3250] text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sub-redes (IPAM)</span>
                    </button>

                    <button
                      onClick={() => handleSelectTab('port-forwards')}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'port-forwards'
                          ? 'bg-[#1D3250] text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
                      }`}
                    >
                      <Share2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Portas (NAT)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Cofre de Senhas */}
              <button
                onClick={() => handleSelectTab('credentials')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'credentials'
                    ? 'bg-[#1D3250] text-white shadow-sm border-l-4 border-blue-500 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
                }`}
              >
                <KeyRound className={`w-4 h-4 shrink-0 ${activeTab === 'credentials' ? 'text-amber-400' : 'text-slate-400'}`} />
                <span className="truncate">Cofre de Credenciais</span>
              </button>

              {/* Sub-seção: Operações & Histórico */}
              <div className="pt-1">
                <button
                  onClick={() => setIsOpsOpen(!isOpsOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  <span className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Operações & O.S.</span>
                  </span>
                  {isOpsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {isOpsOpen && (
                  <div className="pl-4 space-y-0.5 border-l border-[#1D3054] ml-3.5 my-1">
                    <button
                      onClick={() => handleSelectTab('service-orders')}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'service-orders'
                          ? 'bg-[#1D3250] text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
                      }`}
                    >
                      <Wrench className="w-3.5 h-3.5 text-slate-400" />
                      <span>Atendimentos</span>
                    </button>

                    <button
                      onClick={() => handleSelectTab('audit-history')}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'audit-history'
                          ? 'bg-[#1D3250] text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
                      }`}
                    >
                      <History className="w-3.5 h-3.5 text-slate-400" />
                      <span>Histórico Técnico</span>
                    </button>

                    <button
                      onClick={() => handleSelectTab('procedures')}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition ${
                        activeTab === 'procedures'
                          ? 'bg-[#1D3250] text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Procedimentos</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Relatórios */}
              <button
                onClick={() => handleSelectTab('reports')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'reports'
                    ? 'bg-[#1D3250] text-white shadow-sm border-l-4 border-blue-500 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
                }`}
              >
                <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'reports' ? 'text-blue-400' : 'text-slate-400'}`} />
                <span className="truncate">Relatórios e PDF</span>
              </button>
            </>
          ) : (
            <div className="p-3 rounded-xl bg-[#101C31] border border-[#1D3054] text-center space-y-2">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Nenhum cliente selecionado no momento.
              </p>
              <button
                onClick={() => handleSelectTab('clients')}
                className="w-full py-1.5 px-3 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold border border-blue-500/30 transition"
              >
                Escolher Condomínio
              </button>
            </div>
          )}
        </div>

        {/* GRUPO 3: SISTEMA E ADMINISTRAÇÃO */}
        <div className="mt-6 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
            Sistema
          </div>

          <button
            onClick={() => handleSelectTab('backup')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'backup'
                ? 'bg-[#1D3250] text-white shadow-sm border-l-4 border-blue-500 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
            }`}
          >
            <Database className={`w-4 h-4 shrink-0 ${activeTab === 'backup' ? 'text-purple-400' : 'text-slate-400'}`} />
            <span className="truncate">Configurações e Backup</span>
          </button>
        </div>
      </div>

      {/* Rodapé / Informações de Segurança e Usuário */}
      <div className="p-4 border-t border-[#1D3054] bg-[#0A1424]/80 space-y-3 shrink-0">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-semibold text-emerald-400">Sistema Online</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">v1.0.0</span>
        </div>

        <div className="pt-1 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-xs border border-blue-500/30 shrink-0">
              {currentUser?.name
                ? currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                : 'IT'}
            </div>
            <div className="truncate max-w-[130px]">
              <div className="text-slate-200 font-medium truncate text-xs">
                {currentUser?.name || 'Técnico Autenticado'}
              </div>
              <div className="text-[10px] text-slate-500 capitalize">
                {currentUser?.role === 'admin' ? 'Administrador' : currentUser?.role === 'tecnico' ? 'Técnico de Campo' : 'Visualizador'}
              </div>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
              title="Encerrar Sessão (Logout)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar Desktop Fixa */}
      <aside className="hidden lg:flex w-64 bg-[#0F1B2D] border-r border-[#1D3054] flex-col justify-between shrink-0 min-h-screen">
        {sidebarContent}
      </aside>

      {/* Drawer Mobile Deslizante */}
      {isOpenMobile && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && onCloseMobile) onCloseMobile();
          }}
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex animate-fadeIn"
        >
          <div className="w-72 bg-[#0F1B2D] border-r border-[#1D3054] h-full shadow-2xl flex flex-col animate-slideIn">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
