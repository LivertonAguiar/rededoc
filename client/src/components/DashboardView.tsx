import React, { useState, useEffect } from 'react';
import {
  Globe,
  Router as RouterIcon,
  Server,
  Share2,
  Clock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileDown,
  Info,
  ExternalLink,
  Lock,
  Layers,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Camera,
  DoorOpen,
  ScanFace,
  Edit,
  Plus,
  Trash2,
  Upload,
  Settings2,
  X,
  Sparkles,
  MapPin,
  Calendar,
  Wrench,
  DollarSign,
  History,
  Play,
  Loader2
} from 'lucide-react';
import { Client, Location, Equipment, PortForward, Attachment, ServiceOrder } from '../types';
import { api } from '../services/api';
import { AddEquipmentModal } from './AddEquipmentModal';
import { useDialog } from '../context/DialogContext';
import { WanAlertBanner } from './dashboard/WanAlertBanner';
import { DashboardKpis } from './dashboard/DashboardKpis';
import { ConnectionSummaryCard } from './dashboard/ConnectionSummaryCard';
import { TechnicalNotesCard } from './dashboard/TechnicalNotesCard';
import { ServiceOrdersHistorySection } from './dashboard/ServiceOrdersHistorySection';

interface DashboardViewProps {
  client: Client;
  location?: Location;
  equipments: Equipment[];
  portForwards: PortForward[];
  attachments: Attachment[];
  onRefresh: () => void;
  onOpenReport: () => void;
  onOpenVault: () => void;
  onSelectEquipment: (eqId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  client,
  location,
  equipments,
  portForwards,
  attachments,
  onRefresh,
  onOpenReport,
  onOpenVault,
  onSelectEquipment
}) => {
  const { showToast, confirm, showAlert } = useDialog();
  const [viewMode, setViewMode] = useState<'detailed' | 'simplified'>('detailed');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [loadingReveal, setLoadingReveal] = useState<Record<string, boolean>>({});

  // Auditoria de alteração de IP WAN
  const [wanAudit, setWanAudit] = useState<{
    currentPublicIp: string | null;
    registeredIp: string | null;
    hasChanged: boolean;
    status: 'ok' | 'mismatch' | 'unregistered' | 'offline';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (client?.id) {
      api.checkWanStatus(client.id)
        .then(res => setWanAudit(res))
        .catch(() => {});
    }
  }, [client?.id]);

  // Modais de Edição no Dashboard
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);

  // Fecha modais com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNetworkModal(false);
        setShowNotesModal(false);
        setShowUploadModal(false);
        setShowEquipmentModal(false);
        setShowOrderModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Histórico de Atendimentos Fixado no Cliente
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [showOrderModal, setShowOrderModal] = useState<boolean>(false);
  const [editingOrder, setEditingOrder] = useState<ServiceOrder | null>(null);

  const [orderForm, setOrderForm] = useState({
    service_type: '',
    technician_name: 'Liverton Aguiar',
    date_time: '',
    status: 'concluido' as 'concluido' | 'em_andamento' | 'aguardando_retorno' | 'agendado' | 'cancelado',
    service_cost: 0,
    time_spent_minutes: 60,
    problem_description: '',
    additional_info: '',
    changes_made: '',
    technical_notes: ''
  });

  const loadClientOrders = async () => {
    if (!client?.id) return;
    setLoadingOrders(true);
    try {
      const orders = await api.getServiceOrders(client.id);
      setServiceOrders(orders);
    } catch (err) {
      console.error('Erro ao carregar histórico de atendimentos:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    loadClientOrders();
  }, [client.id]);

  // Métricas do Histórico de Atendimentos
  const totalServiceCost = serviceOrders.reduce((sum, o) => sum + (Number(o.service_cost) || 0), 0);
  const totalTimeSpentMinutes = serviceOrders.reduce((sum, o) => sum + (Number(o.time_spent_minutes) || 0), 0);
  const totalHours = Math.floor(totalTimeSpentMinutes / 60);
  const remainingMinutes = totalTimeSpentMinutes % 60;
  const formattedTotalTime = totalHours > 0 
    ? `${totalHours}h ${remainingMinutes > 0 ? remainingMinutes + 'm' : ''}`.trim()
    : `${remainingMinutes}m`;
  const completedOrdersCount = serviceOrders.filter(o => o.status === 'concluido').length;

  // Identifica o Roteador / ONT principal real (por categoria ou por IP WAN configurado)
  const routerOnt = equipments.find(e => 
    e.category === 'router_ont' || 
    e.category === 'router' || 
    e.category === 'ont' || 
    Boolean(e.public_wan_ip)
  ) || equipments.find(e => 
    e.name?.toLowerCase().includes('ont') || 
    e.name?.toLowerCase().includes('roteador')
  );
  const hasEquipments = equipments.length > 0;
  const wanIp = routerOnt?.public_wan_ip || null;

  // Métricas
  const totalEquipments = equipments.length;
  const activePorts = portForwards.filter(p => p.status === 'funcionando').length;
  const failedPorts = portForwards.filter(p => p.status === 'com_falha').length;
  const totalPorts = portForwards.length;

  // Estado do teste rápido de portas no Dashboard
  const [testingPortId, setTestingPortId] = useState<string | null>(null);

  const handleTestDashboardPort = async (p: PortForward) => {
    setTestingPortId(p.id);
    try {
      const res = await api.testPortForward(p.id);
      if (res.open) {
        showToast(`Porta WAN ${p.external_port} (${p.service_name}) aberta! (${res.latency_ms}ms)`, 'success');
      } else {
        showToast(`Porta WAN ${p.external_port} (${p.service_name}) falhou: ${res.message}`, 'error');
      }
      onRefresh();
    } catch (err: any) {
      showToast('Erro ao testar porta: ' + err.message, 'error');
    } finally {
      setTestingPortId(null);
    }
  };

  // Estado do formulário de Parâmetros de Rede
  const [networkForm, setNetworkForm] = useState({
    public_wan_ip: '',
    local_ip: '',
    subnet_mask: '',
    gateway: '',
    primary_dns: '',
    secondary_dns: '',
    dhcp_range: '',
    model: '',
    manufacturer: ''
  });

  // Estado do formulário de Observações Técnicas
  const [notesForm, setNotesForm] = useState({
    technical_notes: '',
    service_type: '',
    problem_description: ''
  });

  // Estado do formulário de Upload
  const [uploadCategory, setUploadCategory] = useState('config_print');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadEquipmentId, setUploadEquipmentId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // Estado do formulário de Equipamento
  const [eqFormData, setEqFormData] = useState({
    name: '',
    category: 'router_ont',
    manufacturer: '',
    model: '',
    serial_number: '',
    mac_address: '',
    physical_location: '',
    local_ip: '',
    gateway: '',
    is_mac_reserved: 0,
    public_wan_ip: '',
    access_url: '',
    admin_username: '',
    config_path: '',
    notes: ''
  });

  // Função para abrir modal de edição de parâmetros de rede
  const handleOpenNetworkModal = () => {
    setNetworkForm({
      public_wan_ip: routerOnt?.public_wan_ip || '',
      local_ip: routerOnt?.local_ip || '192.168.1.1',
      subnet_mask: routerOnt?.subnet_mask || '255.255.255.0',
      gateway: routerOnt?.gateway || '192.168.1.1',
      primary_dns: routerOnt?.primary_dns || '8.8.8.8',
      secondary_dns: routerOnt?.secondary_dns || '8.8.4.4',
      dhcp_range: routerOnt?.dhcp_range || '192.168.1.100 - 192.168.1.200',
      model: routerOnt?.model || 'Roteador / Gateway Principal',
      manufacturer: routerOnt?.manufacturer || 'Genérico'
    });
    setShowNetworkModal(true);
  };

  const handleSaveNetworkParams = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (routerOnt) {
        await api.updateEquipment(routerOnt.id, {
          ...routerOnt,
          public_wan_ip: networkForm.public_wan_ip,
          local_ip: networkForm.local_ip,
          subnet_mask: networkForm.subnet_mask,
          gateway: networkForm.gateway,
          primary_dns: networkForm.primary_dns,
          secondary_dns: networkForm.secondary_dns,
          dhcp_range: networkForm.dhcp_range,
          model: networkForm.model,
          manufacturer: networkForm.manufacturer
        });
      } else {
        // Garante que exista um local válido para associar o roteador
        let locId = location?.id || client.locations?.[0]?.id;
        if (!locId) {
          const locs = await api.getLocations(client.id);
          if (locs.length > 0) {
            locId = locs[0].id;
          } else {
            const newLoc = await api.createLocation({
              client_id: client.id,
              name: 'Sede Principal',
              address: client.address || 'Local Principal'
            });
            locId = newLoc.id;
          }
        }

        // Cria automaticamente o Roteador/ONT principal para o cliente
        await api.createEquipment({
          client_id: client.id,
          location_id: locId,
          name: 'Roteador / Gateway Principal',
          category: 'router_ont',
          manufacturer: networkForm.manufacturer || 'Genérico',
          model: networkForm.model || 'Roteador / Gateway Principal',
          public_wan_ip: networkForm.public_wan_ip,
          local_ip: networkForm.local_ip || '192.168.1.1',
          subnet_mask: networkForm.subnet_mask || '255.255.255.0',
          gateway: networkForm.gateway || '192.168.1.1',
          primary_dns: networkForm.primary_dns || '8.8.8.8',
          secondary_dns: networkForm.secondary_dns || '8.8.4.4',
          dhcp_range: networkForm.dhcp_range || '',
          is_mac_reserved: 0
        });
      }
      setShowNetworkModal(false);
      showToast('Parâmetros de rede salvos com sucesso!', 'success');
      onRefresh();
    } catch (err: any) {
      showToast('Erro ao atualizar parâmetros de rede: ' + err.message, 'error');
    }
  };

  // Função para abrir modal de edição de observações técnicas
  const handleOpenNotesModal = async () => {
    try {
      const orders = await api.getServiceOrders(client.id);
      const latest = orders[0];
      setNotesForm({
        technical_notes: latest?.technical_notes || 'Roteador/ONT trocada pela operadora em 02/11.\nFacial web: Cadastro feito pelo software da administradora.\nCFTV: Porta RTSP 8072 aguarda liberação de perfil.',
        service_type: latest?.service_type || 'Troca de Roteador/ONT e Mapeamento de Portas',
        problem_description: latest?.problem_description || 'Manutenção da infraestrutura de rede'
      });
      setShowNotesModal(true);
    } catch (err: any) {
      showToast('Erro ao carregar observações: ' + err.message, 'error');
    }
  };

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const orders = await api.getServiceOrders(client.id);
      if (orders.length > 0) {
        await api.updateServiceOrder(orders[0].id, {
          ...orders[0],
          technical_notes: notesForm.technical_notes,
          service_type: notesForm.service_type,
          problem_description: notesForm.problem_description
        });
      } else {
        await api.createServiceOrder({
          client_id: client.id,
          location_id: location?.id || client.locations?.[0]?.id || '',
          technician_name: 'Liverton Aguiar',
          date_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
          service_type: notesForm.service_type,
          problem_description: notesForm.problem_description,
          technical_notes: notesForm.technical_notes,
          status: 'concluido'
        });
      }
      setShowNotesModal(false);
      showToast('Observações técnicas atualizadas com sucesso!', 'success');
      onRefresh();
    } catch (err: any) {
      showToast('Erro ao salvar observações: ' + err.message, 'error');
    }
  };

  // Função para abrir modal de edição de equipamento
  const handleOpenEditEquipment = (eq: Equipment) => {
    setEditingEquipment(eq);
    setShowEquipmentModal(true);
  };

  const handleOpenAddEquipmentFromCatalog = () => {
    setEditingEquipment(null);
    setShowEquipmentModal(true);
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEquipment) return;
    try {
      await api.updateEquipment(editingEquipment.id, {
        ...editingEquipment,
        ...eqFormData,
        is_mac_reserved: eqFormData.is_mac_reserved ? 1 : 0
      });
      setShowEquipmentModal(false);
      showToast('Equipamento salvo com sucesso!', 'success');
      onRefresh();
    } catch (err: any) {
      showToast('Erro ao salvar equipamento: ' + err.message, 'error');
    }
  };

  // Funções para gerenciar o Histórico de Atendimentos
  const handleOpenNewOrder = () => {
    setEditingOrder(null);
    setOrderForm({
      service_type: 'Manutenção Preventiva / Corretiva',
      technician_name: 'Liverton Aguiar',
      date_time: new Date().toISOString().slice(0, 16).replace('T', ' '),
      status: 'concluido',
      service_cost: 250,
      time_spent_minutes: 60,
      problem_description: '',
      additional_info: '',
      changes_made: '',
      technical_notes: ''
    });
    setShowOrderModal(true);
  };

  const handleOpenEditOrder = (order: ServiceOrder) => {
    setEditingOrder(order);
    setOrderForm({
      service_type: order.service_type,
      technician_name: order.technician_name,
      date_time: order.date_time,
      status: order.status,
      service_cost: order.service_cost ?? 0,
      time_spent_minutes: order.time_spent_minutes ?? 60,
      problem_description: order.problem_description,
      additional_info: order.additional_info ?? '',
      changes_made: order.changes_made || '',
      technical_notes: order.technical_notes || ''
    });
    setShowOrderModal(true);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...orderForm,
        client_id: client.id,
        location_id: location?.id || client.locations?.[0]?.id || ''
      };
      if (editingOrder) {
        await api.updateServiceOrder(editingOrder.id, payload);
        showToast('Atendimento atualizado com sucesso!', 'success');
      } else {
        await api.createServiceOrder(payload);
        showToast('Novo atendimento registrado com sucesso!', 'success');
      }
      setShowOrderModal(false);
      await loadClientOrders();
      onRefresh();
    } catch (err: any) {
      showToast('Erro ao salvar atendimento: ' + err.message, 'error');
    }
  };

  const handleDeleteOrder = (orderId: string, serviceType: string) => {
    confirm({
      title: 'Excluir Atendimento',
      message: `Deseja realmente excluir o atendimento "${serviceType}" do histórico?`,
      confirmText: 'Excluir Atendimento',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteServiceOrder(orderId);
          showToast('Atendimento excluído com sucesso!', 'success');
          await loadClientOrders();
          onRefresh();
        } catch (err: any) {
          showToast('Erro ao excluir atendimento: ' + err.message, 'error');
        }
      }
    });
  };

  // Funções para Upload de Anexos e Prints
  const handleOpenUploadModal = (eqId?: string, defaultCat?: string) => {
    setUploadEquipmentId(eqId || (routerOnt ? routerOnt.id : ''));
    setUploadCategory(defaultCat || (eqId ? 'config_print' : 'config_print'));
    setUploadNotes('');
    setUploadFile(null);
    setShowUploadModal(true);
  };

  // Upload de Anexo
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      showToast('Selecione um arquivo para upload.', 'warning');
      return;
    }

    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      form.append('client_id', client.id);
      if (location) form.append('location_id', location.id);
      if (uploadEquipmentId) form.append('equipment_id', uploadEquipmentId);
      form.append('category', uploadCategory);
      form.append('notes', uploadNotes);

      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: form
      });

      if (!res.ok) throw new Error('Falha no upload do arquivo.');

      setShowUploadModal(false);
      setUploadFile(null);
      setUploadNotes('');
      setUploadEquipmentId('');
      showToast('Anexo enviado com sucesso!', 'success');
      onRefresh();
    } catch (err: any) {
      showToast('Erro ao enviar anexo: ' + err.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = (attId: string, name: string) => {
    confirm({
      title: 'Excluir Anexo',
      message: `Deseja realmente excluir o anexo "${name}"?`,
      confirmText: 'Excluir Anexo',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteAttachment(attId);
          showToast('Anexo removido com sucesso!', 'success');
          onRefresh();
        } catch (err: any) {
          showToast('Erro ao excluir anexo: ' + err.message, 'error');
        }
      }
    });
  };

  // Função para revelar credencial segura via endpoint de auditoria
  const handleRevealPassword = async (equipmentId: string, credentialId?: string) => {
    if (revealedPasswords[equipmentId]) {
      setRevealedPasswords(prev => {
        const next = { ...prev };
        delete next[equipmentId];
        return next;
      });
      return;
    }

    if (!credentialId) {
      showAlert({
        title: 'Cofre de Senhas',
        message: 'Nenhuma credencial vinculada a este equipamento no cofre.',
        type: 'warning'
      });
      return;
    }

    setLoadingReveal(prev => ({ ...prev, [equipmentId]: true }));
    try {
      const res = await api.revealCredential(credentialId);
      setRevealedPasswords(prev => ({ ...prev, [equipmentId]: res.password }));
    } catch (err: any) {
      showToast('Erro ao revelar senha: ' + err.message, 'error');
    } finally {
      setLoadingReveal(prev => ({ ...prev, [equipmentId]: false }));
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'router_ont': return <RouterIcon className="w-5 h-5 text-blue-400" />;
      case 'facial_recognition': return <ScanFace className="w-5 h-5 text-cyan-400" />;
      case 'gate_module': return <DoorOpen className="w-5 h-5 text-amber-400" />;
      case 'dvr_nvr':
      case 'ip_camera': return <Camera className="w-5 h-5 text-purple-400" />;
      default: return <Server className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header do Condomínio / Atendimento */}
      <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
              <span>Clientes</span>
              <span>/</span>
              <span className="text-blue-400">{client.name}</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <span>{client.name}</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 flex flex-wrap items-center gap-2">
              <span>Documentação da infraestrutura de rede</span>
              <span>•</span>
              <span className="text-slate-300 flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                {client.address || location?.address || 'Endereço não cadastrado'}
              </span>
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              {hasEquipments ? (
                <>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Infraestrutura Documentada
                  </span>
                  <span className="text-xs text-slate-400">
                    {client.notes || `${totalEquipments} equipamento(s) e ${totalPorts} regra(s) ativas.`}
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Cliente Novo • Documentação em Branco
                  </span>
                  <span className="text-xs text-slate-400">
                    Nenhum equipamento cadastrado. Adicione o roteador/ONT principal ou itens do catálogo.
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setViewMode(v => v === 'detailed' ? 'simplified' : 'detailed')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-[#172744] hover:bg-[#1E335A] border border-[#263D68] transition-all flex items-center gap-2 shadow-sm"
            >
              <Layers className="w-4 h-4 text-blue-400" />
              <span>{viewMode === 'detailed' ? 'Modo Simplificado' : 'Modo Técnico Detalhado'}</span>
            </button>

            <button
              onClick={onOpenReport}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              <span>Gerar PDF do cliente</span>
            </button>
          </div>
        </div>
      </div>

      {/* Banner de Auditoria de IP WAN */}
      <WanAlertBanner
        wanAudit={wanAudit}
        onOpenNetworkModal={handleOpenNetworkModal}
      />

      {/* 2. KPIs / Cards Superiores Modulares */}
      <DashboardKpis
        wanIp={wanIp}
        routerOnt={routerOnt}
        totalEquipments={totalEquipments}
        totalPorts={totalPorts}
        activePorts={activePorts}
        failedPorts={failedPorts}
        hasEquipments={hasEquipments}
        client={client}
        onOpenNetworkModal={handleOpenNetworkModal}
        onOpenEditEquipment={handleOpenEditEquipment}
        onOpenAddEquipmentFromCatalog={handleOpenAddEquipmentFromCatalog}
      />

      {/* 3. Seção Central: Topologia + Conexão/Obs/Anexos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TOPOLOGIA DA REDE */}
        <div className="lg:col-span-2 bg-[#101C31] border border-[#1D3054] rounded-2xl p-5 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-[#1D3054] mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                Topologia da Rede e Redirecionamentos
              </h2>
              <p className="text-xs text-slate-400">
                Internet → Roteador/ONT → Equipamentos e Portas Mapeadas
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Funcionando
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Não testada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Com falha
              </span>
            </div>
          </div>

          {!hasEquipments ? (
            <div className="flex-1 bg-[#091122]/80 border border-[#182845] rounded-xl p-8 flex flex-col items-center justify-center min-h-[380px] text-center select-none">
              <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 shadow-inner">
                <Globe className="w-8 h-8 text-blue-400 opacity-80" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">Topologia da Rede em Branco</h3>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-5">
                Nenhum equipamento foi documentado ainda para este cliente. Cadastre o Roteador/ONT ou selecione modelos prontos do catálogo para gerar o mapa visual da rede.
              </p>
              <button
                onClick={handleOpenAddEquipmentFromCatalog}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/25 transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ Adicionar Primeiro Equipamento</span>
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-[#091122]/80 border border-[#182845] rounded-xl p-6 flex flex-col items-center justify-center min-h-[380px] relative overflow-hidden select-none">
              {/* 1. Internet Node */}
              <div className="flex flex-col items-center z-10">
                <div className="px-6 py-2.5 rounded-xl bg-blue-600 shadow-lg shadow-blue-500/30 text-white font-semibold flex items-center gap-2 text-sm border border-blue-400">
                  <Globe className="w-4 h-4" />
                  <span>Internet</span>
                  {wanIp && <span className="text-xs font-mono font-normal opacity-90 pl-1">({wanIp})</span>}
                </div>
              </div>

              <div className="w-0.5 h-8 bg-blue-500/70"></div>

              {/* 2. Roteador / ONT Node (se houver) */}
              {routerOnt && (
                <div className="flex flex-col items-center z-10">
                  <div
                    onClick={() => handleOpenEditEquipment(routerOnt)}
                    className="px-6 py-3 rounded-xl bg-[#172643] border-2 border-blue-500 text-center shadow-lg min-w-[220px] cursor-pointer hover:border-blue-400 transition-all group"
                    title="Clique para editar este equipamento"
                  >
                    <div className="text-xs uppercase font-bold tracking-wider text-blue-400 flex items-center justify-center gap-1.5">
                      <RouterIcon className="w-3.5 h-3.5" />
                      {routerOnt.name}
                      <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                    </div>
                    {routerOnt.photo_url && (
                      <div className="relative w-full h-16 my-1.5 flex items-center justify-center overflow-hidden rounded-lg bg-gradient-to-b from-black/50 to-black/20 p-1 border border-blue-500/30 shadow-inner">
                        <img
                          src={routerOnt.photo_url}
                          alt={routerOnt.name}
                          className="h-full max-w-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                    <div className="text-xs text-slate-300 font-medium mt-0.5">
                      {routerOnt.model ? `${routerOnt.manufacturer || ''} ${routerOnt.model}` : routerOnt.name}
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-400 mt-1">
                      {routerOnt.local_ip || 'IP não informado'}
                    </div>
                  </div>
                </div>
              )}

              {/* Linhas de conexão e equipamentos conectados */}
              {equipments.filter(e => e.id !== routerOnt?.id).length > 0 && (
                <>
                  <div className="w-full max-w-2xl flex flex-col items-center">
                    <div className="w-0.5 h-6 bg-blue-500/70"></div>
                    <div className="w-[82%] h-0.5 bg-blue-500/70"></div>
                  </div>

                  <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 pt-0 z-10">
                    {equipments.filter(e => e.id !== routerOnt?.id).map((eq) => {
                      const ports = portForwards.filter(p => p.equipment_id === eq.id);
                      const hasFailure = ports.some(p => p.status === 'com_falha');
                      const portBadgeText = ports.length > 0
                        ? `${ports[0].external_port} → ${ports[0].internal_port}${ports.length > 1 ? ` +${ports.length - 1}` : ''}`
                        : null;

                      return (
                        <div key={eq.id} className="flex flex-col items-center">
                          <div className="w-0.5 h-5 bg-blue-500/70"></div>

                          {portBadgeText && (
                            <div className="mb-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-[11px] font-medium shadow-sm">
                              {portBadgeText}
                            </div>
                          )}

                          <div
                            onClick={() => handleOpenEditEquipment(eq)}
                            className={`w-full bg-[#132238] hover:bg-[#1A2E4E] border ${
                              hasFailure ? 'border-rose-500/70 shadow-rose-900/20' : 'border-[#263D68]'
                            } rounded-xl p-3 text-center cursor-pointer transition-all shadow-md group`}
                            title="Clique para editar este equipamento"
                          >
                            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-white group-hover:text-blue-300">
                              {getCategoryIcon(eq.category)}
                              <span className="truncate">{eq.name}</span>
                              <Edit className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
                            </div>
                            {eq.photo_url && (
                              <div className="relative w-full h-14 my-1 flex items-center justify-center overflow-hidden rounded-lg bg-gradient-to-b from-black/50 to-black/20 p-1 border border-[#243a62] shadow-inner">
                                <img
                                  src={eq.photo_url}
                                  alt={eq.name}
                                  className="h-full max-w-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                              </div>
                            )}
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                              {eq.model || eq.category}
                            </div>
                            <div className="text-xs font-mono font-bold text-emerald-400 mt-1">
                              {eq.local_ip || 'N/A'}
                            </div>

                            <div className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t border-[#1D3054]">
                              <span className={`w-2 h-2 rounded-full ${
                                hasFailure ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                              }`}></span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {hasFailure ? 'Com falha' : 'Funcionando'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="mt-6 text-[11px] text-slate-400 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                <span>Clique em qualquer cartão da topologia para editar seus dados de IP, MAC ou modelo instantaneamente.</span>
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DA DIREITA: Informações da Conexão / Obs / Anexos com Botões de Edição */}
        <div className="space-y-4">
          {/* Card: Informações da Conexão Modular */}
          <ConnectionSummaryCard
            routerOnt={routerOnt}
            wanIp={wanIp}
            onOpenNetworkModal={handleOpenNetworkModal}
          />

          {/* Card: Observações Técnicas Modular */}
          <TechnicalNotesCard
            notes={client.notes}
            onOpenNotesModal={handleOpenNotesModal}
          />

          {/* Card: Anexos e Backups com Upload e Exclusão */}
          <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054] mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileDown className="w-4 h-4 text-purple-400" />
                Anexos ({attachments.length})
              </h3>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#172744] hover:bg-[#20365D] text-purple-400 hover:text-purple-300 text-xs font-semibold transition-colors"
              >
                <Plus className="w-3 h-3" /> Anexar
              </button>
            </div>

            <div className="space-y-2">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#132238] border border-[#24375A] text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    <span className="font-mono text-slate-200 truncate">{att.original_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({Math.round(att.file_size / 1024)} KB)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`/api/attachments/${att.id}/download`}
                      download
                      className="p-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white transition-colors"
                      title="Baixar arquivo"
                    >
                      <FileDown className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDeleteAttachment(att.id, att.original_name)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                      title="Excluir anexo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO FIXADA NO CLIENTE: Histórico de Atendimentos Modular */}
      <ServiceOrdersHistorySection
        serviceOrders={serviceOrders}
        loadingOrders={loadingOrders}
        totalServiceCost={totalServiceCost}
        formattedTotalTime={formattedTotalTime}
        onOpenNewOrder={handleOpenNewOrder}
        onOpenEditOrder={handleOpenEditOrder}
      />

      {/* 4. Grade Inferior: Cartões Detalhados com Botão de Edição Direta em Cada Item */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              Equipamentos Documentados ({equipments.length})
            </h2>
            <span className="text-xs text-slate-400">
              Cada cartão permite edição direta de IPs, MACs, modelos, credenciais e regras de portas
            </span>
          </div>

          <button
            onClick={handleOpenAddEquipmentFromCatalog}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/25 transition shrink-0 self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>+ Adicionar do Catálogo</span>
          </button>
        </div>

        {equipments.length === 0 ? (
          <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-8 text-center select-none">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Server className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Nenhum equipamento documentado ainda</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
              Este cliente ainda não possui equipamentos cadastrados na rede. Comece adicionando o Roteador/ONT ou selecione modelos prontos com portas e protocolos a partir do Catálogo de Equipamentos.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleOpenAddEquipmentFromCatalog}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/25 transition"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>+ Adicionar do Catálogo</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {equipments.map(eq => {
              const ports = portForwards.filter(p => p.equipment_id === eq.id);
              const eqAttachments = attachments.filter(a => a.equipment_id === eq.id);
              const isRevealed = !!revealedPasswords[eq.id];
              const isOnt = eq.category === 'router_ont';

              return (
                <div
                  key={eq.id}
                  className="bg-[#101C31] border border-[#1D3054] hover:border-[#2D4A7D] rounded-2xl p-5 shadow-xl flex flex-col justify-between transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#1D3054]">
                      <div>
                        <div className="text-base font-bold text-white flex items-center gap-2">
                          {eq.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {eq.category.replace('_', ' ').toUpperCase()} • {eq.physical_location || 'Local'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenUploadModal(eq.id, 'config_print')}
                          className="p-1.5 rounded-lg bg-[#172643] hover:bg-purple-600/30 text-purple-300 hover:text-white border border-[#24375A] transition-colors"
                          title="Anexar print de configuração ou passo a passo deste equipamento"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditEquipment(eq)}
                          className="p-1.5 rounded-lg bg-[#172643] hover:bg-[#20365D] text-slate-300 hover:text-white border border-[#24375A] transition-colors"
                          title="Editar todos os dados deste equipamento"
                        >
                          <Edit className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                      </div>
                    </div>

                    {/* Vitrine Estúdio do Equipamento (sem corte e sem achatar) */}
                    {eq.photo_url ? (
                      <div className="relative my-3.5 w-full h-32 rounded-xl bg-gradient-to-b from-[#13233c]/90 via-[#0c1626] to-[#070d18] border border-[#1e3559] flex items-center justify-center p-3 shadow-inner group/photo overflow-hidden">
                        {/* Iluminação de estúdio central */}
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none"></div>

                        <img
                          src={eq.photo_url}
                          alt={eq.name}
                          className="relative z-10 max-h-full max-w-full object-contain filter drop-shadow-[0_6px_14px_rgba(0,0,0,0.65)] transition-transform duration-300 group-hover/photo:scale-105 select-none"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                    ) : null}

                    {/* Detalhes de Identificação e IP */}
                    <div className="grid grid-cols-2 gap-2 text-xs py-3 border-b border-[#1D3054]/60">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Modelo</span>
                        <span className="font-semibold text-slate-200 truncate block">{eq.model || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">IP local</span>
                        <span className="font-mono font-bold text-emerald-400 block">{eq.local_ip || 'N/A'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[11px]">MAC Address</span>
                        <span className="font-mono text-slate-300 text-[11px] block">{eq.mac_address || 'N/A'}</span>
                      </div>

                      {eq.serial_number && (
                        <div className="col-span-2">
                          <span className="text-slate-400 block text-[11px]">Número de Série (S/N)</span>
                          <span className="font-mono text-amber-300/90 text-[11px] block">{eq.serial_number}</span>
                        </div>
                      )}

                      {isOnt && (
                        <div className="col-span-2">
                          <span className="text-slate-400 block text-[11px]">IP WAN</span>
                          <span className="font-mono font-bold text-blue-400 block">{wanIp}</span>
                        </div>
                      )}

                      {eq.config_path && (
                        <div className="col-span-2">
                          <span className="text-slate-400 block text-[11px]">Caminho no roteador</span>
                          <span className="text-slate-300 text-[11px] font-mono block truncate">{eq.config_path}</span>
                        </div>
                      )}
                    </div>

                    {/* Regras de Portas associadas */}
                    {ports.length > 0 && (
                      <div className="py-3 border-b border-[#1D3054]/60 space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Redirecionamentos ({ports.length})
                        </div>
                        <div className="space-y-1.5">
                          {ports.map(p => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between p-1.5 rounded-lg bg-[#0C1525] border border-[#1A2C49] text-[11px] font-mono group"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                  {p.external_port}
                                </span>
                                <span className="text-slate-400">→</span>
                                <span className="text-blue-300">{p.internal_port}</span>
                                <span className="text-[10px] text-slate-400">({p.protocol})</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTestDashboardPort(p);
                                  }}
                                  disabled={testingPortId === p.id}
                                  title="Testar porta TCP agora"
                                  className="p-1 rounded bg-[#172744] hover:bg-[#20365D] text-amber-300 hover:text-amber-200 transition opacity-80 hover:opacity-100 disabled:opacity-40"
                                >
                                  {testingPortId === p.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                                  ) : (
                                    <Play className="w-3 h-3 text-amber-400 fill-amber-400/20" />
                                  )}
                                </button>
                                <span className={`w-2 h-2 rounded-full ${
                                  p.status === 'funcionando' ? 'bg-emerald-500' :
                                  p.status === 'com_falha' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                                }`} title={`Status: ${p.status}`}></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {eq.notes && (
                      <div className="py-2 text-xs text-slate-400 leading-snug line-clamp-2">
                        {eq.notes}
                      </div>
                    )}

                    {/* Informações Adicionais Gerais */}
                    {eq.additional_info && (
                      <div className="py-1 px-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 mt-1 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-tight">{eq.additional_info}</span>
                      </div>
                    )}

                    {/* Notas Internas de TI (Confidencial) */}
                    {eq.internal_notes && (
                      <div className="py-1 px-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300/90 mt-1.5 flex items-start gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-tight"><strong>Interno:</strong> {eq.internal_notes}</span>
                      </div>
                    )}

                    {/* Prints de Configuração e Anexos Vinculados */}
                    {eqAttachments.length > 0 && (
                      <div className="pt-2 mt-2 border-t border-[#1D3054]/60 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <span className="flex items-center gap-1 text-purple-300 font-semibold">
                            <Camera className="w-3 h-3 text-purple-400" />
                            <span>Prints / Anexos ({eqAttachments.length})</span>
                          </span>
                          <button
                            onClick={() => handleOpenUploadModal(eq.id, 'config_print')}
                            className="text-[10px] text-purple-400 hover:text-purple-300 lowercase font-medium"
                          >
                            + anexar
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                          {eqAttachments.slice(0, 4).map(att => {
                            const isImg = att.mime_type.startsWith('image/');
                            const fileUrl = att.file_path.startsWith('/') ? att.file_path : `/${att.file_path}`;
                            return (
                              <a
                                key={att.id}
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group/att relative rounded-lg bg-[#0C1525] border border-[#1A2C49] hover:border-purple-500/50 p-1.5 flex items-center gap-2 overflow-hidden transition"
                                title={`${att.original_name}${att.notes ? ` - ${att.notes}` : ''}`}
                              >
                                {isImg ? (
                                  <img src={fileUrl} alt={att.original_name} className="w-7 h-7 object-cover rounded shrink-0 group-hover/att:scale-105 transition-transform" />
                                ) : (
                                  <FileDown className="w-5 h-5 text-purple-400 shrink-0" />
                                )}
                                <div className="truncate text-left min-w-0">
                                  <span className="text-[10px] text-slate-300 font-medium truncate block">
                                    {att.original_name}
                                  </span>
                                  <span className="text-[9px] text-purple-300/80 block uppercase truncate">
                                    {att.category === 'config_print' ? 'Print' : att.category === 'step_by_step' ? 'Passo a Passo' : 'Anexo'}
                                  </span>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botão Seguro do Cofre de Senhas */}
                  <div className="pt-3 border-t border-[#1D3054] mt-2 flex items-center justify-between">
                    <div className="text-xs">
                      <span className="text-slate-400 block text-[10px]">Credencial</span>
                      <span className="font-semibold text-slate-200">
                        {eq.admin_username || 'admin'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isRevealed ? (
                        <div className="flex items-center gap-2 bg-emerald-950/70 border border-emerald-500/50 px-2.5 py-1 rounded-lg">
                          <span className="font-mono text-xs font-bold text-emerald-300">
                            {revealedPasswords[eq.id]}
                          </span>
                          <button
                            onClick={() => handleRevealPassword(eq.id)}
                            className="text-slate-400 hover:text-slate-200"
                            title="Ocultar senha"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRevealPassword(eq.id, eq.credential_id)}
                          disabled={loadingReveal[eq.id]}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-[#172744] hover:bg-[#1E335A] border border-[#24375A] transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{loadingReveal[eq.id] ? 'Revelando...' : 'Revelar'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Editar Parâmetros de Conexão e Sub-rede */}
      {showNetworkModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowNetworkModal(false); }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054]">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                {wanIp ? 'Editar Parâmetros de Conexão e Sub-rede' : 'Configurar IP WAN e Parâmetros de Rede'}
              </h2>
              <button onClick={() => setShowNetworkModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNetworkParams} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">IP WAN (Público Dedicado) *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={networkForm.public_wan_ip}
                    onChange={(e) => setNetworkForm(p => ({ ...p, public_wan_ip: e.target.value }))}
                    placeholder="203.0.113.45"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">IP do Roteador / ONT (Gateway Local) *</label>
                  <input
                    type="text"
                    required
                    value={networkForm.local_ip}
                    onChange={(e) => setNetworkForm(p => ({ ...p, local_ip: e.target.value }))}
                    placeholder="192.168.1.1"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Máscara de Sub-rede *</label>
                  <input
                    type="text"
                    required
                    value={networkForm.subnet_mask}
                    onChange={(e) => setNetworkForm(p => ({ ...p, subnet_mask: e.target.value }))}
                    placeholder="255.255.255.0"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Gateway Padrão</label>
                  <input
                    type="text"
                    value={networkForm.gateway}
                    onChange={(e) => setNetworkForm(p => ({ ...p, gateway: e.target.value }))}
                    placeholder="192.168.1.1"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Faixa DHCP</label>
                  <input
                    type="text"
                    value={networkForm.dhcp_range}
                    onChange={(e) => setNetworkForm(p => ({ ...p, dhcp_range: e.target.value }))}
                    placeholder="192.168.1.100-199"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">DNS Primário</label>
                  <input
                    type="text"
                    value={networkForm.primary_dns}
                    onChange={(e) => setNetworkForm(p => ({ ...p, primary_dns: e.target.value }))}
                    placeholder="8.8.8.8"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">DNS Secundário</label>
                  <input
                    type="text"
                    value={networkForm.secondary_dns}
                    onChange={(e) => setNetworkForm(p => ({ ...p, secondary_dns: e.target.value }))}
                    placeholder="8.8.4.4"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1D3054]">
                <button
                  type="button"
                  onClick={() => setShowNetworkModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
                >
                  Salvar Parâmetros
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Editar Observações Técnicas */}
      {showNotesModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowNotesModal(false); }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054]">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Editar Observações Técnicas do Atendimento
              </h2>
              <button onClick={() => setShowNotesModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNotes} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Título do Serviço</label>
                <input
                  type="text"
                  value={notesForm.service_type}
                  onChange={(e) => setNotesForm(p => ({ ...p, service_type: e.target.value }))}
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Observações Técnicas e Validações</label>
                <textarea
                  rows={6}
                  required
                  value={notesForm.technical_notes}
                  onChange={(e) => setNotesForm(p => ({ ...p, technical_notes: e.target.value }))}
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg p-3 text-white leading-relaxed focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1D3054]">
                <button
                  type="button"
                  onClick={() => setShowNotesModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
                >
                  Salvar Observações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Enviar Novo Anexo */}
      {showUploadModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowUploadModal(false); }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054]">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-400" />
                Anexar Arquivo ou Foto Técnica
              </h2>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Selecione o Arquivo ou Print *</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg p-2 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-400" />
                  <span>Vincular ao Equipamento (Ex: ONT, DVR, Facial)</span>
                </label>
                <select
                  value={uploadEquipmentId}
                  onChange={(e) => setUploadEquipmentId(e.target.value)}
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">Geral do Cliente / Rede (Sem equipamento específico)</option>
                  {equipments.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} ({eq.model || eq.category}) — {eq.physical_location || eq.local_ip || 'Local'}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  O anexo aparecerá vinculado a este dispositivo no painel e no relatório em PDF.
                </span>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Tipo de Anexo / Conteúdo</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="config_print">📸 Print / Captura de Configuração (NAT, Portas, WAN, Wi-Fi)</option>
                  <option value="step_by_step">📋 Passo a Passo Técnico / Roteiro de Configuração</option>
                  <option value="equipment_photo">📷 Fotografia Real do Aparelho / Local de Instalação</option>
                  <option value="backup">💾 Arquivo de Backup / Configuração (.bin, .cfg, .rsc, .xml)</option>
                  <option value="label_photo">🏷️ Foto de Etiqueta / Número de Série / MAC</option>
                  <option value="manual">📖 Manual do Fabricante / Diagrama</option>
                  <option value="documento">📄 Outro Documento / Relatório</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Descrição / Instruções do Passo a Passo</label>
                <textarea
                  rows={2}
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Ex: Print da aba NAT > Virtual Server mapeando portas 8000 e 554 para o DVR..."
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1D3054]">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
                >
                  {isUploading ? 'Enviando...' : 'Enviar Anexo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Criar ou Editar Atendimento Técnico do Cliente */}
      {showOrderModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowOrderModal(false); }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Wrench className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {editingOrder ? 'Editar Atendimento Técnico' : 'Novo Atendimento Técnico no Cliente'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Defina custo faturado, tempo investido, escopo do chamado e informações adicionais
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOrderModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1A2C49] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Tipo de Serviço / Escopo *</label>
                  <input
                    type="text"
                    required
                    value={orderForm.service_type}
                    onChange={(e) => setOrderForm(p => ({ ...p, service_type: e.target.value }))}
                    placeholder="Ex: Troca de Roteador/ONT, Reconfiguração de Facial, Manutenção CFTV"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Técnico Responsável *</label>
                  <input
                    type="text"
                    required
                    value={orderForm.technician_name}
                    onChange={(e) => setOrderForm(p => ({ ...p, technician_name: e.target.value }))}
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Data e Hora do Atendimento *</label>
                  <input
                    type="text"
                    required
                    value={orderForm.date_time}
                    onChange={(e) => setOrderForm(p => ({ ...p, date_time: e.target.value }))}
                    placeholder="2026-11-03 14:30"
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Status da Visita / Atendimento</label>
                  <select
                    value={orderForm.status}
                    onChange={(e) => setOrderForm(p => ({ ...p, status: e.target.value as any }))}
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="concluido">Concluído</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="aguardando_retorno">Aguardando Retorno / Peças</option>
                    <option value="agendado">Agendado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                {/* Custo e Tempo Gasto */}
                <div>
                  <label className="text-emerald-400 font-bold block mb-1 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Custo do Serviço (R$)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={orderForm.service_cost}
                    onChange={(e) => setOrderForm(p => ({ ...p, service_cost: parseFloat(e.target.value) || 0 }))}
                    placeholder="Ex: 350.00"
                    className="w-full bg-[#132238] border border-emerald-500/40 focus:border-emerald-400 rounded-lg px-3 py-2 text-emerald-300 font-mono font-bold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Valor cobrado do condomínio</span>
                </div>

                <div>
                  <label className="text-blue-400 font-bold block mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Tempo Gasto (minutos)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={orderForm.time_spent_minutes}
                    onChange={(e) => setOrderForm(p => ({ ...p, time_spent_minutes: parseInt(e.target.value, 10) || 0 }))}
                    placeholder="Ex: 90"
                    className="w-full bg-[#132238] border border-blue-500/40 focus:border-blue-400 rounded-lg px-3 py-2 text-blue-300 font-mono font-bold focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Equivale a: <strong className="text-slate-200">
                      {orderForm.time_spent_minutes >= 60
                        ? `${Math.floor(orderForm.time_spent_minutes / 60)}h ${orderForm.time_spent_minutes % 60 > 0 ? (orderForm.time_spent_minutes % 60) + 'm' : ''}`
                        : `${orderForm.time_spent_minutes} min`}
                    </strong>
                  </span>
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Descrição do Problema / Diagnóstico *</label>
                  <textarea
                    rows={2}
                    required
                    value={orderForm.problem_description}
                    onChange={(e) => setOrderForm(p => ({ ...p, problem_description: e.target.value }))}
                    placeholder="Qual era o problema relatado pelo cliente ou motivo da visita técnica..."
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-blue-300 font-semibold block mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    <span>Informações Adicionais Gerais (Escopo, Peças, Garantia, Faturamento)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={orderForm.additional_info}
                    onChange={(e) => setOrderForm(p => ({ ...p, additional_info: e.target.value }))}
                    placeholder="Ex: Garantia de mão de obra de 90 dias, faturado no boleto para dia 15, cabos e conectores fornecidos pela empresa..."
                    className="w-full bg-[#132238] border border-blue-500/30 focus:border-blue-400 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">Observações Técnicas e Configurações Realizadas</label>
                  <textarea
                    rows={2}
                    value={orderForm.technical_notes}
                    onChange={(e) => setOrderForm(p => ({ ...p, technical_notes: e.target.value }))}
                    placeholder="Notas internas do técnico, procedimentos realizados, portas testadas..."
                    className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1D3054]">
                {editingOrder ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteOrder(editingOrder.id, editingOrder.service_type)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 transition flex items-center gap-1.5 border border-rose-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                ) : <div></div>}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOrderModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D] transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20 transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvar Atendimento</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Adicionar do Catálogo ou Editar Equipamento no Condomínio */}
      <AddEquipmentModal
        isOpen={showEquipmentModal}
        onClose={() => {
          setShowEquipmentModal(false);
          setEditingEquipment(null);
        }}
        clientId={client.id}
        locationId={location?.id || client.locations?.[0]?.id || ''}
        locations={client.locations || []}
        onSuccess={() => {
          onRefresh();
        }}
        equipmentToEdit={editingEquipment}
      />
    </div>
  );
};
