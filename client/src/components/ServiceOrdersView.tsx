import React, { useState, useEffect, useRef } from 'react';
import {
  Wrench,
  Plus,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  Edit,
  ArrowRight,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Upload,
  ExternalLink,
  RefreshCw,
  Info
} from 'lucide-react';
import { ServiceOrder, Client, Equipment, Attachment } from '../types';
import { api } from '../services/api';
import { ImageSearchModal } from './ImageSearchModal';
import { RelatedItems } from './RelatedItems';
import { useDialog } from '../context/DialogContext';

interface ServiceOrdersViewProps {
  client: Client;
  equipments: Equipment[];
  onRefresh: () => void;
  targetOrderId?: string;
  onNavigateToTab?: (tab: string, entityId?: string) => void;
}

export const ServiceOrdersView: React.FC<ServiceOrdersViewProps> = ({
  client,
  equipments,
  onRefresh,
  targetOrderId,
  onNavigateToTab
}) => {
  const { showToast, confirm } = useDialog();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (targetOrderId && orders.length > 0) {
      const found = orders.find(o => o.id === targetOrderId);
      if (found) setSelectedOrder(found);
    }
  }, [targetOrderId, orders]);

  // Fecha modais com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
        setIsSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estados para Anexos / Fotos da O.S.
  const [orderAttachments, setOrderAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    technician_name: 'Liverton Aguiar',
    date_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
    service_type: 'Troca de Roteador/ONT e Mapeamento de Portas',
    problem_description: '',
    status: 'concluido' as any,
    service_cost: 0,
    time_spent_minutes: 60,
    additional_info: '',
    changes_made: '',
    tests_performed: '',
    test_results: '',
    technical_notes: ''
  });

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await api.getServiceOrders(client.id);
      setOrders(data);
      if (data.length > 0 && !selectedOrder) {
        setSelectedOrder(data[0]);
      }
    } catch (err) {
      console.error('Erro ao carregar atendimentos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [client.id]);

  // Carrega anexos/fotos sempre que seleciona uma O.S.
  useEffect(() => {
    if (selectedOrder) {
      loadAttachments(selectedOrder.id);
    } else {
      setOrderAttachments([]);
    }
  }, [selectedOrder?.id]);

  const loadAttachments = async (orderId: string) => {
    setLoadingAttachments(true);
    try {
      const items = await api.getAttachments({ serviceOrderId: orderId });
      setOrderAttachments(items);
    } catch (err) {
      console.error('Erro ao carregar fotos da O.S.:', err);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleUploadPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOrder) return;

    setIsUploadingPhoto(true);
    try {
      await api.uploadImageFile(file, {
        serviceOrderId: selectedOrder.id,
        clientId: client.id
      });
      showToast('Foto anexada com sucesso!', 'success');
      await loadAttachments(selectedOrder.id);
    } catch (err: any) {
      showToast('Erro ao enviar foto: ' + err.message, 'error');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectPhotoFromWeb = async () => {
    if (selectedOrder) {
      await loadAttachments(selectedOrder.id);
      showToast('Foto vinculada ao atendimento!', 'success');
    }
  };

  const handleDeleteAttachment = (attId: string) => {
    confirm({
      title: 'Excluir Foto do Atendimento',
      message: 'Deseja realmente excluir esta foto do atendimento?',
      confirmText: 'Excluir Foto',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteAttachment(attId);
          showToast('Foto removida com sucesso!', 'success');
          if (selectedOrder) {
            await loadAttachments(selectedOrder.id);
          }
        } catch (err: any) {
          showToast('Erro ao excluir foto: ' + err.message, 'error');
        }
      }
    });
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      technician_name: 'Liverton Aguiar',
      date_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
      service_type: 'Manutenção e Troca de Equipamento',
      problem_description: '',
      status: 'em_andamento',
      service_cost: 250,
      time_spent_minutes: 60,
      additional_info: '',
      changes_made: '',
      tests_performed: '',
      test_results: '',
      technical_notes: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (order: ServiceOrder) => {
    setEditingId(order.id);
    setFormData({
      technician_name: order.technician_name,
      date_time: order.date_time,
      service_type: order.service_type,
      problem_description: order.problem_description,
      status: order.status,
      service_cost: order.service_cost ?? 0,
      time_spent_minutes: order.time_spent_minutes ?? 60,
      additional_info: order.additional_info ?? '',
      changes_made: order.changes_made || '',
      tests_performed: order.tests_performed || '',
      test_results: order.test_results || '',
      technical_notes: order.technical_notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        client_id: client.id,
        location_id: client.locations?.[0]?.id || ''
      };

      if (editingId) {
        await api.updateServiceOrder(editingId, payload);
        showToast('Atendimento atualizado com sucesso!', 'success');
      } else {
        await api.createServiceOrder(payload);
        showToast('Novo atendimento registrado com sucesso!', 'success');
      }

      setShowModal(false);
      loadOrders();
      onRefresh();
    } catch (err: any) {
      showToast('Erro ao salvar atendimento: ' + err.message, 'error');
    }
  };

  const handleDelete = (order: ServiceOrder) => {
    confirm({
      title: 'Excluir Atendimento',
      message: `Deseja realmente excluir o atendimento "${order.service_type}"?`,
      confirmText: 'Excluir Atendimento',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteServiceOrder(order.id);
          showToast('Atendimento excluído com sucesso!', 'success');
          loadOrders();
          onRefresh();
        } catch (err: any) {
          showToast('Erro ao excluir: ' + err.message, 'error');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-emerald-400" />
            Atendimentos Técnicos e Ordens de Serviço
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registro cronológico das intervenções, trocas de hardware, testes de conectividade e validações de portas
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Atendimento</span>
        </button>
      </div>

      {/* Conteúdo: Lista à Esquerda + Detalhes à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Atendimentos */}
        <div className="space-y-3">
          {orders.map(order => {
            const isSelected = selectedOrder?.id === order.id;
            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#172744] border-blue-500 shadow-lg'
                    : 'bg-[#101C31] border-[#1D3054] hover:bg-[#132238]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-white text-sm">{order.service_type}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    order.status === 'concluido' ? 'bg-emerald-500/20 text-emerald-400' :
                    order.status === 'em_andamento' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {order.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 mt-2 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>{order.date_time}</span>
                </div>

                <div className="flex items-center gap-3 mt-1.5">
                  {order.service_cost !== undefined && order.service_cost > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                      R$ {Number(order.service_cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {order.time_spent_minutes !== undefined && order.time_spent_minutes > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {order.time_spent_minutes >= 60
                        ? `${Math.floor(order.time_spent_minutes / 60)}h ${order.time_spent_minutes % 60 > 0 ? (order.time_spent_minutes % 60) + 'm' : ''}`
                        : `${order.time_spent_minutes} min`}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-300 mt-2 line-clamp-2">
                  {order.problem_description}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-[#1D3054]">
                  <span>Técnico: <strong className="text-slate-200">{order.technician_name}</strong></span>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Detalhes do Atendimento Selecionado */}
        {selectedOrder ? (
          <div className="lg:col-span-2 bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#1D3054]">
              <div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase inline-block mb-2 ${
                  selectedOrder.status === 'concluido' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {selectedOrder.status}
                </span>
                <h2 className="text-xl font-bold text-white">{selectedOrder.service_type}</h2>
                <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                  <span>Data: <strong className="text-slate-200 font-mono">{selectedOrder.date_time}</strong></span>
                  <span>•</span>
                  <span>Responsável: <strong className="text-slate-200">{selectedOrder.technician_name}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Métricas do Atendimento */}
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">Custo do Serviço</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      R$ {Number(selectedOrder.service_cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-right">
                    <span className="text-[10px] text-slate-400 block font-medium">Tempo Gasto</span>
                    <span className="text-sm font-bold text-blue-400 font-mono">
                      {selectedOrder.time_spent_minutes
                        ? (selectedOrder.time_spent_minutes >= 60
                            ? `${Math.floor(selectedOrder.time_spent_minutes / 60)}h ${selectedOrder.time_spent_minutes % 60 > 0 ? (selectedOrder.time_spent_minutes % 60) + 'm' : ''}`
                            : `${selectedOrder.time_spent_minutes} min`)
                        : 'Não inf.'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(selectedOrder)}
                  className="px-3 py-1.5 rounded-xl bg-[#172744] hover:bg-[#20365D] text-xs font-semibold text-slate-200 border border-[#24375A]"
                >
                  <Edit className="w-3.5 h-3.5 inline mr-1" /> Editar
                </button>
                <button
                  onClick={() => handleDelete(selectedOrder)}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-400 border border-rose-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Excluir
                </button>
              </div>
            </div>
          </div>

            {/* Descrição do Problema */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Motivo / Descrição do Problema
              </h3>
              <p className="text-sm text-slate-200 bg-[#0A1424] p-3.5 rounded-xl border border-[#182845] leading-relaxed">
                {selectedOrder.problem_description}
              </p>
            </div>

            {/* Informações Adicionais Gerais */}
            {selectedOrder.additional_info && (
              <div>
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>Informações Adicionais Gerais do Serviço</span>
                </h3>
                <p className="text-sm text-slate-200 bg-blue-950/20 p-3.5 rounded-xl border border-blue-500/20 leading-relaxed whitespace-pre-line">
                  {selectedOrder.additional_info}
                </p>
              </div>
            )}

            {/* Alterações Realizadas */}
            {selectedOrder.changes_made && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Alterações e Configurações Realizadas
                </h3>
                <p className="text-sm text-slate-200 bg-[#0A1424] p-3.5 rounded-xl border border-[#182845] leading-relaxed">
                  {selectedOrder.changes_made}
                </p>
              </div>
            )}

            {/* Testes e Resultados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Testes de Conectividade Executados
                </h3>
                <p className="text-xs text-slate-300 bg-[#0A1424] p-3 rounded-xl border border-[#182845] leading-relaxed">
                  {selectedOrder.tests_performed || 'Nenhum teste detalhado registrado.'}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Resultado dos Testes
                </h3>
                <p className="text-xs text-slate-300 bg-[#0A1424] p-3 rounded-xl border border-[#182845] leading-relaxed">
                  {selectedOrder.test_results || 'Nenhum resultado registrado.'}
                </p>
              </div>
            </div>

            {/* Observações Técnicas */}
            {selectedOrder.technical_notes && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Observações Técnicas Adicionais
                </h3>
                <p className="text-xs text-slate-300 bg-[#0A1424] p-3 rounded-xl border border-[#182845] leading-relaxed">
                  {selectedOrder.technical_notes}
                </p>
              </div>
            )}

            {/* SEÇÃO: ITENS RELACIONADOS */}
            <div className="pt-2 border-t border-[#1D3054]">
              <RelatedItems
                clientId={client.id}
                entityType="service_order"
                entityId={selectedOrder.id}
                onNavigate={onNavigateToTab}
              />
            </div>

            {/* SEÇÃO: FOTOS E EVIDÊNCIAS DO ATENDIMENTO */}
            <div className="pt-2 border-t border-[#1D3054] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Fotos e Evidências Técnicas ({orderAttachments.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Registre fotos dos equipamentos trocados, do rack, cabos ou busque imagens oficiais do modelo na web.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSearchModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>⚡ Buscar no Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="px-3 py-1.5 rounded-lg bg-[#172744] hover:bg-[#20365D] text-slate-200 border border-[#24375A] text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-400" />
                    <span>{isUploadingPhoto ? 'Enviando...' : '📁 Upload Foto Local'}</span>
                  </button>
                </div>
              </div>

              {/* Input escondido para upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadPhotoFile}
                className="hidden"
              />

              {loadingAttachments ? (
                <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Carregando fotos do atendimento...</span>
                </div>
              ) : orderAttachments.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
                  {orderAttachments.map(att => {
                    const imgUrl = att.file_path.startsWith('/') ? att.file_path : `/${att.file_path}`;
                    return (
                      <div
                        key={att.id}
                        className="group relative bg-[#0A1424] border border-[#182845] rounded-xl overflow-hidden shadow-md flex flex-col justify-between"
                      >
                        <div className="relative h-28 bg-gradient-to-b from-[#13233c]/90 via-[#0c1626] to-[#070d18] border-b border-[#182845] flex items-center justify-center p-2 overflow-hidden group/thumb">
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none"></div>
                          <img
                            src={imgUrl}
                            alt={att.original_name}
                            className="relative z-10 max-h-full max-w-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.65)] group-hover/thumb:scale-105 transition-transform duration-300 select-none"
                            onError={(e) => {
                              (e.target as HTMLElement).style.opacity = '0.3';
                            }}
                          />
                          <a
                            href={imgUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute top-1.5 right-1.5 z-20 p-1 rounded-md bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Abrir em tamanho real"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <div className="p-2 flex items-center justify-between gap-1 border-t border-[#182845] bg-[#0E1B31]">
                          <span className="text-[11px] text-slate-300 truncate font-medium">
                            {att.original_name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition shrink-0"
                            title="Remover foto"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-[#1E3150] text-center bg-[#0A1424]/40">
                  <p className="text-xs text-slate-400">
                    Nenhuma fotografia anexada a este atendimento ainda.
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Utilize os botões acima para buscar fotos dos modelos ou enviar imagens do local.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-[#101C31] border border-[#1D3054] rounded-2xl p-12 text-center text-slate-400 text-xs">
            Selecione um atendimento para visualizar os detalhes completos.
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      {showModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-emerald-400" />
              {editingId ? 'Editar Atendimento Técnico' : 'Registrar Novo Atendimento Técnico'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Tipo de Serviço *</label>
                  <input
                    type="text"
                    required
                    value={formData.service_type}
                    onChange={(e) => setFormData(p => ({ ...p, service_type: e.target.value }))}
                    placeholder="Ex: Troca de Roteador/ONT, Redirecionamento de Portas"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Técnico Responsável *</label>
                  <input
                    type="text"
                    required
                    value={formData.technician_name}
                    onChange={(e) => setFormData(p => ({ ...p, technician_name: e.target.value }))}
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Data e Hora *</label>
                  <input
                    type="text"
                    required
                    value={formData.date_time}
                    onChange={(e) => setFormData(p => ({ ...p, date_time: e.target.value }))}
                    placeholder="2026-11-02 22:30"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Status do Atendimento</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(p => ({ ...p, status: e.target.value }))}
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="concluido">Concluído</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="aguardando_retorno">Aguardando Retorno</option>
                    <option value="agendado">Agendado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                {/* Custo do Serviço e Tempo Gasto */}
                <div>
                  <label className="text-emerald-400 font-semibold block mb-1 flex items-center gap-1">
                    <span>Custo do Serviço (R$)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.service_cost}
                    onChange={(e) => setFormData(p => ({ ...p, service_cost: parseFloat(e.target.value) || 0 }))}
                    placeholder="Ex: 350.00"
                    className="w-full bg-[#132238] border border-emerald-500/30 focus:border-emerald-400 rounded-lg px-3 py-2 text-emerald-300 font-mono font-bold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Valor cobrado do cliente</span>
                </div>

                <div>
                  <label className="text-blue-400 font-semibold block mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Tempo Gasto (minutos)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={formData.time_spent_minutes}
                    onChange={(e) => setFormData(p => ({ ...p, time_spent_minutes: parseInt(e.target.value, 10) || 0 }))}
                    placeholder="Ex: 90 (1h 30m)"
                    className="w-full bg-[#132238] border border-blue-500/30 focus:border-blue-400 rounded-lg px-3 py-2 text-blue-300 font-mono font-bold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    {formData.time_spent_minutes >= 60
                      ? `${Math.floor(formData.time_spent_minutes / 60)}h ${formData.time_spent_minutes % 60 > 0 ? (formData.time_spent_minutes % 60) + 'm' : ''}`
                      : `${formData.time_spent_minutes} min`}
                  </span>
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    <span>Informações Adicionais Gerais do Serviço</span>
                  </label>
                  <textarea
                    rows={2}
                    value={formData.additional_info}
                    onChange={(e) => setFormData(p => ({ ...p, additional_info: e.target.value }))}
                    placeholder="Ex: Garantia da mão de obra por 90 dias, faturado via boleto bancário, peças fornecidas pelo cliente..."
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-xs"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Descrição do Problema / Solicitação *</label>
                  <textarea
                    rows={2}
                    required
                    value={formData.problem_description}
                    onChange={(e) => setFormData(p => ({ ...p, problem_description: e.target.value }))}
                    placeholder="Descreva a solicitação do condomínio ou a falha encontrada..."
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Alterações e Configurações Realizadas</label>
                  <textarea
                    rows={2}
                    value={formData.changes_made}
                    onChange={(e) => setFormData(p => ({ ...p, changes_made: e.target.value }))}
                    placeholder="Detalhes dos IPs fixados, reservas de MAC, portas criadas..."
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Testes Executados e Resultados</label>
                  <textarea
                    rows={2}
                    value={formData.test_results}
                    onChange={(e) => setFormData(p => ({ ...p, test_results: e.target.value }))}
                    placeholder="Quais acessos externos foram testados e se funcionaram..."
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1D3054]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
                >
                  Salvar Atendimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Busca Inteligente de Fotos na Web para Atendimento */}
      {selectedOrder && (
        <ImageSearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          initialQuery={selectedOrder.service_type || 'Equipamento de rede'}
          title={`Buscar Imagem para Atendimento: ${selectedOrder.service_type}`}
          clientId={client.id}
          serviceOrderId={selectedOrder.id}
          onSelectImage={handleSelectPhotoFromWeb}
        />
      )}
    </div>
  );
};
