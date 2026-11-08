import React from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, CheckCircle2, ShieldCheck, Download, History, Tag, Layers, RefreshCw } from 'lucide-react';
import { CURRENT_CLIENT_VERSION } from '../services/otaService';

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckUpdates?: () => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  onCheckUpdates
}) => {
  if (!isOpen) return null;

  const releases = [
    {
      version: '1.0.1',
      date: '08 de Novembro de 2026',
      isCurrent: true,
      tag: 'Atualização Atual (OTA & Offline)',
      highlights: [
        {
          type: 'fix',
          label: 'Correção Crítica',
          desc: 'Resolvido erro de login no aplicativo Android nativo (Capacitor WebView).'
        },
        {
          type: 'feat',
          label: 'Offline-First',
          desc: 'Cadastro e alteração de equipamentos offline com proteção contra perda de dados e sincronização automática ao reconectar.'
        },
        {
          type: 'feat',
          label: 'Atualizações OTA',
          desc: 'Atualizações Over-The-Air: receba correções e novidades instantaneamente sem reinstalar o APK.'
        },
        {
          type: 'ui',
          label: 'Identidade Visual',
          desc: 'Novo logotipo oficial ITFY Cyber Nexus e novos ícones de alta resolução no Android e PWA.'
        },
        {
          type: 'security',
          label: 'Segurança AES-256',
          desc: 'Sincronização resiliente de credenciais no cofre para equipamentos cadastrados offline.'
        }
      ]
    },
    {
      version: '1.0.0',
      date: '05 de Novembro de 2026',
      isCurrent: false,
      tag: 'Lançamento Inicial',
      highlights: [
        {
          type: 'feat',
          label: 'Inventário de Rede',
          desc: 'Gestão de equipamentos, roteadores, switches, controladoras faciais e DVR/NVR.'
        },
        {
          type: 'feat',
          label: 'Topologia Interativa',
          desc: 'Diagramas de rede em tempo real com exportação em PDF e auto-organização.'
        },
        {
          type: 'feat',
          label: 'Cofre & IPAM',
          desc: 'Cofre criptografado com AES-256-GCM e cálculo de IPs livres para prevenção de conflitos.'
        },
        {
          type: 'feat',
          label: 'Ordens de Serviço',
          desc: 'Fluxo completo de chamados com evidências fotográficas e anexos.'
        }
      ]
    }
  ];

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[90] animate-fadeIn"
    >
      <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 border-b border-[#1E3150] flex items-center justify-between bg-[#0C1525]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Histórico de Versões</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  v{CURRENT_CLIENT_VERSION}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Registro de atualizações, melhorias e notas de lançamento do ITFY
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Linha do Tempo */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {releases.map((rel) => (
            <div key={rel.version} className="relative pl-6 sm:pl-8 border-l-2 border-blue-500/30 space-y-3">
              {/* Marcador na linha */}
              <div
                className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 ${
                  rel.isCurrent
                    ? 'bg-blue-500 border-blue-300 shadow-md shadow-blue-500/50'
                    : 'bg-slate-700 border-slate-500'
                }`}
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Versão {rel.version}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      rel.isCurrent
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {rel.tag}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{rel.date}</span>
              </div>

              <div className="space-y-2 bg-[#09111E] border border-[#1A2A44] rounded-xl p-3.5">
                {rel.highlights.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 uppercase tracking-wider ${
                        item.type === 'fix'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : item.type === 'security'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : item.type === 'ui'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="leading-relaxed">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Rodapé com Ações */}
        <div className="p-4 bg-[#0C1525] border-t border-[#1E3150] flex flex-wrap items-center justify-between gap-3">
          <a
            href="https://itfy.lpaguiar.com.br/download/apk"
            download={`ITFY-v${CURRENT_CLIENT_VERSION}.apk`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4" />
            <span>Baixar ITFY-v{CURRENT_CLIENT_VERSION}.apk</span>
          </a>

          <div className="flex items-center gap-2">
            {onCheckUpdates && (
              <button
                onClick={onCheckUpdates}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Verificar Atualizações</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
