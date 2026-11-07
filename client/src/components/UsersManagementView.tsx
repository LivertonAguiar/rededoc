import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Shield,
  KeyRound,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  Building2,
  UserCheck,
  Lock,
  Mail,
  X,
  RefreshCw
} from 'lucide-react';
import { SystemUser, Client, UserRole } from '../types';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';

interface UsersManagementViewProps {
  clients?: Client[];
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({ clients = [] }) => {
  const { showToast, confirm } = useDialog();

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'tecnico' as UserRole,
    client_id: '',
    is_active: 1
  });

  // Modal de Redefinição de Senha
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar lista de usuários.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'tecnico',
      client_id: clients.length > 0 ? clients[0].id : '',
      is_active: 1
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: SystemUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      client_id: user.client_id || (clients.length > 0 ? clients[0].id : ''),
      is_active: user.is_active ?? 1
    });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim()) {
      showToast('Nome e e-mail são obrigatórios.', 'warning');
      return;
    }

    if (formData.role === 'cliente' && !formData.client_id) {
      showToast('Usuários com papel de cliente devem estar vinculados a um condomínio.', 'warning');
      return;
    }

    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          client_id: formData.role === 'cliente' ? formData.client_id : null,
          is_active: formData.is_active
        });
        showToast('Usuário atualizado com sucesso!', 'success');
      } else {
        if (!formData.password || formData.password.length < 6) {
          showToast('A senha inicial deve conter ao menos 6 caracteres.', 'warning');
          return;
        }
        await api.createUser({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          client_id: formData.role === 'cliente' ? formData.client_id : null,
          is_active: formData.is_active
        });
        showToast('Usuário cadastrado com sucesso!', 'success');
      }

      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      showToast(err.message || 'Falha ao salvar usuário.', 'error');
    }
  };

  const handleOpenResetPassword = (user: SystemUser) => {
    setTargetUser(user);
    setNewPassword('');
    setIsResetOpen(true);
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;

    if (!newPassword || newPassword.length < 6) {
      showToast('A nova senha deve ter ao menos 6 caracteres.', 'warning');
      return;
    }

    try {
      await api.resetUserPassword(targetUser.id, newPassword);
      showToast(`Senha de ${targetUser.name} redefinida com sucesso!`, 'success');
      setIsResetOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Erro ao redefinir senha.', 'error');
    }
  };

  const handleDeleteUser = (user: SystemUser) => {
    confirm({
      title: 'Excluir Usuário',
      message: `Deseja realmente remover o usuário "${user.name}" (${user.email})? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteUser(user.id);
          showToast('Usuário excluído com sucesso.', 'info');
          loadUsers();
        } catch (err: any) {
          showToast(err.message || 'Erro ao excluir usuário.', 'error');
        }
      }
    });
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = u.name.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchClient = u.client_name?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchClient) return false;
    }
    return true;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Shield className="w-3 h-3 text-purple-400" /> Administrador
          </span>
        );
      case 'tecnico':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <UserCheck className="w-3 h-3 text-blue-400" /> Técnico
          </span>
        );
      case 'cliente':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Building2 className="w-3 h-3 text-emerald-400" /> Cliente / Síndico
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            Gestão de Usuários & Controle de Acesso
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Administração de contas de técnicos, administradores e síndicos com acesso ao portal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadUsers}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Atualizar lista"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Usuário</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou condomínio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#101C31] border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center bg-[#101C31] border border-slate-700/80 rounded-xl p-1 text-xs">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              roleFilter === 'all' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({users.length})
          </button>
          <button
            onClick={() => setRoleFilter('admin')}
            className={`px-3 py-1.5 rounded-lg transition ${
              roleFilter === 'admin' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Admins
          </button>
          <button
            onClick={() => setRoleFilter('tecnico')}
            className={`px-3 py-1.5 rounded-lg transition ${
              roleFilter === 'tecnico' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Técnicos
          </button>
          <button
            onClick={() => setRoleFilter('cliente')}
            className={`px-3 py-1.5 rounded-lg transition ${
              roleFilter === 'cliente' ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Clientes
          </button>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-[#101C31] border border-[#1E3054] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B1528] text-slate-400 uppercase text-[10px] tracking-wider border-b border-[#1E3054]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Usuário</th>
                <th className="py-3.5 px-4 font-semibold">Papel / Perfil</th>
                <th className="py-3.5 px-4 font-semibold">Condomínio Vinculado</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Carregando usuários...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white text-sm">{u.name}</div>
                      <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>{u.email}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {getRoleBadge(u.role)}
                    </td>

                    <td className="py-3.5 px-4">
                      {u.role === 'cliente' ? (
                        u.client_name ? (
                          <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            {u.client_name}
                          </span>
                        ) : (
                          <span className="text-rose-400 italic">Sem condomínio associado</span>
                        )
                      ) : (
                        <span className="text-slate-500">Acesso Global (Todos)</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          <XCircle className="w-3 h-3" /> Inativo
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenResetPassword(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition"
                          title="Redefinir Senha"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                          title="Editar Usuário"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Excluir Usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Criação / Edição de Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0F172A] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dra. Márcia (Síndica)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">E-mail de Acesso *</label>
                <input
                  type="email"
                  required
                  placeholder="exemplo@condominio.com.br"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Senha Inicial * (mínimo 6 caracteres)</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Perfil / Papel no Sistema *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="tecnico">Técnico de Campo (Acesso Interno Completo)</option>
                  <option value="admin">Administrador Geral (Backup, Usuários, Configurações)</option>
                  <option value="cliente">Cliente / Síndico (Apenas Portal do Condomínio)</option>
                </select>
              </div>

              {formData.role === 'cliente' && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Condomínio Vinculado *</label>
                  <select
                    required
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Selecione um condomínio...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.identification_name ? `(${c.identification_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="user_active_toggle"
                  checked={formData.is_active === 1}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 rounded bg-[#0B132B] border-slate-700 text-emerald-600 focus:ring-0"
                />
                <label htmlFor="user_active_toggle" className="text-slate-300 font-medium cursor-pointer">
                  Conta Ativa (pode realizar login)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow transition"
                >
                  {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Redefinição de Senha */}
      {isResetOpen && targetUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0F172A] border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                Redefinir Senha
              </h3>
              <button onClick={() => setIsResetOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Definir nova senha de acesso para <strong>{targetUser.name}</strong> ({targetUser.email}).
            </p>

            <form onSubmit={handleConfirmResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nova Senha * (mínimo 6 caracteres)</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsResetOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow transition"
                >
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

