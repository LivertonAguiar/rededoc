import React, { useState, useEffect } from 'react';
import {
  Share2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
  Edit,
  ArrowRight,
  ShieldAlert,
  Server,
  Globe
} from 'lucide-react';
import { PortForward, Equipment, Client } from '../types';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';

interface PortForwardsViewProps {
  client: Client;
  equipments: Equipment[];
  portForwards: PortForward[];
  onRefresh: () => void;
}

export const PortForwardsView: React.FC<PortForwardsViewProps> = ({
  client,
  equipments,
  portForwards,
  onRefresh
}) => {
  const { showToast, confirm } = useDialog();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PortForward | null>(null);

  // Fecha modais com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    equipment_id: '',
    service_name: '',
    source_wan_ip: '203.0.113.45',
    external_port: '',
    destination_local_ip: '',
    internal_port: '',
    protocol: 'TCP' as 'TCP' | 'UDP' | 'TCP/UDP',
    router_config_path: 'Avançado > NAT > Redirecionamento de portas',
    status: 'nao_testada' as 'funcionando' | 'nao_testada' | 'com_falha',
    notes: ''
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-preenche o IP local ao escolher o equipamento
  const handleEquipmentChange = (eqId: string) => {
    const eq = equipments.find(e => e.id === eqId);
    setFormData(prev => ({
      ...prev,
      equipment_id: eqId,
      destination_local_ip: eq?.local_ip || prev.destination_local_ip
    }));
  };

  const handleOpenNew = () => {
    setEditingRule(null);
    setFormData({
      equipment_id: equipments[0]?.id || '',
      service_name: '',
      source_wan_ip: equipments.find(e => e.category === 'router_ont')?.public_wan_ip || '203.0.113.45',
      external_port: '',
      destination_local_ip: equipments[0]?.local_ip || '192.168.1.',
      internal_port: '80',
      protocol: 'TCP',
      router_config_path: 'Avançado > NAT > Redirecionamento de portas',
      status: 'nao_testada',
      notes: ''
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (rule: PortForward) => {
    setEditingRule(rule);
    setFormData({
      equipment_id: rule.equipment_id,
      service_name: rule.service_name,
      source_wan_ip: rule.source_wan_ip,
      external_port: String(rule.external_port),
      destination_local_ip: rule.destination_local_ip,
      internal_port: String(rule.internal_port),
      protocol: rule.protocol,
      router_config_path: rule.router_config_path || '',
      status: rule.status,
      notes: rule.notes || ''
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        client_id: client.id,
        location_id: equipments.find(eq => eq.id === formData.equipment_id)?.location_id || client.locations?.[0]?.id || '',
        external_port: Number(formData.external_port),
        internal_port: Number(formData.internal_port)
      };

      if (editingRule) {
        await api.updatePortForward(editingRule.id, payload);
      } else {
        await api.createPortForward(payload);
      }

      setShowModal(false);
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar regra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    confirm({
      title: 'Remover Regra de Encaminhamento',
      message: `Deseja realmente remover a regra "${name}"?`,
      confirmText: 'Remover Regra',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deletePortForward(id);
          showToast('Regra de porta removida com sucesso!', 'success');
          onRefresh();
        } catch (err: any) {
          showToast('Erro ao excluir: ' + err.message, 'error');
        }
      }
    });
  };

  const handleUpdateStatus = async (id: string, status: 'funcionando' | 'nao_testada' | 'com_falha') => {
    try {
      await api.updatePortStatus(id, status);
      showToast('Status da porta atualizado!', 'info');
      onRefresh();
    } catch (err: any) {
      showToast('Erro ao alterar status: ' + err.message, 'error');
    }
  };

  const filteredRules = portForwards.filter(rule => {
    if (filterStatus === 'all') return true;
    return rule.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Share2 className="w-6 h-6 text-amber-400" />
            Redirecionamento de Portas (NAT)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Mapeamento de conexões externas para dispositivos locais com validação de conflito
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Regra de Porta</span>
        </button>
      </div>

      {/* Filtros de Status */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterStatus === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-[#101C31] text-slate-300 border border-[#1D3054] hover:bg-[#182845]'
          }`}
        >
          Todas ({portForwards.length})
        </button>
        <button
          onClick={() => setFilterStatus('funcionando')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterStatus === 'funcionando'
              ? 'bg-emerald-600 text-white'
              : 'bg-[#101C31] text-slate-300 border border-[#1D3054] hover:bg-[#182845]'
          }`}
        >
          Funcionando ({portForwards.filter(p => p.status === 'funcionando').length})
        </button>
        <button
          onClick={() => setFilterStatus('nao_testada')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterStatus === 'nao_testada'
              ? 'bg-amber-600 text-white'
              : 'bg-[#101C31] text-slate-300 border border-[#1D3054] hover:bg-[#182845]'
          }`}
        >
          Não Testadas ({portForwards.filter(p => p.status === 'nao_testada').length})
        </button>
        <button
          onClick={() => setFilterStatus('com_falha')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filterStatus === 'com_falha'
              ? 'bg-rose-600 text-white'
              : 'bg-[#101C31] text-slate-300 border border-[#1D3054] hover:bg-[#182845]'
          }`}
        >
          Com Falha ({portForwards.filter(p => p.status === 'com_falha').length})
        </button>
      </div>

      {/* Tabela de Regras */}
      <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0D172A] border-b border-[#1D3054] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Serviço</th>
                <th className="py-3.5 px-4">Equipamento Destino</th>
                <th className="py-3.5 px-4">Caminho da Conexão (WAN → LAN)</th>
                <th className="py-3.5 px-4">Protocolo</th>
                <th className="py-3.5 px-4">Status do Teste</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D3054]/60">
              {filteredRules.map(rule => (
                <tr key={rule.id} className="hover:bg-[#14233D] transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-white text-sm">{rule.service_name}</div>
                    {rule.notes && <div className="text-[11px] text-slate-400 truncate max-w-xs">{rule.notes}</div>}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-200">{rule.equipment_name}</div>
                    <div className="text-[11px] text-slate-400">{rule.equipment_model || 'Dispositivo'}</div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="px-2 py-1 rounded bg-[#0A1424] border border-amber-500/40 text-amber-300 font-bold">
                        {rule.source_wan_ip}:{rule.external_port}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="px-2 py-1 rounded bg-[#0A1424] border border-blue-500/40 text-emerald-400 font-bold">
                        {rule.destination_local_ip}:{rule.internal_port}
                      </span>
                    </div>
                    {rule.router_config_path && (
                      <div className="text-[10px] text-slate-400 font-mono mt-1">
                        Caminho: {rule.router_config_path}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 font-semibold text-[11px]">
                      {rule.protocol}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={rule.status}
                        onChange={(e) => handleUpdateStatus(rule.id, e.target.value as any)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                          rule.status === 'funcionando'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : rule.status === 'com_falha'
                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                            : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        }`}
                      >
                        <option value="funcionando" className="bg-[#0F1B2D] text-emerald-300">Funcionando</option>
                        <option value="nao_testada" className="bg-[#0F1B2D] text-amber-300">Não testada</option>
                        <option value="com_falha" className="bg-[#0F1B2D] text-rose-300">Com falha</option>
                      </select>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(rule)}
                        className="p-1.5 rounded-lg bg-[#182845] hover:bg-[#20365D] text-slate-300 hover:text-white"
                        title="Editar"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id, rule.service_name)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação / Edição */}
      {showModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-amber-400" />
              {editingRule ? 'Editar Regra de Redirecionamento' : 'Novo Redirecionamento de Porta (NAT)'}
            </h2>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Nome do Serviço *</label>
                  <input
                    type="text"
                    required
                    value={formData.service_name}
                    onChange={(e) => setFormData(p => ({ ...p, service_name: e.target.value }))}
                    placeholder="Ex: Facial web, CFTV RTSP, Acesso Web Roteador"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Equipamento de Destino *</label>
                  <select
                    required
                    value={formData.equipment_id}
                    onChange={(e) => handleEquipmentChange(e.target.value)}
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Selecione o equipamento</option>
                    {equipments.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} ({eq.model || eq.category}) — IP: {eq.local_ip || 'Sem IP'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">IP WAN de Origem *</label>
                  <input
                    type="text"
                    required
                    value={formData.source_wan_ip}
                    onChange={(e) => setFormData(p => ({ ...p, source_wan_ip: e.target.value }))}
                    placeholder="Ex: 203.0.113.45"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Porta Externa WAN *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="65535"
                    value={formData.external_port}
                    onChange={(e) => setFormData(p => ({ ...p, external_port: e.target.value }))}
                    placeholder="Ex: 8050"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">IP Interno Destino (LAN) *</label>
                  <input
                    type="text"
                    required
                    value={formData.destination_local_ip}
                    onChange={(e) => setFormData(p => ({ ...p, destination_local_ip: e.target.value }))}
                    placeholder="Ex: 192.168.1.50"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Porta Interna LAN *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="65535"
                    value={formData.internal_port}
                    onChange={(e) => setFormData(p => ({ ...p, internal_port: e.target.value }))}
                    placeholder="Ex: 80"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Protocolo</label>
                  <select
                    value={formData.protocol}
                    onChange={(e) => setFormData(p => ({ ...p, protocol: e.target.value as any }))}
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                    <option value="TCP/UDP">TCP / UDP</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Status de Teste</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(p => ({ ...p, status: e.target.value as any }))}
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="funcionando">Funcionando</option>
                    <option value="nao_testada">Não testada</option>
                    <option value="com_falha">Com falha</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Caminho de Configuração no Roteador</label>
                  <input
                    type="text"
                    value={formData.router_config_path}
                    onChange={(e) => setFormData(p => ({ ...p, router_config_path: e.target.value }))}
                    placeholder="Ex: Avançado > NAT > Redirecionamento de portas"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-slate-300 font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Observações Técnicas</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Detalhes adicionais sobre o serviço ou testes realizados..."
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
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
                >
                  {isSubmitting ? 'Salvando...' : editingRule ? 'Atualizar Regra' : 'Criar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
