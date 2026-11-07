import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Check,
  ShieldCheck,
  History,
  Trash2,
  Edit,
  ExternalLink,
  Lock,
  X,
  Server,
  Link2
} from 'lucide-react';
import { Credential, CredentialAuditLog, Equipment, Client } from '../types';
import { api } from '../services/api';
import { RelatedItems } from './RelatedItems';
import { useDialog } from '../context/DialogContext';

interface CredentialsVaultViewProps {
  client: Client;
  equipments: Equipment[];
  onRefresh: () => void;
  targetCredentialId?: string;
  onNavigateToTab?: (tab: string, entityId?: string) => void;
}

export const CredentialsVaultView: React.FC<CredentialsVaultViewProps> = ({
  client,
  equipments,
  onRefresh,
  targetCredentialId,
  onNavigateToTab
}) => {
  const { showToast, confirm } = useDialog();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedLinksCredId, setExpandedLinksCredId] = useState<string | null>(targetCredentialId || null);

  useEffect(() => {
    if (targetCredentialId) {
      setExpandedLinksCredId(targetCredentialId);
      setTimeout(() => {
        const el = document.getElementById(`cred-card-${targetCredentialId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [targetCredentialId]);

  // Modal de Auditoria
  const [auditLogs, setAuditLogs] = useState<CredentialAuditLog[] | null>(null);
  const [auditCredName, setAuditCredName] = useState('');

  // Modal de Criação / Edição
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fecha modais com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAuditLogs(null);
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [formData, setFormData] = useState({
    name: '',
    equipment_id: '',
    category: 'equipamento',
    username: '',
    password: '',
    access_url: '',
    port: '',
    notes: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCredentials = async () => {
    setLoading(true);
    try {
      const data = await api.getCredentials(client.id);
      setCredentials(data);
    } catch (err) {
      console.error('Erro ao carregar credenciais:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCredentials();
  }, [client.id]);

  const handleReveal = async (cred: Credential) => {
    if (revealed[cred.id]) {
      setRevealed(prev => {
        const next = { ...prev };
        delete next[cred.id];
        return next;
      });
      return;
    }

    try {
      const res = await api.revealCredential(cred.id);
      setRevealed(prev => ({ ...prev, [cred.id]: res.password }));
    } catch (err: any) {
      showToast('Erro ao revelar: ' + err.message, 'error');
    }
  };

  const handleCopy = async (cred: Credential) => {
    try {
      let pass = revealed[cred.id];
      if (!pass) {
        const res = await api.revealCredential(cred.id);
        pass = res.password;
        setRevealed(prev => ({ ...prev, [cred.id]: pass }));
      }
      await navigator.clipboard.writeText(pass);
      setCopiedId(cred.id);
      showToast('Senha copiada com sucesso!', 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err: any) {
      showToast('Erro ao copiar senha: ' + err.message, 'error');
    }
  };

  const handleOpenAudit = async (cred: Credential) => {
    setAuditCredName(cred.name);
    try {
      const logs = await api.getCredentialAudit(cred.id);
      setAuditLogs(logs);
    } catch (err: any) {
      showToast('Erro ao carregar auditoria: ' + err.message, 'error');
    }
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setFormData({
      name: '',
      equipment_id: equipments[0]?.id || '',
      category: 'equipamento',
      username: 'admin',
      password: '',
      access_url: equipments[0]?.access_url || 'http://',
      port: equipments[0]?.management_port ? String(equipments[0].management_port) : '80',
      notes: ''
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (cred: Credential) => {
    setEditingId(cred.id);
    setFormData({
      name: cred.name,
      equipment_id: cred.equipment_id || '',
      category: cred.category,
      username: cred.username,
      password: '', // em branco se não for alterar
      access_url: cred.access_url || '',
      port: cred.port ? String(cred.port) : '',
      notes: cred.notes || ''
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
        port: formData.port ? Number(formData.port) : null
      };

      if (editingId) {
        await api.updateCredential(editingId, payload);
      } else {
        if (!formData.password) {
          throw new Error('A senha é obrigatória para nova credencial.');
        }
        await api.createCredential(payload);
      }

      setShowModal(false);
      loadCredentials();
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar credencial');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (cred: Credential) => {
    confirm({
      title: 'Remover Credencial',
      message: `Tem certeza que deseja remover a credencial "${cred.name}" do cofre seguro?`,
      confirmText: 'Remover do Cofre',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteCredential(cred.id);
          showToast('Credencial removida com sucesso!', 'success');
          loadCredentials();
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
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Criptografia Autenticada AES-256-GCM Ativa</span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-blue-400" />
            Cofre de Credenciais de TI
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Armazenamento seguro de senhas técnicas com mascaramento e trilha de auditoria completa
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Credencial</span>
        </button>
      </div>

      {/* Lista do Cofre */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {credentials.map(cred => {
          const isRevealed = !!revealed[cred.id];
          const isCopied = copiedId === cred.id;

          return (
            <div
              key={cred.id}
              id={`cred-card-${cred.id}`}
              className={`bg-[#101C31] border rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all ${
                expandedLinksCredId === cred.id ? 'border-blue-500/60 ring-1 ring-blue-500/20' : 'border-[#1D3054] hover:border-[#2D4A7D]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#1D3054]">
                  <div>
                    <h3 className="text-base font-bold text-white">{cred.name}</h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {cred.category.toUpperCase()} • {cred.equipment_name || 'Geral'}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#172643] border border-[#24375A]">
                    <Lock className="w-4 h-4 text-amber-400" />
                  </div>
                </div>

                <div className="space-y-2.5 py-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Usuário de Acesso</span>
                    <span className="font-mono font-bold text-slate-100">{cred.username}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block">Senha Criptografada</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-[#091122] border border-[#1A2C49] rounded-lg px-3 py-1.5 font-mono font-bold text-sm">
                        {isRevealed ? (
                          <span className="text-emerald-400 select-all">{revealed[cred.id]}</span>
                        ) : (
                          <span className="text-slate-400 tracking-widest">••••••••</span>
                        )}
                      </div>

                      <button
                        onClick={() => handleReveal(cred)}
                        className="p-2 rounded-lg bg-[#172744] hover:bg-[#20365D] text-slate-300 hover:text-white border border-[#24375A]"
                        title={isRevealed ? 'Ocultar' : 'Revelar (registra na auditoria)'}
                      >
                        {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => handleCopy(cred)}
                        className={`p-2 rounded-lg border transition-all ${
                          isCopied
                            ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                            : 'bg-[#172744] hover:bg-[#20365D] text-slate-300 hover:text-white border-[#24375A]'
                        }`}
                        title="Copiar senha"
                      >
                        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {cred.access_url && (
                    <div>
                      <span className="text-slate-400 text-[11px] block">URL / IP de Acesso</span>
                      <a
                        href={cred.access_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5 truncate"
                      >
                        <span className="truncate">{cred.access_url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  )}

                  {cred.notes && (
                    <div className="pt-1 text-slate-400 text-[11px] leading-relaxed">
                      {cred.notes}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#1D3054] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenAudit(cred)}
                    className="flex items-center gap-1 text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Auditoria</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedLinksCredId(prev => prev === cred.id ? null : cred.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition ${
                      expandedLinksCredId === cred.id
                        ? 'bg-blue-600/30 text-blue-300 border-blue-500/40'
                        : 'bg-[#182845] hover:bg-[#20365D] text-slate-400 border-transparent hover:text-white'
                    }`}
                    title="Ver itens relacionados"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Vínculos</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenEdit(cred)}
                    className="p-1.5 rounded-lg bg-[#182845] hover:bg-[#20365D] text-slate-300 hover:text-white"
                    title="Editar"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cred)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                    title="Remover do cofre"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {expandedLinksCredId === cred.id && (
                <div className="mt-4 pt-3 border-t border-[#1D3054]">
                  <RelatedItems
                    clientId={client.id}
                    entityType="credential"
                    entityId={cred.id}
                    onNavigate={onNavigateToTab}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de Auditoria de Acessos */}
      {auditLogs && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setAuditLogs(null); }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054]">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                Auditoria de Acesso: {auditCredName}
              </h2>
              <button onClick={() => setAuditLogs(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {auditLogs.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Nenhum registro de revelação encontrado ainda.
                </div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-[#0B132B] border border-[#1D3054] text-xs flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">
                        {log.user_name} <span className="text-[10px] uppercase font-bold text-blue-400">({log.action})</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        IP: {log.ip_address || '127.0.0.1'}
                      </div>
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="text-right pt-2 border-t border-[#1D3054]">
              <button
                onClick={() => setAuditLogs(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-[#172744] hover:bg-[#20365D]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição */}
      {showModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-400" />
              {editingId ? 'Editar Credencial no Cofre' : 'Cadastrar Nova Credencial Segura'}
            </h2>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Nome da Credencial *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: Admin ONT Huawei, Módulo Guarita Nice, DVR Master"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Equipamento Vinculado</label>
                  <select
                    value={formData.equipment_id}
                    onChange={(e) => setFormData(p => ({ ...p, equipment_id: e.target.value }))}
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Nenhum (Credencial geral)</option>
                    {equipments.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} ({eq.model || eq.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Usuário *</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData(p => ({ ...p, username: e.target.value }))}
                    placeholder="Ex: admin, telecomadmin, root"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    {editingId ? 'Nova Senha (deixe vazio p/ manter)' : 'Senha *'}
                  </label>
                  <input
                    type="password"
                    required={!editingId}
                    value={formData.password}
                    onChange={(e) => setFormData(p => ({ ...p, password: e.target.value }))}
                    placeholder={editingId ? '••••••••' : 'Senha do equipamento'}
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">URL / IP de Acesso</label>
                  <input
                    type="text"
                    value={formData.access_url}
                    onChange={(e) => setFormData(p => ({ ...p, access_url: e.target.value }))}
                    placeholder="Ex: http://192.168.1.1"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Porta de Acesso</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData(p => ({ ...p, port: e.target.value }))}
                    placeholder="Ex: 80, 8080"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Observações de Acesso</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Instruções de login, restrições ou procedimentos de recuperação..."
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
                  {isSubmitting ? 'Criptografando...' : editingId ? 'Atualizar' : 'Salvar no Cofre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
