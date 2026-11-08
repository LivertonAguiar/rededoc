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
  Radio,
  X,
  LogOut,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Globe,
  Layers,
  Users,
  Smartphone,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';
import { User } from '../types';
import { ItfyLogo } from './ItfyLogo';
import { CURRENT_CLIENT_VERSION } from '../services/otaService';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedClientName?: string;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
  onOpenVersionHistory?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  selectedClientName,
  isOpenMobile = false,
  onCloseMobile,
  currentUser,
  onLogout,
  onOpenVersionHistory
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

  const renderNavItem = (
    id: string,
    label: string,
    Icon: any,
    iconColor: string,
    badge?: string
  ) => {
    const isActive = activeTab === id;
    return (
      <button
        key={id}
        onClick={() => handleSelectTab(id)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all duration-200 group relative cursor-pointer ${
          isActive
            ? 'bg-gradient-to-r from-blue-600/30 via-cyan-500/15 to-transparent text-white font-bold border-l-[3px] border-cyan-400 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]'
            : 'text-slate-400 hover:text-slate-100 hover:bg-[#122038]/70 font-medium'
        }`}
      >
        <div className="flex items-center gap-3 truncate min-w-0">
          <Icon
            className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
              isActive ? iconColor : 'text-slate-400 group-hover:text-slate-200'
            }`}
          />
          <span className="truncate">{label}</span>
        </div>
        {badge && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
            {badge}
          </span>
        )}
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full text-slate-300 select-none">
      {/* Scrollable Container com Safe-Top */}
      <div className="p-4 sm:p-5 flex-1 overflow-y-auto scrollbar-thin safe-top">
        {/* Cabeçalho do App / Logo Redesenhado */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1A2C49]">
          <div
            className="cursor-pointer transition-transform hover:scale-[1.02] flex items-center gap-2"
            onClick={() => handleSelectTab('overview')}
            title="Ir para a Visão Geral"
          >
            <ItfyLogo variant="horizontal" size={34} />
            <span className="text-[9px] uppercase font-black tracking-widest bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/30">
              Pro
            </span>
          </div>

          {/* Botão fechar em telas móveis */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden w-8 h-8 rounded-xl bg-[#132238] hover:bg-[#1C2F4D] text-slate-400 hover:text-white flex items-center justify-center border border-[#24375A] transition"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* GRUPO 1: VISÃO GERAL & SISTEMA GLOBAL */}
        <div className="mt-5 space-y-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-3 pb-1.5 flex items-center justify-between">
            <span>Visão Global</span>
            <Sparkles className="w-3 h-3 text-cyan-400/80" />
          </div>

          {renderNavItem('overview', 'Painel Geral (NOC)', LayoutDashboard, 'text-amber-400')}
          {renderNavItem('clients', 'Condomínios & Locais', Building2, 'text-blue-400')}
          {renderNavItem('procedures', 'Procedimentos (KB)', BookOpen, 'text-cyan-400')}
          {renderNavItem('domains', 'Domínios e SSL', Globe, 'text-indigo-400')}
        </div>

        {/* GRUPO 2: CONTEXTO DO CLIENTE SELECIONADO */}
        <div className="mt-6 space-y-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-3 pb-1.5 flex items-center justify-between">
            <span>Cliente em Atendimento</span>
            {selectedClientName && (
              <span className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-bold lowercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ativo
              </span>
            )}
          </div>

          {selectedClientName ? (
            <>
              {/* Card Resumo do Cliente Selecionado Redesenhado */}
              <div
                onClick={() => handleSelectTab('client-network')}
                className={`p-3 rounded-2xl border mb-2 cursor-pointer transition-all duration-200 ${
                  isClientTab
                    ? 'bg-gradient-to-br from-[#12233E] via-[#0E1A30] to-[#0A1325] border-cyan-500/40 shadow-lg shadow-cyan-950/40'
                    : 'bg-[#0E182A] border-[#1A2C49] hover:border-slate-500 hover:bg-[#122036]'
                }`}
                title="Abrir infraestrutura deste cliente"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white truncate">{selectedClientName}</span>
                  </div>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                    Painel
                  </span>
                </div>
              </div>

              {renderNavItem('client-network', 'Topologia Geral da Rede', Radio, 'text-blue-400')}

              {/* Sanfona: Infraestrutura Física & Lógica */}
              <div className="pt-1.5">
                <button
                  onClick={() => setIsInfraOpen(!isInfraOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Dispositivos & Rede</span>
                  </span>
                  {isInfraOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-300" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                </button>

                {isInfraOpen && (
                  <div className="pl-3.5 space-y-0.5 border-l-2 border-blue-500/20 ml-3.5 my-1 animate-fadeIn">
                    {renderNavItem('equipments', 'Equipamentos', Server, 'text-blue-400')}
                    {renderNavItem('topology', 'Topologia Gráfica', Network, 'text-cyan-400')}
                    {renderNavItem('ipam', 'Sub-redes (IPAM)', Layers, 'text-emerald-400')}
                    {renderNavItem('port-forwards', 'Portas (NAT)', Share2, 'text-amber-400')}
                  </div>
                )}
              </div>

              {renderNavItem('credentials', 'Cofre de Credenciais', KeyRound, 'text-amber-400', 'AES-256')}

              {/* Sanfona: Operações & Ordens de Serviço */}
              <div className="pt-1.5">
                <button
                  onClick={() => setIsOpsOpen(!isOpsOpen)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ordens de Serviço (O.S.)</span>
                  </span>
                  {isOpsOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-300" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                </button>

                {isOpsOpen && (
                  <div className="pl-3.5 space-y-0.5 border-l-2 border-amber-500/20 ml-3.5 my-1 animate-fadeIn">
                    {renderNavItem('service-orders', 'Atendimentos de Campo', Wrench, 'text-amber-400')}
                    {renderNavItem('audit-history', 'Histórico Técnico', History, 'text-purple-400')}
                  </div>
                )}
              </div>

              {renderNavItem('reports', 'Relatórios & Exportação', FileText, 'text-blue-400')}
            </>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#0E182A] border border-[#1A2C49] text-center space-y-2.5">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Nenhum condomínio selecionado no momento.
              </p>
              <button
                onClick={() => handleSelectTab('clients')}
                className="w-full py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold border border-blue-500/30 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Escolher Condomínio</span>
              </button>
            </div>
          )}
        </div>

        {/* GRUPO 3: SISTEMA, BACKUP & DOWNLOAD DO APK */}
        <div className="mt-6 space-y-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-300 px-3 pb-1.5">
            Administração
          </div>

          {renderNavItem('backup', 'Configurações e Backup', Database, 'text-purple-400')}

          {currentUser?.role === 'admin' &&
            renderNavItem('users', 'Gestão de Usuários', Users, 'text-emerald-400')}

          {/* Card em Destaque: Download do APK Nativo */}
          <a
            href="https://itfy.lpaguiar.com.br/download/apk"
            download={`ITFY-v${CURRENT_CLIENT_VERSION}.apk`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-[#0F2238] to-[#0A162B] border border-emerald-500/30 hover:border-emerald-400 transition-all cursor-pointer mt-3 group shadow-md"
            title={`Download direto do aplicativo Android ITFY-v${CURRENT_CLIENT_VERSION}.apk`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0 group-hover:scale-105 transition-transform">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-xs font-bold text-white truncate">App Android Nativo</div>
                <div className="text-[10px] text-emerald-400 truncate">Offline-First & OTA</div>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
              v{CURRENT_CLIENT_VERSION}
            </span>
          </a>
        </div>
      </div>

      {/* Rodapé / Informações de Segurança e Usuário com Safe-Bottom */}
      <div className="p-4 border-t border-[#1A2C49] bg-[#08101E]/95 backdrop-blur-md space-y-3 shrink-0 safe-bottom">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-semibold text-emerald-400">Sistema Online</span>
          </div>

          <button
            onClick={onOpenVersionHistory}
            className="text-[10px] text-cyan-300 hover:text-white font-mono transition cursor-pointer flex items-center gap-1 bg-cyan-950/40 hover:bg-cyan-900/40 px-2 py-0.5 rounded-full border border-cyan-500/30"
            title="Clique para ver o histórico de versões e notas de atualização"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>v{CURRENT_CLIENT_VERSION}</span>
          </button>
        </div>

        <div className="pt-1 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-600 text-white font-black flex items-center justify-center text-xs shadow-md shadow-blue-500/20 border border-blue-400/30 shrink-0">
              {currentUser?.name
                ? currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                : 'IT'}
            </div>
            <div className="truncate max-w-[130px]">
              <div className="text-slate-200 font-bold truncate text-xs">
                {currentUser?.name || 'Técnico Autenticado'}
              </div>
              <div className="text-[10px] text-slate-300 capitalize font-medium">
                {currentUser?.role === 'admin'
                  ? 'Administrador'
                  : currentUser?.role === 'tecnico'
                  ? 'Técnico de Campo'
                  : 'Visualizador'}
              </div>
            </div>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
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
      <aside className="hidden lg:flex w-64 bg-[#0A1324] border-r border-[#1B2F52] flex-col justify-between shrink-0 min-h-screen">
        {sidebarContent}
      </aside>

      {/* Drawer Mobile Deslizante com Safe Area */}
      {isOpenMobile && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && onCloseMobile) onCloseMobile();
          }}
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex animate-fadeIn"
        >
          <div className="w-72 sm:w-80 bg-[#0A1324] border-r border-[#1B2F52] h-full shadow-2xl flex flex-col animate-slideIn safe-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
