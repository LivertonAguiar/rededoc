import React, { useState, useEffect } from 'react';
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Clock,
  Server,
  Mail,
  Lock,
  Layers,
  Search,
  X,
  Radio
} from 'lucide-react';
import { Domain, Client } from '../types';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { RelatedItems } from './RelatedItems';

interface DomainsViewProps {
  client?: Client | null;
  clients?: Client[];
  targetDomainId?: string;
  onNavigateToTab?: (tab: string, entityId?: string) => void;
}

export const DomainsView: React.FC<DomainsViewProps> = ({
  client,
  clients = [],
  targetDomainId,
  onNavigateToTab
}) => {
  const { showToast, confirm } = useDialog();

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [checkingDomainId, setCheckingDomainId] = useState<string | null>(null);

  // Expansão de detalhes de DNS
  const [expandedDnsId, setExpandedDnsId] = useState<string | null>(targetDomainId || null);
  const [expandedLinksId, setExpandedLinksId] = useState<string | null>(null);

  // Modal de Criação / Edição
  const [showModal, setShowModal] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [domainName, setDomainName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [registrar, setRegistrar] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [autoCheck, setAutoCheck] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDomains = async () => {
    try {
      setLoading(true);
      const data = await api.getDomains(client?.id);
      setDomains(data);

      if (targetDomainId) {
        setExpandedDnsId(targetDomainId);
      }
    } catch (err: any) {
      showToast('Erro ao carregar domínios e certificados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDomains();
  }, [client?.id]);

  const handleOpenCreate = () => {
    setEditingDomain(null);
    setDomainName('');
    setSelectedClientId(client?.id || (clients[0]?.id || ''));
    setRegistrar('');
    setExpiresAt('');
    setNotes('');
    setAutoCheck(true);
    setShowModal(true);
  };

  const handleOpenEdit = (d: Domain) => {
    setEditingDomain(d);
    setDomainName(d.name);
    setSelectedClientId(d.client_id);
    setRegistrar(d.registrar || '');
    setExpiresAt(d.expires_at || '');
    setNotes(d.notes || '');
    setAutoCheck(Boolean(d.auto_check));
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domainName.trim()) {
      showToast('O nome do domínio é obrigatório.', 'error');
      return;
    }
    if (!selectedClientId) {
      showToast('Selecione um cliente para vincular o domínio.', 'error');
      return;
    }

    try {
      setSaving(true);
      if (editingDomain) {
        await api.updateDomain(editingDomain.id, {
          name: domainName.trim(),
          client_id: selectedClientId,
          registrar: registrar.trim() || null,
          expires_at: expiresAt || null,
          notes: notes.trim() || null,
          auto_check: autoCheck ? 1 : 0
        });
        showToast('Domínio atualizado com sucesso!', 'success');
      } else {
        await api.createDomain({
          name: domainName.trim(),
          client_id: selectedClientId,
          registrar: registrar.trim() || null,
          expires_at: expiresAt || null,
          notes: notes.trim() || null,
          auto_check: autoCheck ? 1 : 0
        });
        showToast('Domínio cadastrado e verificado!', 'success');
      }
      setShowModal(false);
      await loadDomains();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar domínio.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckNow = async (d: Domain) => {
    try {
      setCheckingDomainId(d.id);
      await api.checkDomain(d.id);
      showToast(`Verificação de SSL e DNS concluída para ${d.name}!`, 'success');
      await loadDomains();
    } catch (err: any) {
      showToast('Erro ao verificar domínio: ' + err.message, 'error');
    } finally {
      setCheckingDomainId(null);
    }
  };

  const handleDelete = (d: Domain) => {
    confirm({
      title: 'Excluir Monitoramento de Domínio',
      message: `Tem certeza que deseja remover o domínio "${d.name}"? As verificações automáticas de SSL e DNS serão interrompidas.`,
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteDomain(d.id);
          showToast('Domínio removido com sucesso.', 'info');
          await loadDomains();
        } catch (err: any) {
          showToast('Erro ao remover domínio.', 'error');
        }
      }
    });
  };

  const filteredDomains = domains.filter(d => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.registrar || '').toLowerCase().includes(q) ||
      (d.client_name || '').toLowerCase().includes(q)
    );
  });

  const getScoreBadge = (score: number) => {
    if (score >= 80) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          Score {score}/100 • Excelente
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          Score {score}/100 • Atenção
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
        Score {score}/100 • Crítico
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#1D3054]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/5">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Domínios, Certificados SSL e DNS
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Fase 7
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Auditoria de segurança TLS/SSL, integridade de apontamentos A/MX/SPF/DMARC e alerta de desvio DDNS.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Domínio / DDNS</span>
          </button>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar domínio, registrador ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0b1528] border border-[#1b2b48] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition"
          />
        </div>

        <button
          onClick={loadDomains}
          className="p-2 rounded-xl bg-[#0b1528] border border-[#1b2b48] text-slate-400 hover:text-white transition"
          title="Recarregar"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Lista de Domínios */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">
          Carregando informações de domínios e certificados SSL...
        </div>
      ) : filteredDomains.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0b1528] border border-[#1b2b48] text-center space-y-3">
          <Globe className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-200">Nenhum domínio cadastrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Cadastre os domínios próprios ou nomes DDNS dos clientes para monitorar vencimentos de SSL e integridade DNS.
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Domínio</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDomains.map(d => {
            const isExpandedDns = expandedDnsId === d.id;
            const isExpandedLinks = expandedLinksId === d.id;
            const isChecking = checkingDomainId === d.id;
            const snapshot = d.dns_snapshot;

            return (
              <div
                key={d.id}
                className="rounded-2xl bg-[#0b1528] border border-[#1b2b48] shadow-xl overflow-hidden transition-all"
              >
                {/* Linha Principal do Domínio */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#18263f]">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>{d.name}</span>
                        <a
                          href={`https://${d.name}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-cyan-400 transition"
                          title="Abrir no navegador"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </h3>

                      {getScoreBadge(d.score || 0)}

                      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
                        {d.client_name || 'Cliente'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      {d.registrar && (
                        <span>Registrador: <strong className="text-slate-300">{d.registrar}</strong></span>
                      )}
                      {d.expires_at && (
                        <span>Expiração Domínio: <strong className="text-slate-300">{d.expires_at}</strong></span>
                      )}
                      <span>Última checagem: <strong className="text-slate-300">{d.last_checked_at ? d.last_checked_at.slice(0, 16).replace('T', ' ') : 'Pendente'}</strong></span>
                    </div>
                  </div>

                  {/* Ações e Botões */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleCheckNow(d)}
                      disabled={isChecking}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                      title="Verificar SSL, DNS e RDAP agora"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                      <span>{isChecking ? 'Verificando...' : 'Verificar Agora'}</span>
                    </button>

                    <button
                      onClick={() => setExpandedDnsId(isExpandedDns ? null : d.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>Registros DNS</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpandedDns ? 'rotate-180' : ''}`} />
                    </button>

                    <button
                      onClick={() => setExpandedLinksId(isExpandedLinks ? null : d.id)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                      title="Vínculos e Itens Relacionados"
                    >
                      <Server className="w-3.5 h-3.5 text-amber-400" />
                    </button>

                    <button
                      onClick={() => handleOpenEdit(d)}
                      className="p-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition cursor-pointer"
                      title="Editar Domínio"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(d)}
                      className="p-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                      title="Excluir Domínio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Selos Rápidos de SSL e Segurança */}
                <div className="px-5 py-3 bg-[#081120] border-b border-[#18263f] flex flex-wrap items-center gap-3 text-xs">
                  {/* Status SSL */}
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-400">SSL:</span>
                    {d.ssl_expires_at ? (
                      <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Válido até {d.ssl_expires_at} ({d.ssl_issuer || 'TLS'})</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-rose-400" />
                        <span>Sem SSL / Inacessível</span>
                      </span>
                    )}
                  </div>

                  {/* Status SPF / DMARC */}
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${
                      snapshot?.spf
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      <Mail className="w-3 h-3" />
                      <span>{snapshot?.spf ? 'SPF Ativo' : 'Sem SPF'}</span>
                    </span>

                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 ${
                      snapshot?.dmarc
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      <ShieldCheck className="w-3 h-3" />
                      <span>{snapshot?.dmarc ? 'DMARC Ativo' : 'Sem DMARC'}</span>
                    </span>
                  </div>

                  {/* Alerta de Desvio DDNS se aplicável */}
                  {snapshot?.ddns_status?.mismatch && (
                    <div className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 flex items-center gap-1.5 font-semibold text-[11px] ml-auto">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Desvio DDNS: Resolve para {snapshot.ddns_status.resolved_ip}, mas IP WAN é {snapshot.ddns_status.expected_wan_ip}!</span>
                    </div>
                  )}
                </div>

                {/* Acordeão de Registros DNS Detalhados */}
                {isExpandedDns && (
                  <div className="p-5 bg-[#060b14] space-y-4 border-b border-[#18263f]">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      <span>Instantâneo de Registros DNS</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      {/* Registros A */}
                      <div className="p-3 rounded-xl bg-[#0a1222] border border-[#1b2b48] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-cyan-400">Registros A (IPv4)</span>
                        <div className="font-mono text-slate-200 space-y-0.5">
                          {snapshot?.a_records && snapshot.a_records.length > 0 ? (
                            snapshot.a_records.map((ip, idx) => (
                              <div key={idx}>{ip}</div>
                            ))
                          ) : (
                            <span className="text-slate-500">Nenhum registro A encontrado</span>
                          )}
                        </div>
                      </div>

                      {/* Registros MX */}
                      <div className="p-3 rounded-xl bg-[#0a1222] border border-[#1b2b48] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-amber-400">Servidores MX (E-mail)</span>
                        <div className="font-mono text-slate-200 space-y-0.5">
                          {snapshot?.mx_records && snapshot.mx_records.length > 0 ? (
                            snapshot.mx_records.map((mx, idx) => (
                              <div key={idx} className="truncate">
                                prio {mx.priority}: {mx.exchange}
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-500">Nenhum MX configurado</span>
                          )}
                        </div>
                      </div>

                      {/* Servidores NS */}
                      <div className="p-3 rounded-xl bg-[#0a1222] border border-[#1b2b48] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-indigo-400">Nameservers (NS)</span>
                        <div className="font-mono text-slate-200 space-y-0.5">
                          {snapshot?.ns_records && snapshot.ns_records.length > 0 ? (
                            snapshot.ns_records.map((ns, idx) => (
                              <div key={idx} className="truncate">{ns}</div>
                            ))
                          ) : (
                            <span className="text-slate-500">Nenhum NS encontrado</span>
                          )}
                        </div>
                      </div>

                      {/* SPF */}
                      <div className="md:col-span-2 lg:col-span-3 p-3 rounded-xl bg-[#0a1222] border border-[#1b2b48] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-blue-400">Registro TXT (SPF)</span>
                        <div className="font-mono text-slate-200 break-all">
                          {snapshot?.spf || <span className="text-slate-500">Sem registro SPF cadastrado</span>}
                        </div>
                      </div>

                      {/* DMARC */}
                      <div className="md:col-span-2 lg:col-span-3 p-3 rounded-xl bg-[#0a1222] border border-[#1b2b48] space-y-1">
                        <span className="text-[10px] uppercase font-bold text-emerald-400">Registro DMARC</span>
                        <div className="font-mono text-slate-200 break-all">
                          {snapshot?.dmarc || <span className="text-slate-500">Sem política DMARC cadastrada</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Vínculos com Equipamentos (RelatedItems Fase 1) */}
                {isExpandedLinks && (
                  <div className="p-5 bg-[#060b14] border-t border-[#18263f]">
                    <RelatedItems
                      clientId={d.client_id}
                      entityType="domain"
                      entityId={d.id}
                      onNavigate={onNavigateToTab}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CADASTRO / EDIÇÃO DE DOMÍNIO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form onSubmit={handleSave} className="bg-[#0b1528] border border-[#1b2b48] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#18263f]">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  {editingDomain ? 'Editar Domínio / DDNS' : 'Cadastrar Novo Domínio ou Host DDNS'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Nome do Domínio ou Host DDNS *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: condomínioaurora.com.br ou auroracftv.ddns.net"
                  value={domainName}
                  onChange={(e) => setDomainName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#070d1a] border border-[#18263f] text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Cliente Vinculado *
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#070d1a] border border-[#18263f] text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  {client && !clients.some(c => c.id === client.id) && (
                    <option value={client.id}>{client.name}</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Registrador (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Registro.br, GoDaddy"
                    value={registrar}
                    onChange={(e) => setRegistrar(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#070d1a] border border-[#18263f] text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Expiração do Domínio
                  </label>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#070d1a] border border-[#18263f] text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Observações Técnicas
                </label>
                <textarea
                  rows={2}
                  placeholder="Finalidade do host, portas associadas, credencial do painel DNS..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#070d1a] border border-[#18263f] text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={autoCheck}
                  onChange={(e) => setAutoCheck(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
                />
                <span className="text-xs text-slate-300 font-medium">
                  Verificar automaticamente na rotina diária às 08:00
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#18263f]">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{saving ? 'Gravando e Verificando...' : editingDomain ? 'Salvar Alterações' : 'Cadastrar e Checar Agora'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

