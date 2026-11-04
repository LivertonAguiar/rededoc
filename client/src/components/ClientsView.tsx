import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Mail,
  Server,
  Share2,
  Edit,
  Trash2,
  FileText
} from 'lucide-react';
import { Client, Location } from '../types';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';

interface ClientsViewProps {
  clients: Client[];
  onRefresh: () => void;
  onSelectClient: (clientId: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  onRefresh,
  onSelectClient
}) => {
  const { showToast } = useDialog();
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedClientForLoc, setSelectedClientForLoc] = useState<string>('');

  // Fecha modais com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowClientModal(false);
        setShowLocationModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [clientForm, setClientForm] = useState({
    name: '',
    identification_name: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  const [locationForm, setLocationForm] = useState({
    name: '',
    address: '',
    contact_name: '',
    phone: '',
    access_notes: ''
  });

  const handleOpenNewClient = () => {
    setEditingClient(null);
    setClientForm({
      name: '',
      identification_name: '',
      document: '',
      phone: '',
      email: '',
      address: '',
      notes: ''
    });
    setShowClientModal(true);
  };

  const handleOpenEditClient = (c: Client) => {
    setEditingClient(c);
    setClientForm({
      name: c.name,
      identification_name: c.identification_name,
      document: c.document || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || ''
    });
    setShowClientModal(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await api.updateClient(editingClient.id, clientForm);
        showToast('Cliente atualizado com sucesso!', 'success');
      } else {
        await api.createClient(clientForm);
        showToast('Novo cliente cadastrado com sucesso!', 'success');
      }
      setShowClientModal(false);
      setEditingClient(null);
      setClientForm({ name: '', identification_name: '', document: '', phone: '', email: '', address: '', notes: '' });
      onRefresh();
    } catch (err: any) {
      showToast('Erro ao salvar cliente: ' + err.message, 'error');
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createLocation({
        ...locationForm,
        client_id: selectedClientForLoc
      });
      setShowLocationModal(false);
      setLocationForm({ name: '', address: '', contact_name: '', phone: '', access_notes: '' });
      showToast('Local cadastrado com sucesso!', 'success');
      onRefresh();
    } catch (err: any) {
      showToast('Erro ao cadastrar local: ' + err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-blue-400" />
            Clientes e Locais de Atendimento
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gerenciamento de condomínios, empresas e suas respectivas unidades físicas
          </p>
        </div>

        <button
          onClick={handleOpenNewClient}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Cliente</span>
        </button>
      </div>

      {/* Grade de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map(c => (
          <div
            key={c.id}
            className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-5 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#1D3054]">
                <div>
                  <h3 className="text-base font-bold text-white">{c.name}</h3>
                  <div className="text-xs text-slate-400">{c.identification_name}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEditClient(c)}
                    className="p-1.5 rounded-lg bg-[#172643] hover:bg-[#20365D] text-slate-300 hover:text-white border border-[#24375A] transition"
                    title="Editar dados cadastrais do cliente"
                  >
                    <Edit className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                  <div className="p-2 rounded-xl bg-[#172643] border border-[#24375A]">
                    <Building2 className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-2 py-3 text-xs text-slate-300">
                {c.address && (
                  <div className="flex items-start gap-2 bg-[#0C1525] p-2 rounded-lg border border-[#17253E] text-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span className="leading-tight">{c.address}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.phone}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.email}</span>
                  </div>
                )}
                {c.document && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>CNPJ/CPF: {c.document}</span>
                  </div>
                )}
              </div>

              {/* Locais Cadastrados */}
              <div className="pt-2 border-t border-[#1D3054]">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase text-slate-400 mb-2">
                  <span>Locais ({c.locations?.length || 0})</span>
                  <button
                    onClick={() => {
                      setSelectedClientForLoc(c.id);
                      setShowLocationModal(true);
                    }}
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3 h-3" /> Adicionar Local
                  </button>
                </div>

                <div className="space-y-1.5">
                  {c.locations?.map(loc => (
                    <div key={loc.id} className="p-2 rounded-lg bg-[#0A1424] border border-[#1A2C49] text-xs">
                      <div className="font-semibold text-slate-200">{loc.name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{loc.address}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1D3054] mt-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                <span className="flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 text-blue-400" /> {c.total_equipments || 0} equip.
                </span>
                <span className="flex items-center gap-1">
                  <Share2 className="w-3.5 h-3.5 text-amber-400" /> {c.total_ports || 0} portas
                </span>
              </div>

              <button
                onClick={() => onSelectClient(c.id)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
              >
                Abrir Painel
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Cadastro / Edição de Cliente */}
      {showClientModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowClientModal(false); }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              {editingClient ? 'Editar Cliente / Condomínio' : 'Novo Cliente / Condomínio'}
            </h2>

            <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Razão Social / Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={clientForm.name}
                  onChange={(e) => setClientForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Condomínio Residencial Aurora"
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nome de Identificação (Apelido) *</label>
                <input
                  type="text"
                  required
                  value={clientForm.identification_name}
                  onChange={(e) => setClientForm(p => ({ ...p, identification_name: e.target.value }))}
                  placeholder="Ex: Condomínio Aurora"
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Endereço do Cliente / Condomínio */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  <span>Endereço Completo do Condomínio / Cliente</span>
                </label>
                <input
                  type="text"
                  value={clientForm.address}
                  onChange={(e) => setClientForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Ex: Rua das Flores, 120, Bairro Aldeota, Fortaleza - CE"
                  className="w-full bg-[#132238] border border-[#24375A] focus:border-blue-500 rounded-lg px-3 py-2 text-white focus:outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">CNPJ / CPF</label>
                  <input
                    type="text"
                    value={clientForm.document}
                    onChange={(e) => setClientForm(p => ({ ...p, document: e.target.value }))}
                    placeholder="12.345.678/0001-90"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Telefone / Portaria</label>
                  <input
                    type="text"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="(85) 3456-7890"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">E-mail de Contato</label>
                <input
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="portaria@condominioaurora.com.br"
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1D3054]">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
                >
                  {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Local */}
      {showLocationModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowLocationModal(false); }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              Adicionar Local / Unidade
            </h2>

            <form onSubmit={handleCreateLocation} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nome do Local *</label>
                <input
                  type="text"
                  required
                  value={locationForm.name}
                  onChange={(e) => setLocationForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Guarita Principal, Bloco A, Rack de TI"
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Endereço Completo *</label>
                <input
                  type="text"
                  required
                  value={locationForm.address}
                  onChange={(e) => setLocationForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Ex: Rua das Flores, 120, Fortaleza, CE"
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Responsável Local</label>
                  <input
                    type="text"
                    value={locationForm.contact_name}
                    onChange={(e) => setLocationForm(p => ({ ...p, contact_name: e.target.value }))}
                    placeholder="Ex: Síndico / Zelador"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Telefone do Local</label>
                  <input
                    type="text"
                    value={locationForm.phone}
                    onChange={(e) => setLocationForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="(85) 98765-4321"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1D3054]">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
                >
                  Salvar Local
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
