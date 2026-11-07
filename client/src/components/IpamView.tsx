import React, { useState, useEffect } from 'react';
import {
  Network,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Server,
  Layers,
  Copy,
  Check,
  Trash2,
  Edit,
  ExternalLink,
  Search,
  Sparkles,
  ShieldAlert,
  Info,
  X
} from 'lucide-react';
import { Client, Subnet, SubnetUsageReport, SubnetIpSlot, SubnetSuggestion, ClientIpConflictsReport } from '../types';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { RelatedItems } from './RelatedItems';

interface IpamViewProps {
  client?: Client | null;
  clients?: Client[];
  targetSubnetId?: string;
  onNavigateToTab?: (tab: string, entityId?: string) => void;
}

export const IpamView: React.FC<IpamViewProps> = ({
  client,
  clients = [],
  targetSubnetId,
  onNavigateToTab
}) => {
  const { showToast, confirm } = useDialog();

  const [subnets, setSubnets] = useState<Subnet[]>([]);
  const [selectedSubnetId, setSelectedSubnetId] = useState<string>(targetSubnetId || '');
  const [usageReport, setUsageReport] = useState<SubnetUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  // Sugestões automáticas
  const [suggestions, setSuggestions] = useState<SubnetSuggestion[]>([]);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

  // Modal de criação / edição de sub-rede
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<Subnet | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    cidr: '',
    gateway: '',
    vlan: '1',
    dhcp_start: '',
    dhcp_end: '',
    notes: '',
    client_id: client?.id || ''
  });

  // Filtro na grade de IPs
  const [slotFilter, setSlotFilter] = useState<'all' | 'used' | 'free' | 'dhcp' | 'conflict'>('all');
  const [ipSearch, setIpSearch] = useState('');

  // Conflitos gerais do condomínio
  const [conflictsReport, setConflictsReport] = useState<ClientIpConflictsReport | null>(null);

  const loadSubnets = async () => {
    try {
      setLoading(true);
      const data = await api.getSubnets(client?.id);
      setSubnets(data);

      if (data.length > 0) {
        const target = targetSubnetId && data.some(s => s.id === targetSubnetId)
          ? targetSubnetId
          : data[0].id;
        setSelectedSubnetId(target);
      } else {
        setSelectedSubnetId('');
        setUsageReport(null);
      }

      if (client?.id) {
        api.detectSubnetConflicts(client.id)
          .then(setConflictsReport)
          .catch(() => {});
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar sub-redes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubnets();
  }, [client?.id]);

  useEffect(() => {
    if (selectedSubnetId) {
      loadUsage(selectedSubnetId);
    } else {
      setUsageReport(null);
    }
  }, [selectedSubnetId]);

  const loadUsage = async (subnetId: string) => {
    try {
      setLoadingUsage(true);
      const report = await api.getSubnetUsage(subnetId);
      setUsageReport(report);
    } catch (err: any) {
      showToast(err.message || 'Falha ao carregar ocupação da sub-rede.', 'error');
      setUsageReport(null);
    } finally {
      setLoadingUsage(false);
    }
  };

  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    showToast(`IP ${ip} copiado para a área de transferência!`, 'success');
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const handleOpenSuggestions = async () => {
    if (!client?.id) {
      showToast('Selecione um condomínio para analisar equipamentos.', 'warning');
      return;
    }
    try {
      const list = await api.suggestSubnets(client.id);
      setSuggestions(list);
      setShowSuggestionsModal(true);
    } catch (err: any) {
      showToast(err.message || 'Erro ao gerar sugestões de sub-rede.', 'error');
    }
  };

  const handleApplySuggestion = (sug: SubnetSuggestion) => {
    setEditingSubnet(null);
    setFormData({
      name: sug.name,
      cidr: sug.cidr,
      gateway: sug.gateway,
      vlan: sug.vlan || '1',
      dhcp_start: sug.dhcp_start || '',
      dhcp_end: sug.dhcp_end || '',
      notes: 'Criada a partir dos dados dos equipamentos existentes.',
      client_id: client?.id || ''
    });
    setShowSuggestionsModal(false);
    setIsModalOpen(true);
  };

  const handleSaveSubnet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.cidr.trim()) {
      showToast('Nome e notação CIDR são obrigatórios.', 'warning');
      return;
    }

    try {
      if (editingSubnet) {
        await api.updateSubnet(editingSubnet.id, formData);
        showToast('Sub-rede atualizada com sucesso!', 'success');
      } else {
        const created = await api.createSubnet(formData);
        showToast('Sub-rede cadastrada com sucesso!', 'success');
        setSelectedSubnetId(created.id);
      }
      setIsModalOpen(false);
      loadSubnets();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar sub-rede.', 'error');
    }
  };

  const handleDeleteSubnet = (subnetId: string, name: string) => {
    confirm({
      title: 'Excluir Sub-rede',
      message: `Deseja realmente remover a sub-rede "${name}" do IPAM? Os equipamentos não serão apagados.`,
      confirmText: 'Excluir',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteSubnet(subnetId);
          showToast('Sub-rede excluída com sucesso.', 'info');
          loadSubnets();
        } catch (err: any) {
          showToast(err.message || 'Falha ao excluir sub-rede.', 'error');
        }
      }
    });
  };

  // Filtragem dos slots na grade
  const filteredSlots = usageReport?.slots.filter(s => {
    if (slotFilter === 'used' && s.status !== 'used' && s.status !== 'gateway') return false;
    if (slotFilter === 'free' && s.status !== 'free') return false;
    if (slotFilter === 'dhcp' && s.status !== 'dhcp') return false;
    if (slotFilter === 'conflict' && s.status !== 'conflict' && s.status !== 'dhcp_conflict') return false;
    if (ipSearch.trim()) {
      const q = ipSearch.toLowerCase().trim();
      const matchIp = s.ip.includes(q);
      const matchEq = s.equipment?.name.toLowerCase().includes(q) || s.equipment?.model?.toLowerCase().includes(q);
      if (!matchIp && !matchEq) return false;
    }
    return true;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Network className="w-6 h-6 text-blue-400" />
            IPAM — Gerenciamento de Sub-redes & IPs
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Mapeamento de hosts utilizáveis, faixas DHCP, prevenção de conflitos e sugestão do próximo IP livre.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {client?.id && (
            <button
              onClick={handleOpenSuggestions}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold transition"
              title="Detectar sub-redes a partir dos equipamentos cadastrados"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Sugerir Sub-redes</span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingSubnet(null);
              setFormData({
                name: '',
                cidr: '192.168.1.0/24',
                gateway: '192.168.1.1',
                vlan: '1',
                dhcp_start: '192.168.1.100',
                dhcp_end: '192.168.1.200',
                notes: '',
                client_id: client?.id || ''
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Sub-rede</span>
          </button>
        </div>
      </div>

      {/* Alerta de Conflitos no Condomínio (se houver) */}
      {conflictsReport?.hasIssues && (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
            <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>Atenção: Conflitos de endereçamento IP detectados no condomínio</span>
          </div>

          {conflictsReport.duplicates.length > 0 && (
            <div className="text-xs text-rose-200">
              <strong className="text-rose-100">IPs Duplicados: </strong>
              {conflictsReport.duplicates.map(d => `${d.ip} (${d.equipments.map(e => e.name).join(', ')})`).join(' • ')}
            </div>
          )}

          {conflictsReport.dhcpWithoutReservation.length > 0 && (
            <div className="text-xs text-amber-200">
              <strong className="text-amber-100">Dentro da faixa DHCP sem reserva de MAC: </strong>
              {conflictsReport.dhcpWithoutReservation.map(d => `${d.equipment.name} (${d.equipment.local_ip})`).join(' • ')}
            </div>
          )}
        </div>
      )}

      {/* Navegação entre Sub-redes */}
      {subnets.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {subnets.map(sub => {
            const isSelected = sub.id === selectedSubnetId;
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubnetId(sub.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-2 ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                    : 'bg-[#101C31] text-slate-300 border-[#1E3054] hover:bg-[#182844]'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>{sub.name}</span>
                <span className="font-mono text-[11px] opacity-80">({sub.cidr})</span>
              </button>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="bg-[#101C31] border border-slate-800 rounded-2xl p-10 text-center text-slate-400 text-sm space-y-3">
            <Network className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="font-semibold text-slate-300">Nenhuma sub-rede cadastrada neste condomínio.</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Cadastre a faixa de IP utilizada na infraestrutura ou utilize a detecção automática para importar as faixas de roteadores e ONTs.
            </p>
            {client?.id && (
              <button
                onClick={handleOpenSuggestions}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition"
              >
                <Sparkles className="w-4 h-4" />
                Detectar Sub-redes dos Equipamentos
              </button>
            )}
          </div>
        )
      )}

      {/* Detalhes da Sub-rede Selecionada */}
      {usageReport && (
        <div className="space-y-6">
          {/* Card Resumo da Sub-rede */}
          <div className="bg-[#101C31] border border-[#1E3054] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{usageReport.subnet.name}</h2>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 font-semibold">
                    {usageReport.subnet.cidr}
                  </span>
                  {usageReport.subnet.vlan && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      VLAN {usageReport.subnet.vlan}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                  <span>Gateway: <strong className="font-mono text-slate-300">{usageReport.subnet.gateway || 'N/A'}</strong></span>
                  <span>•</span>
                  <span>DHCP: <strong className="font-mono text-slate-300">{usageReport.subnet.dhcp_start || 'N/A'} ➔ {usageReport.subnet.dhcp_end || 'N/A'}</strong></span>
                  <span>•</span>
                  <span>Máscara: <strong className="font-mono text-slate-300">{usageReport.cidrInfo.netmask}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingSubnet(usageReport.subnet);
                    setFormData({
                      name: usageReport.subnet.name,
                      cidr: usageReport.subnet.cidr,
                      gateway: usageReport.subnet.gateway || '',
                      vlan: usageReport.subnet.vlan || '1',
                      dhcp_start: usageReport.subnet.dhcp_start || '',
                      dhcp_end: usageReport.subnet.dhcp_end || '',
                      notes: usageReport.subnet.notes || '',
                      client_id: usageReport.subnet.client_id
                    });
                    setIsModalOpen(true);
                  }}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Editar sub-rede"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteSubnet(usageReport.subnet.id, usageReport.subnet.name)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition"
                  title="Excluir sub-rede"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Métricas e Barra de Ocupação */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0C1525] p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total de Hosts</div>
                <div className="text-xl font-bold text-white mt-0.5">{usageReport.stats.totalHosts}</div>
                <div className="text-[10px] text-slate-400">utilizáveis</div>
              </div>

              <div className="bg-[#0C1525] p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">IPs Ocupados</div>
                <div className="text-xl font-bold text-blue-400 mt-0.5">{usageReport.stats.usedHosts}</div>
                <div className="text-[10px] text-slate-400">{usageReport.stats.usagePercentage}% da rede</div>
              </div>

              <div className="bg-[#0C1525] p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Faixa DHCP</div>
                <div className="text-xl font-bold text-amber-400 mt-0.5">{usageReport.stats.dhcpHosts}</div>
                <div className="text-[10px] text-slate-400">dinâmicos</div>
              </div>

              <div className="bg-[#0C1525] p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Próximo IP Livre</div>
                <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5 truncate flex items-center gap-1.5">
                  <span>{usageReport.nextFreeIp || 'Esgotado'}</span>
                  {usageReport.nextFreeIp && (
                    <button
                      onClick={() => handleCopyIp(usageReport.nextFreeIp!)}
                      className="p-1 hover:text-white transition"
                      title="Copiar IP livre"
                    >
                      {copiedIp === usageReport.nextFreeIp ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">fora da faixa DHCP</div>
              </div>
            </div>

            {/* Barra Visual de Ocupação */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Ocupação da Sub-rede</span>
                <span className="font-semibold text-slate-200">
                  {usageReport.stats.usedHosts} de {usageReport.stats.totalHosts} IPs utilizados ({usageReport.stats.usagePercentage}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${Math.min(usageReport.stats.usagePercentage, 100)}%` }}
                  className="bg-blue-500 h-full transition-all"
                />
              </div>
            </div>
          </div>

          {/* Grade Visual de Endereços IP */}
          <div className="bg-[#101C31] border border-[#1E3054] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-white text-base">Mapa de Endereços IP</h3>
                <span className="text-xs text-slate-400">
                  {filteredSlots.length} endereços exibidos
                </span>
              </div>

              {/* Filtros e Busca de IP */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar IP ou dispositivo..."
                    value={ipSearch}
                    onChange={(e) => setIpSearch(e.target.value)}
                    className="bg-[#0C1525] border border-slate-700/80 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center bg-[#0C1525] border border-slate-700/80 rounded-lg p-0.5 text-xs">
                  <button
                    onClick={() => setSlotFilter('all')}
                    className={`px-2 py-1 rounded-md transition ${slotFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setSlotFilter('used')}
                    className={`px-2 py-1 rounded-md transition ${slotFilter === 'used' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Ocupados
                  </button>
                  <button
                    onClick={() => setSlotFilter('free')}
                    className={`px-2 py-1 rounded-md transition ${slotFilter === 'free' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Livres
                  </button>
                  <button
                    onClick={() => setSlotFilter('dhcp')}
                    className={`px-2 py-1 rounded-md transition ${slotFilter === 'dhcp' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    DHCP
                  </button>
                  <button
                    onClick={() => setSlotFilter('conflict')}
                    className={`px-2 py-1 rounded-md transition ${slotFilter === 'conflict' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Conflitos
                  </button>
                </div>
              </div>
            </div>

            {/* Legenda de Cores */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1 pb-2 border-b border-slate-800/60">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Livre
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Ocupado (Fixo)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Gateway
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Faixa DHCP
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Conflito (Duplicado)
              </span>
            </div>

            {/* Grade de Slots de IP */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-[500px] overflow-y-auto p-1">
              {filteredSlots.map((slot) => {
                let bgClass = 'bg-[#0B1424] border-slate-800 text-slate-400 hover:border-slate-600';
                if (slot.status === 'free') {
                  bgClass = 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300 hover:border-emerald-500';
                } else if (slot.status === 'used') {
                  bgClass = 'bg-blue-950/30 border-blue-800/50 text-blue-200 hover:border-blue-400';
                } else if (slot.status === 'gateway') {
                  bgClass = 'bg-purple-950/40 border-purple-800/60 text-purple-200 hover:border-purple-400';
                } else if (slot.status === 'dhcp') {
                  bgClass = 'bg-amber-950/20 border-amber-900/40 text-amber-300 hover:border-amber-500';
                } else if (slot.status === 'conflict') {
                  bgClass = 'bg-rose-950/40 border-rose-700 text-rose-200 animate-pulse';
                } else if (slot.status === 'dhcp_conflict') {
                  bgClass = 'bg-amber-950/40 border-rose-600/60 text-amber-200';
                }

                return (
                  <div
                    key={slot.ip}
                    onClick={() => {
                      if (slot.equipment && onNavigateToTab) {
                        onNavigateToTab('equipments', slot.equipment.id);
                      }
                    }}
                    className={`p-2 rounded-xl border text-xs transition flex flex-col justify-between cursor-pointer group ${bgClass}`}
                    title={
                      slot.equipment
                        ? `${slot.ip} • ${slot.equipment.name} (${slot.equipment.model || 'Dispositivo'})`
                        : slot.ip
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[11px] truncate">{slot.ip.split('.').slice(2).join('.')}</span>
                      {slot.status === 'free' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyIp(slot.ip);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition p-0.5 hover:text-white"
                          title="Copiar IP livre"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="mt-1 truncate">
                      {slot.status === 'gateway' ? (
                        <span className="text-[10px] uppercase font-semibold text-purple-400">Gateway</span>
                      ) : slot.status === 'conflict' ? (
                        <span className="text-[10px] uppercase font-bold text-rose-400">Conflito!</span>
                      ) : slot.status === 'dhcp_conflict' ? (
                        <span className="text-[10px] text-amber-300 truncate block font-medium">
                          {slot.equipment?.name} <span className="text-rose-400">(sem reserva)</span>
                        </span>
                      ) : slot.equipment ? (
                        <span className="text-[10px] text-blue-300 truncate block font-medium">
                          {slot.equipment.name}
                        </span>
                      ) : slot.status === 'dhcp' ? (
                        <span className="text-[10px] text-amber-400/80">DHCP Livre</span>
                      ) : (
                        <span className="text-[10px] text-emerald-400/70">Livre</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vínculos / Itens Relacionados à Sub-rede (Fase 1) */}
          <div className="bg-[#101C31] border border-[#1E3054] rounded-2xl p-4 sm:p-5 shadow-xl">
            <h3 className="font-bold text-white text-base mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Itens Vinculados a esta Sub-rede
            </h3>
            <RelatedItems
              clientId={usageReport.subnet.client_id}
              entityType="subnet"
              entityId={usageReport.subnet.id}
              onNavigate={(tab: string, entityId: string) => {
                if (onNavigateToTab) {
                  onNavigateToTab(tab, entityId);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Modal de Nova / Editar Sub-rede */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0F172A] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Network className="w-5 h-5 text-blue-400" />
                {editingSubnet ? 'Editar Sub-rede' : 'Nova Sub-rede IPAM'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubnet} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome da Sub-rede *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: LAN Principal (Guarita / CFTV)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">CIDR *</label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.0/24"
                    value={formData.cidr}
                    onChange={(e) => setFormData({ ...formData, cidr: e.target.value })}
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Gateway</label>
                  <input
                    type="text"
                    placeholder="192.168.1.1"
                    value={formData.gateway}
                    onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">VLAN</label>
                  <input
                    type="text"
                    placeholder="1"
                    value={formData.vlan}
                    onChange={(e) => setFormData({ ...formData, vlan: e.target.value })}
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">DHCP Inicial</label>
                  <input
                    type="text"
                    placeholder="192.168.1.100"
                    value={formData.dhcp_start}
                    onChange={(e) => setFormData({ ...formData, dhcp_start: e.target.value })}
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">DHCP Final</label>
                  <input
                    type="text"
                    placeholder="192.168.1.200"
                    value={formData.dhcp_end}
                    onChange={(e) => setFormData({ ...formData, dhcp_end: e.target.value })}
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Observações Técnicas</label>
                <textarea
                  rows={2}
                  placeholder="Finalidade da rede, rotas ou informações do roteador..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition"
                >
                  {editingSubnet ? 'Salvar Alterações' : 'Cadastrar Sub-rede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Sugestões de Sub-redes */}
      {showSuggestionsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0F172A] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Sub-redes Sugeridas a partir dos Equipamentos
              </h3>
              <button onClick={() => setShowSuggestionsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              O sistema analisou os endereços IP e gateways dos equipamentos deste condomínio e detectou as seguintes faixas:
            </p>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#0B132B] border border-slate-800 hover:border-purple-500/50 transition flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-200">{sug.name}</div>
                    <div className="font-mono text-purple-400 font-semibold mt-0.5">{sug.cidr}</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Gateway: {sug.gateway} • {sug.matchedEquipmentsCount} equipamentos alocados
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplySuggestion(sug)}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition shrink-0"
                  >
                    Adicionar Sub-rede
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

