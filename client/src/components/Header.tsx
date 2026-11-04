import React, { useState, useEffect, useRef } from 'react';
import { Search, Printer, Server, Share2, Building2, MapPin, X, ArrowRight, ShieldAlert, Edit, Plus, LayoutDashboard, Menu, ArrowLeft } from 'lucide-react';
import { Client, Location } from '../types';
import { api } from '../services/api';

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
  onNavigateToItem
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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

      {/* Barra de Busca Rápida */}
      <div className="relative flex-1 max-w-md" ref={searchRef}>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults) setShowSearchPopup(true); }}
            placeholder="Buscar por cliente, IP, MAC, porta, modelo..."
            className="w-full bg-[#132238] text-sm text-slate-100 placeholder-slate-400 pl-9 pr-8 py-1.5 rounded-lg border border-[#24375A] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults(null); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown de Resultados da Busca */}
        {showSearchPopup && searchResults && (
          <div className="absolute left-0 right-0 mt-2 bg-[#132238] border border-[#24375A] rounded-xl shadow-2xl p-3 z-50 max-h-96 overflow-y-auto space-y-3">
            {searchResults.equipments?.length === 0 &&
             searchResults.ports?.length === 0 &&
             searchResults.clients?.length === 0 && (
              <div className="text-center py-4 text-xs text-slate-400">
                Nenhum resultado encontrado para "{searchQuery}".
              </div>
            )}

            {/* Equipamentos */}
            {searchResults.equipments?.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400 mb-1 flex items-center gap-1.5">
                  <Server className="w-3 h-3" /> Equipamentos ({searchResults.equipments.length})
                </div>
                <div className="space-y-1">
                  {searchResults.equipments.map((eq: any) => (
                    <div
                      key={eq.id}
                      onClick={() => {
                        setShowSearchPopup(false);
                        onNavigateToItem?.('equipment', eq.id);
                      }}
                      className="p-2 rounded bg-[#0F1B2D]/70 hover:bg-[#1D3250] cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-slate-100">{eq.name}</span>
                        <span className="text-slate-400 text-[11px] ml-2">({eq.model || eq.category})</span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          IP: <span className="text-emerald-400">{eq.local_ip || 'N/A'}</span> • MAC: {eq.mac_address || 'N/A'}
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Portas / NAT */}
            {searchResults.ports?.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1.5">
                  <Share2 className="w-3 h-3" /> Regras de Portas ({searchResults.ports.length})
                </div>
                <div className="space-y-1">
                  {searchResults.ports.map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setShowSearchPopup(false);
                        onNavigateToItem?.('port', p.id);
                      }}
                      className="p-2 rounded bg-[#0F1B2D]/70 hover:bg-[#1D3250] cursor-pointer flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-slate-200">{p.service_name}</div>
                        <div className="text-[11px] font-mono text-amber-300">
                          WAN:{p.external_port} → {p.destination_local_ip}:{p.internal_port} ({p.protocol})
                        </div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        p.status === 'funcionando' ? 'bg-emerald-500/20 text-emerald-400' :
                        p.status === 'com_falha' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
    </header>
  );
};
