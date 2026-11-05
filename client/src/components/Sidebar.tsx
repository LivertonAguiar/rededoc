import React from 'react';
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
  LogOut
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
  const menuItems = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'client-network', label: 'Painel da Rede', icon: Radio, badge: selectedClientName },
    { id: 'clients', label: 'Clientes e Locais', icon: Building2 },
    { id: 'equipments', label: 'Equipamentos', icon: Server },
    { id: 'topology', label: 'Topologia da Rede', icon: Network },
    { id: 'port-forwards', label: 'Redirecionamentos', icon: Share2 },
    { id: 'credentials', label: 'Cofre de Credenciais', icon: KeyRound },
    { id: 'service-orders', label: 'Atendimentos', icon: Wrench },
    { id: 'audit-history', label: 'Histórico Técnico', icon: History },
    { id: 'reports', label: 'Relatórios e PDF', icon: FileText },
    { id: 'backup', label: 'Configurações e Backup', icon: Database },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full text-slate-300 select-none">
      {/* Cabeçalho do App / Logo */}
      <div className="p-5">
        <div className="flex items-center justify-between pb-5 border-b border-[#1D3054]">
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

        {/* Menu de Navegação */}
        <nav className="mt-5 space-y-1">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#1D3250] text-white shadow-sm border-l-4 border-blue-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#132238]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
                {item.id === 'client-network' && selectedClientName && (
                  <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 max-w-[80px] truncate border border-blue-500/30">
                    {selectedClientName.split(' ')[0]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Rodapé / Informações de Segurança e Status */}
      <div className="p-4 border-t border-[#1D3054] bg-[#0A1424]/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-semibold text-emerald-400">Sistema Online</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">v1.0.0</span>
        </div>

        <div className="text-[11px] leading-relaxed text-slate-400 flex items-start gap-2 bg-[#101C31] p-2.5 rounded-lg border border-[#1A2C49]">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-200">Cofre AES-256-GCM</div>
            <div className="text-[10px] text-slate-400">Senhas criptografadas e com auditoria de revelação.</div>
          </div>
        </div>

        <div className="pt-1 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center text-xs border border-blue-500/30 shrink-0">
              {currentUser?.name
                ? currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                : 'RD'}
            </div>
            <div className="truncate max-w-[130px]">
              <div className="text-slate-200 font-medium truncate text-xs">
                {currentUser?.name || 'Técnico Autenticado'}
              </div>
              <div className="text-[10px] text-slate-400 capitalize">
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
