import React, { useState, useEffect } from 'react';
import { Search, X, Sparkles, CheckCircle2, Download, AlertCircle, ExternalLink, Image as ImageIcon, Globe } from 'lucide-react';
import { api } from '../services/api';

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery: string;
  onSelectImage: (localUrl: string) => void;
  title?: string;
  equipmentId?: string;
  serviceOrderId?: string;
  clientId?: string;
}

export const ImageSearchModal: React.FC<ImageSearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery,
  onSelectImage,
  title = 'Busca no Google Imagens',
  equipmentId,
  serviceOrderId,
  clientId
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Array<{ title: string; url: string; thumbnail: string; source: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      if (initialQuery.trim()) {
        handleSearch(initialQuery.trim());
      } else {
        setResults([]);
      }
    }
  }, [isOpen, initialQuery]);

  // Fecha com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await api.searchImages(searchTerm.trim());
      setResults(data.results || []);
      if (!data.results || data.results.length === 0) {
        setErrorMessage('Nenhuma imagem encontrada no Google para este modelo. Tente simplificar o nome.');
      }
    } catch (err: any) {
      setErrorMessage('Erro ao consultar imagens no Google: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChooseImage = async (img: { url: string; thumbnail?: string }) => {
    setIsDownloading(img.url);
    setErrorMessage(null);
    try {
      const res = await api.fetchAndSaveImage({
        imageUrl: img.url,
        fallbackUrl: img.thumbnail || img.url,
        equipmentId,
        serviceOrderId,
        clientId
      });
      onSelectImage(res.localUrl);
      onClose();
    } catch (err: any) {
      setErrorMessage('Erro ao baixar e processar imagem: ' + err.message);
    } finally {
      setIsDownloading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
    >
      <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-5 border-b border-[#1E3150] flex items-center justify-between bg-[#0C1525]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {title}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-[10px] text-blue-400 font-bold flex items-center gap-1">
                  <Globe className="w-2.5 h-2.5" />
                  Mecanismo Google
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pesquisa diretamente no Google Imagens com download local e recorte automático de fundo.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1A2C49] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Pesquisa */}
        <div className="p-4 bg-[#0F1B2D] border-b border-[#1E3150]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(query);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex: Huawei HG8145X6, Control iD iDFace, HiLook DVR..."
                className="w-full bg-[#132238] border border-[#24375A] focus:border-blue-500 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-md transition flex items-center gap-1.5 shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Buscando...' : 'Buscar no Google'}</span>
            </button>
          </form>
        </div>

        {/* Galeria de Resultados */}
        <div className="flex-1 overflow-y-auto p-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <Sparkles className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="text-xs">Consultando mecanismo do Google Imagens...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs text-center space-y-2">
              <ImageIcon className="w-10 h-10 text-slate-600" />
              <p>Digite o modelo ou fabricante acima e clique em "Buscar no Google".</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {results.map((img, idx) => {
                const isSelected = isDownloading === img.url;
                return (
                  <div
                    key={idx}
                    onClick={() => !isDownloading && handleChooseImage(img)}
                    className="group relative bg-[#0C1525] border border-[#1E3150] hover:border-blue-500 rounded-xl overflow-hidden cursor-pointer flex flex-col justify-between transition-all duration-200 shadow-md hover:shadow-blue-500/10"
                  >
                    <div className="relative h-28 bg-gradient-to-b from-[#13233c] to-[#0A1220] overflow-hidden flex items-center justify-center p-2">
                      <img
                        src={img.thumbnail}
                        alt={img.title}
                        className="max-h-full max-w-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-blue-600/75 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-1.5 z-20">
                          <Download className="w-4 h-4 animate-bounce" />
                          <span>Baixando e Recortando...</span>
                        </div>
                      )}
                    </div>

                    <div className="p-2 border-t border-[#17253E] text-[10px]">
                      <div className="text-slate-200 font-medium truncate" title={img.title}>
                        {img.title}
                      </div>
                      <div className="text-slate-400 mt-1 flex items-center justify-between">
                        <span className="truncate text-[10px] text-blue-300 font-mono bg-blue-950/40 px-1 py-0.5 rounded border border-blue-900/40 max-w-[130px]">
                          {img.source}
                        </span>
                        <span className="text-blue-400 font-semibold group-hover:underline">Usar</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="p-3 bg-[#0C1525] border-t border-[#1E3150] text-[11px] text-slate-400 flex items-center justify-between">
          <span>Ao escolher uma foto, o arquivo é baixado e o fundo branco é recortado automaticamente.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#17253E] hover:bg-[#1E3150] text-slate-300 text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

