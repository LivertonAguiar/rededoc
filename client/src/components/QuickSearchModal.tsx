import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Server,
  Share2,
  KeyRound,
  BookOpen,
  Globe,
  Building2,
  Wrench,
  ChevronRight,
  Command,
  CornerDownLeft,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { SearchResultItem, GroupedSearchResults } from '../types';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab: (tab: string, entityId?: string) => void;
  onSelectClient?: (clientId: string) => void;
  currentClientId?: string;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigateToTab,
  onSelectClient,
  currentClientId
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Foco automático ao abrir
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounce na busca
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res: GroupedSearchResults = await api.searchGlobal(query.trim());
        setResults(res.results || []);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Erro na busca global:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Atalhos de teclado (Up, Down, Enter, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  // Rola o item ativo para a visão
  useEffect(() => {
    if (listRef.current) {
      const activeElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const handleSelectResult = (item: SearchResultItem) => {
    onClose();

    // Se tiver client_id associado e não for cliente direto, seleciona o cliente antes
    if (item.clientId && onSelectClient) {
      onSelectClient(item.clientId);
    }

    const [tab, entityId] = item.urlHash.split('/');
    if (item.type === 'client') {
      if (onSelectClient) onSelectClient(item.id);
      onNavigateToTab('client-network');
    } else {
      onNavigateToTab(tab || 'overview', entityId || item.id);
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'client':
        return <Building2 className="w-4 h-4 text-emerald-400" />;
      case 'equipment':
        return <Server className="w-4 h-4 text-blue-400" />;
      case 'port_forward':
        return <Share2 className="w-4 h-4 text-amber-400" />;
      case 'credential':
        return <KeyRound className="w-4 h-4 text-purple-400" />;
      case 'article':
        return <BookOpen className="w-4 h-4 text-cyan-400" />;
      case 'domain':
        return <Globe className="w-4 h-4 text-indigo-400" />;
      case 'service_order':
        return <Wrench className="w-4 h-4 text-rose-400" />;
      default:
        return <Search className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center p-4 sm:pt-20 animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[#0F172A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Campo de Busca Superior */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-slate-800 bg-[#0B132B]/50">
          <Search className="w-5 h-5 text-slate-400 ml-1 mr-3 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por IP, MAC, equipamento, porta, cliente, procedimento..."
            className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-sm sm:text-base focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-blue-400 animate-spin mr-2 flex-shrink-0" />}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-200 transition-colors mr-2"
              title="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-400 bg-slate-800 border border-slate-700 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Lista de Resultados */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto divide-y divide-slate-800/40 p-2">
          {!query.trim() && (
            <div className="py-12 px-6 text-center text-slate-400 text-xs sm:text-sm">
              <Command className="w-8 h-8 mx-auto mb-3 text-slate-400" />
              <p className="font-medium text-slate-300">Busca Rápida Global (FTS5)</p>
              <p className="text-slate-400 mt-1">
                Digite um endereço IP, MAC Address, modelo, porta NAT, condomínio ou palavra-chave de procedimentos.
              </p>
            </div>
          )}

          {query.trim() && !loading && results.length === 0 && (
            <div className="py-12 px-6 text-center text-slate-400 text-xs sm:text-sm">
              <Search className="w-8 h-8 mx-auto mb-3 text-slate-400" />
              <p className="font-medium text-slate-300">Nenhum resultado encontrado para &quot;{query}&quot;</p>
              <p className="text-slate-400 mt-1">
                Verifique se o termo foi digitado corretamente ou tente buscar por outro parâmetro.
              </p>
            </div>
          )}

          {results.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={`${item.type}_${item.id}_${idx}`}
                onClick={() => handleSelectResult(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-600/20 border border-blue-500/40 text-white' : 'text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-500/30' : 'bg-slate-800/80'} flex-shrink-0`}>
                  {getEntityIcon(item.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{item.title}</span>
                    {item.badge && (
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 flex-shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">
                    {item.subtitle}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 flex-shrink-0">
                  {isSelected && (
                    <span className="text-[11px] font-mono text-blue-400 flex items-center gap-1 hidden sm:flex">
                      Abrir <CornerDownLeft className="w-3 h-3" />
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé com Dicas de Atalho */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-[#0B132B]/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">↓</kbd> Navegar
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded">↵</kbd> Selecionar
            </span>
          </div>
          <span>
            {results.length > 0 ? `${results.length} resultados` : 'RedeDoc Search'}
          </span>
        </div>
      </div>
    </div>
  );
};
