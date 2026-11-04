import React, { useState } from 'react';
import {
  Server,
  Plus,
  Router,
  ScanFace,
  DoorOpen,
  Camera,
  Trash2,
  Edit,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Lock,
  Layers,
  Search,
  CheckCircle2,
  Sparkles,
  Info,
  Tag
} from 'lucide-react';
import { Equipment, Client, Location } from '../types';
import { api } from '../services/api';
import { AddEquipmentModal } from './AddEquipmentModal';
import { EquipmentLabelModal } from './EquipmentLabelModal';
import { useDialog } from '../context/DialogContext';

interface EquipmentsViewProps {
  client: Client;
  equipments: Equipment[];
  onRefresh: () => void;
  onOpenVault: () => void;
}

export const EquipmentsView: React.FC<EquipmentsViewProps> = ({
  client,
  equipments,
  onRefresh,
  onOpenVault
}) => {
  const { showToast, confirm } = useDialog();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingEq, setEditingEq] = useState<Equipment | null>(null);
  const [selectedEquipmentForLabel, setSelectedEquipmentForLabel] = useState<Equipment | null>(null);

  const handleOpenNew = () => {
    setEditingEq(null);
    setShowModal(true);
  };

  const handleOpenEdit = (eq: Equipment) => {
    setEditingEq(eq);
    setShowModal(true);
  };

  const handleDelete = (eq: Equipment) => {
    confirm({
      title: 'Excluir Equipamento',
      message: `Deseja realmente excluir o equipamento "${eq.name}" e todas as suas configurações de rede?`,
      confirmText: 'Excluir Equipamento',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteEquipment(eq.id);
          showToast('Equipamento excluído com sucesso!', 'success');
          onRefresh();
        } catch (err: any) {
          showToast('Erro ao excluir equipamento: ' + err.message, 'error');
        }
      }
    });
  };

  const filteredEquipments = equipments.filter(eq => {
    const matchesCat = filterCategory === 'all' || eq.category === filterCategory;
    const matchesSearch = !searchTerm ||
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (eq.model && eq.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (eq.local_ip && eq.local_ip.includes(searchTerm)) ||
      (eq.mac_address && eq.mac_address.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Server className="w-6 h-6 text-blue-400" />
            Inventário de Equipamentos de Rede
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Cadastro técnico completo de ONTs, roteadores, switches, DVRs, terminais faciais e módulos de portão
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>+ Adicionar do Catálogo</span>
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {['all', 'router_ont', 'facial_recognition', 'gate_module', 'dvr_nvr'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#101C31] text-slate-300 border border-[#1D3054] hover:bg-[#182845]'
              }`}
            >
              {cat === 'all' ? `Todos (${equipments.length})` : cat.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por nome, IP, MAC..."
            className="w-full bg-[#101C31] text-xs text-slate-100 placeholder-slate-400 pl-9 pr-3 py-1.5 rounded-lg border border-[#1D3054] focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Grade de Equipamentos */}
      {filteredEquipments.length === 0 ? (
        <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-10 text-center select-none">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Server className="w-7 h-7 text-blue-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">Nenhum equipamento encontrado</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
            {equipments.length === 0
              ? 'Este cliente ainda não possui equipamentos documentados. Adicione aparelhos manualmente ou selecione modelos prontos do catálogo.'
              : 'Nenhum equipamento corresponde aos filtros de busca selecionados.'}
          </p>
          <button
            onClick={handleOpenNew}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/25 transition inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Cadastrar Equipamento</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEquipments.map(eq => (
          <div
            key={eq.id}
            className="bg-[#101C31] border border-[#1D3054] hover:border-[#2A4374] rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all"
          >
            <div>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#1D3054]">
                <div>
                  <h3 className="text-base font-bold text-white">{eq.name}</h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {eq.category.replace('_', ' ').toUpperCase()} • {eq.physical_location || 'Local não especificado'}
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-[#172643] border border-[#24375A]">
                  <Server className="w-4 h-4 text-blue-400" />
                </div>
              </div>

              {/* Vitrine Estúdio do Equipamento (sem corte e sem achatar) */}
              {eq.photo_url ? (
                <div className="relative my-3 w-full h-32 rounded-xl bg-gradient-to-b from-[#13233c]/90 via-[#0c1626] to-[#070d18] border border-[#1e3559] flex items-center justify-center p-3 shadow-inner group/photo overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none"></div>
                  <img
                    src={eq.photo_url}
                    alt={eq.name}
                    className="relative z-10 max-h-full max-w-full object-contain filter drop-shadow-[0_6px_14px_rgba(0,0,0,0.65)] transition-transform duration-300 group-hover/photo:scale-105 select-none"
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 text-xs py-3 border-b border-[#1D3054]/60">
                <div>
                  <span className="text-slate-400 block text-[11px]">Fabricante / Modelo</span>
                  <span className="font-semibold text-slate-200 truncate block">
                    {eq.manufacturer} {eq.model || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">IP Local</span>
                  <span className="font-mono font-bold text-emerald-400 block">{eq.local_ip || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">MAC Address</span>
                  <span className="font-mono text-slate-300 text-[11px] block">{eq.mac_address || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Reserva MAC</span>
                  <span className="font-semibold text-slate-200 block">
                    {eq.is_mac_reserved ? 'Sim (Estático)' : 'Não (DHCP)'}
                  </span>
                </div>
                {eq.public_wan_ip && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px]">IP WAN</span>
                    <span className="font-mono font-bold text-blue-400 block">{eq.public_wan_ip}</span>
                  </div>
                )}
                {eq.config_path && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[11px]">Caminho de Configuração</span>
                    <span className="font-mono text-slate-300 text-[11px] block truncate">{eq.config_path}</span>
                  </div>
                )}
              </div>

              {eq.notes && (
                <div className="py-2.5 text-xs text-slate-400 leading-snug">
                  {eq.notes}
                </div>
              )}

              {/* Informações Adicionais */}
              {eq.additional_info && (
                <div className="py-1 px-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 mt-1 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{eq.additional_info}</span>
                </div>
              )}

              {/* Notas Internas (Confidencial) */}
              {eq.internal_notes && (
                <div className="py-1 px-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 mt-1 flex items-start gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2"><strong>Interno:</strong> {eq.internal_notes}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#1D3054] flex items-center justify-between text-xs">
              <div className="text-slate-400 text-[11px]">
                Usuário: <span className="text-slate-200 font-semibold">{eq.admin_username || 'admin'}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedEquipmentForLabel(eq)}
                  className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"
                  title="Imprimir Etiqueta com QR Code"
                >
                  <Tag className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleOpenEdit(eq)}
                  className="p-1.5 rounded-lg bg-[#182845] hover:bg-[#20365D] text-slate-300 hover:text-white"
                  title="Editar"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(eq)}
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                  title="Excluir"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Modal de Criação / Edição Integrado ao Catálogo */}
      <AddEquipmentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingEq(null);
        }}
        clientId={client.id}
        locationId={client.locations?.[0]?.id || ''}
        locations={client.locations || []}
        onSuccess={() => {
          onRefresh();
        }}
        equipmentToEdit={editingEq}
      />

      {/* Modal de Impressão de Etiqueta com QR Code */}
      <EquipmentLabelModal
        isOpen={!!selectedEquipmentForLabel}
        onClose={() => setSelectedEquipmentForLabel(null)}
        equipment={selectedEquipmentForLabel}
        client={client}
      />
    </div>
  );
};
