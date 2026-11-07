import React, { useState, useEffect, useRef } from 'react';
import { Search, Printer, Server, Share2, Building2, MapPin, X, ArrowRight, ShieldAlert, Edit, Plus, LayoutDashboard, Menu, ArrowLeft, Command } from 'lucide-react';
import { Client, Location } from '../types';
import { api } from '../services/api';
import { QuickSearchModal } from './QuickSearchModal';

interface HeaderProps {
  activeTab?: string;
  onOpenOverview?: () => void;
  onGoBack?: () => void;
  canGoBack?: boolean;
  onToggleMobileMenu?: () => void;
  clients: Client[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  selectedLocationId: string;
  onSelectLocation: (locId: string) => void;
  onOpenEquipments: () => void;
  onOpenPortForwards: () => void;
  onOpenReport: () => void;
  onNavigateToItem?: (type: string, id: string) => void;
  onNavigateToTab?: (tab: string, entityId?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onOpenOverview,
  onGoBack,
  canGoBack = false,
  onToggleMobileMenu,
  clients,
  selectedClientId,
  onSelectClient,
  selectedLocationId,
  onSelectLocation,
  onOpenEquipments,
  onOpenPortForwards,
  onOpenReport,
  onNavigateToItem,
  onNavigateToTab
}) => {
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Listener global para Ctrl+K e '/'
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen(true);
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        setIsQuickSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const locations = selectedClient?.locations || [];

  // Busca rápida com debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.quickSearch(searchQuery);
        setSearchResults(res);
        setShowSearchPopup(true);
      } catch (err) {
        console.error('Erro na busca rápida:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fecha popup ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchPopup(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-[#0F1B2D] border-b border-[#1D3054] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
      {/* Botões de Ação, Navegação e Seletores de Cliente */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Botão Mobile para Abrir Menu Lateral */}
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-lg bg-[#132238] hover:bg-[#1C2F4D] text-slate-300 hover:text-white border border-[#24375A] transition shrink-0"
            title="Abrir Menu de Navegação"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        {/* Botão Voltar para Tela Anterior */}
        {canGoBack && onGoBack && (
          <button
            type="button"
            onClick={onGoBack}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#16253E] hover:bg-[#1E3150] text-slate-200 hover:text-white border border-[#24375A] shadow-sm transition shrink-0"
            title="Voltar para a tela anterior"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        )}

        {onOpenOverview && (
          <button
            onClick={onOpenOverview}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-500'
                : 'bg-[#132238] text-slate-300 hover:text-white hover:bg-[#1A2D48] border border-[#24375A]'
            }`}
            title="Ir para a Visão Geral de Todos os Condomínios"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Visão Geral</span>
          </button>
        )}

        <div className="flex items-center gap-2 bg-[#132238] border border-[#24375A] rounded-lg px-3 py-1.5">
          <Building2 className="w-4 h-4 text-blue-400" />
          <select
            value={selectedClientId}
            onChange={(e) => onSelectClient(e.target.value)}
            className="bg-transparent text-sm font-semibold text-white focus:outline-none cursor-pointer pr-2"
          >
            {clients.map(c => (
              <option key={c.id} value={c.id} className="bg-[#0F1B2D] text-slate-100">
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {locations.length > 0 && (
          <div className="flex items-center gap-2 bg-[#132238] border border-[#24375A] rounded-lg px-3 py-1.5">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <select
              value={selectedLocationId}
              onChange={(e) => onSelectLocation(e.target.value)}
              className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer pr-2"
            >
              {locations.map(loc => (
                <option key={loc.id} value={loc.id} className="bg-[#0F1B2D] text-slate-200">
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Barra de Busca Rápida com Atalho Global */}
      <div className="relative flex-1 max-w-md">
        <button
          type="button"
          onClick={() => setIsQuickSearchOpen(true)}
          className="w-full flex items-center justify-between bg-[#132238] text-sm text-slate-400 pl-3 pr-2 py-1.5 rounded-lg border border-[#24375A] hover:border-blue-500/60 focus:outline-none transition-colors text-left"
          title="Abrir busca global (Atalho: Ctrl + K ou /)"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span className="truncate text-xs sm:text-sm text-slate-300">Buscar IP, MAC, porta, equipamento...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-[#0B132B] border border-[#24375A] rounded">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Botões de Ação Rápida */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenEquipments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-[#172643] hover:bg-[#1E335A] border border-[#24375A] transition-all"
        >
          <Server className="w-3.5 h-3.5 text-blue-400" />
          <span>Equipamentos</span>
        </button>

        <button
          onClick={onOpenPortForwards}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-[#172643] hover:bg-[#1E335A] border border-[#24375A] transition-all"
        >
          <Share2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Regras de portas</span>
        </button>

        <button
          onClick={onOpenReport}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-sm transition-all"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Imprimir / PDF</span>
        </button>
      </div>

      {/* Paleta de Comando e Busca Rápida Modal (FTS5) */}
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        onNavigateToTab={(tab, entityId) => {
          if (onNavigateToTab) {
            onNavigateToTab(tab, entityId);
          } else if (onNavigateToItem) {
            onNavigateToItem(tab, entityId || '');
          }
        }}
        onSelectClient={onSelectClient}
        currentClientId={selectedClientId}
      />
    </header>
  );
};
