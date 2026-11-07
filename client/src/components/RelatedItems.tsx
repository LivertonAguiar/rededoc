import React, { useState, useEffect } from 'react';
import {
  Link2,
  Plus,
  Trash2,
  Share2,
  Lock,
  Server,
  Wrench,
  FileText,
  Paperclip,
  Globe,
  Network,
  ExternalLink,
  Loader2,
  AlertCircle,
  Search,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { EntityType, RelatedItem, AvailableLinkTarget } from '../types';
import { useDialog } from '../context/DialogContext';

interface RelatedItemsProps {
  clientId: string;
  entityType: EntityType;
  entityId: string;
  onNavigate?: (tab: string, entityId: string) => void;
  className?: string;
}

export const RelatedItems: React.FC<RelatedItemsProps> = ({
  clientId,
  entityType,
  entityId,
  onNavigate,
  className = ''
}) => {
  const { showToast, confirm } = useDialog();
  const [items, setItems] = useState<RelatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableTargets, setAvailableTargets] = useState<AvailableLinkTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [searchTarget, setSearchTarget] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<AvailableLinkTarget | null>(null);
  const [linkLabel, setLinkLabel] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await api.getRelatedItems(entityType, entityId);
      setItems(res);
    } catch (err: any) {
      console.error('Erro ao carregar itens relacionados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) {
      loadItems();
    }
  }, [entityType, entityId]);

  const handleOpenAddModal = async () => {
    setShowAddModal(true);
    setSelectedTarget(null);
    setSearchTarget('');
    setLinkLabel('');
    try {
      setLoadingTargets(true);
      const targets = await api.getAvailableLinkTargets(clientId, entityType, entityId);
      setAvailableTargets(targets);
    } catch (err: any) {
      showToast('Erro ao carregar opções para vinculação.', 'error');
    } finally {
      setLoadingTargets(false);
    }
  };

  const handleSaveLink = async () => {
    if (!selectedTarget) {
      showToast('Selecione um registro para vincular.', 'error');
      return;
    }

    try {
      setSavingLink(true);
      await api.createLink({
        client_id: clientId,
        source_type: entityType,
        source_id: entityId,
        target_type: selectedTarget.type,
        target_id: selectedTarget.id,
        label: linkLabel.trim() || undefined
      });
      showToast('Vínculo criado com sucesso!', 'success');
      setShowAddModal(false);
      loadItems();
    } catch (err: any) {
      showToast(err.message || 'Erro ao vincular registros.', 'error');
    } finally {
      setSavingLink(false);
    }
  };

  const handleDeleteLink = (item: RelatedItem) => {
    if (!item.linkId) return;

    confirm({
      title: 'Remover Vínculo',
      message: `Deseja desvincular "${item.title}" deste registro? O item vinculado não será apagado, apenas a relação entre eles.`,
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteLink(item.linkId!);
          showToast('Vínculo removido.', 'success');
          loadItems();
        } catch (err: any) {
          showToast('Erro ao remover vínculo: ' + err.message, 'error');
        }
      }
    });
  };

  const handleItemClick = (item: RelatedItem) => {
    let targetTab = 'overview';
    switch (item.type) {
      case 'equipment':
        targetTab = 'equipments';
        break;
      case 'credential':
        targetTab = 'credentials';
        break;
      case 'port_forward':
        targetTab = 'ports';
        break;
      case 'service_order':
        targetTab = 'services';
        break;
      case 'article':
        targetTab = 'procedures';
        break;
      default:
        targetTab = 'overview';
    }

    if (onNavigate) {
      onNavigate(targetTab, item.id);
    } else {
      window.location.hash = `#${targetTab}/${item.id}`;
    }
  };

  const getEntityIcon = (type: EntityType) => {
    switch (type) {
      case 'equipment':
        return <Server className="w-4 h-4 text-blue-400" />;
      case 'credential':
        return <Lock className="w-4 h-4 text-emerald-400" />;
      case 'port_forward':
        return <Share2 className="w-4 h-4 text-amber-400" />;
      case 'service_order':
        return <Wrench className="w-4 h-4 text-purple-400" />;
      case 'article':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'attachment':
        return <Paperclip className="w-4 h-4 text-slate-400" />;
      case 'domain':
        return <Globe className="w-4 h-4 text-indigo-400" />;
      case 'subnet':
        return <Network className="w-4 h-4 text-teal-400" />;
      default:
        return <Link2 className="w-4 h-4 text-slate-400" />;
    }
  };

  const filteredTargets = availableTargets.filter(t => {
    // Não permite vincular algo que já está na lista
    if (items.some(i => i.type === t.type && i.id === t.id)) return false;
    if (!searchTarget.trim()) return true;
    const q = searchTarget.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.subtitle.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className={`rounded-2xl bg-[#0c1628] border border-[#1b2b48] p-4 text-slate-200 ${className}`}>
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Link2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
              Itens Relacionados
            </h4>
            <span className="text-[11px] text-slate-400">
              {items.length === 0 ? 'Nenhum vínculo' : `${items.length} ${items.length === 1 ? 'item vinculado' : 'itens vinculados'}`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Vincular...</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>Carregando itens relacionados...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-5 px-3 border border-dashed border-[#1b2b48] rounded-xl text-slate-400 text-xs">
          Nenhum vínculo direto cadastrado para este item.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map(item => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center justify-between p-2.5 rounded-xl bg-[#132238] hover:bg-[#182b46] border border-[#213556] transition group"
            >
              <div
                onClick={() => handleItemClick(item)}
                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                title={`Abrir ${item.title}`}
              >
                <div className="p-1.5 rounded-lg bg-slate-900/50 flex-shrink-0">
                  {getEntityIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-xs text-slate-200 truncate group-hover:text-blue-300 transition-colors">
                      {item.title}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                    <span className="truncate">{item.subtitle}</span>
                    {item.label && (
                      <span className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                        {item.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                {item.origin === 'implicit' ? (
                  <span
                    className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700/50"
                    title="Vínculo automático via relacionamento do sistema"
                  >
                    Auto
                  </span>
                ) : (
                  <>
                    <span
                      className="text-[10px] text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded-md border border-blue-500/30"
                      title="Vínculo manual"
                    >
                      Manual
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteLink(item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Remover vínculo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Vinculação */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0e172a] border border-[#213556] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-[#1c2c48]">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-sm text-slate-100">Vincular Novo Registro</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Buscar no mesmo cliente
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTarget}
                    onChange={e => setSearchTarget(e.target.value)}
                    placeholder="Digite nome, IP, porta ou tipo..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#132238] border border-[#24375A] text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Selecione o registro destino
                </label>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-[#24375A] bg-[#111d31] divide-y divide-[#1e2f4a]">
                  {loadingTargets ? (
                    <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span>Carregando candidatos...</span>
                    </div>
                  ) : filteredTargets.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Nenhum outro registro disponível para vincular.
                    </div>
                  ) : (
                    filteredTargets.map(t => {
                      const isSelected = selectedTarget?.type === t.type && selectedTarget?.id === t.id;
                      return (
                        <div
                          key={`${t.type}-${t.id}`}
                          onClick={() => setSelectedTarget(t)}
                          className={`p-2.5 flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'bg-blue-600/30 text-blue-200'
                              : 'hover:bg-[#162742] text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1 rounded bg-slate-900/60">
                              {getEntityIcon(t.type)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{t.title}</p>
                              <p className="text-[10px] text-slate-400 truncate">{t.subtitle}</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                            {t.category}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Rótulo ou descrição do vínculo (opcional)
                </label>
                <input
                  type="text"
                  value={linkLabel}
                  onChange={e => setLinkLabel(e.target.value)}
                  placeholder="Ex: Roteador de Borda, Manual Oficial, Backup Secundário..."
                  className="w-full px-3 py-2 rounded-xl bg-[#132238] border border-[#24375A] text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-3 border-t border-[#1c2c48] flex items-center justify-end gap-2 bg-[#091122]">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedTarget || savingLink}
                onClick={handleSaveLink}
                className="px-4 py-1.5 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition flex items-center gap-1.5 shadow"
              >
                {savingLink && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Salvar Vínculo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
