import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  X,
  Search,
  CheckCircle2,
  Sparkles,
  Router as RouterIcon,
  ScanFace,
  DoorOpen,
  Camera,
  Layers,
  Wifi,
  Cpu,
  KeyRound,
  ShieldCheck,
  Plus,
  ArrowRight,
  Info,
  Lock,
  Image as ImageIcon,
  Upload,
  Trash2,
  RefreshCw,
  Scan,
  Undo2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Equipment, Location, EquipmentCatalogItem, EquipmentTemplate } from '../types';
import { api } from '../services/api';
import { ImageSearchModal } from './ImageSearchModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { useDialog } from '../context/DialogContext';

interface AddEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  locationId: string;
  locations?: Location[];
  onSuccess: () => void;
  equipmentToEdit?: Equipment | null;
}

export const AddEquipmentModal: React.FC<AddEquipmentModalProps> = ({
  isOpen,
  onClose,
  clientId,
  locationId,
  locations = [],
  onSuccess,
  equipmentToEdit
}) => {
  const { showToast } = useDialog();
  const [catalog, setCatalog] = useState<EquipmentCatalogItem[]>([]);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<EquipmentCatalogItem | null>(null);
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveToCatalog, setSaveToCatalog] = useState<boolean>(true); // Salvar novo modelo no catálogo para uso futuro
  const [scannerTarget, setScannerTarget] = useState<'mac' | 'serial' | null>(null);

  // Estados de IPAM para validação de conflitos e sugestão do próximo IP livre
  const [existingEquipments, setExistingEquipments] = useState<Equipment[]>([]);
  const [ipConflictWarning, setIpConflictWarning] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && clientId) {
      api.getEquipments(clientId)
        .then(setExistingEquipments)
        .catch(() => {});
    }
  }, [isOpen, clientId]);

  // Modal dedicado de Criação de Novo Modelo no Catálogo
  const [isNewModelModalOpen, setIsNewModelModalOpen] = useState<boolean>(false);
  const [isNewModelImageSearchOpen, setIsNewModelImageSearchOpen] = useState<boolean>(false);
  const [isSavingNewModel, setIsSavingNewModel] = useState<boolean>(false);
  const [newModelForm, setNewModelForm] = useState({
    name: '',
    category: 'router_ont',
    manufacturer: '',
    model: '',
    default_management_port: 80,
    default_protocol: 'http',
    default_username: 'admin',
    photo_url: '',
    notes: ''
  });

  // Estados para foto e busca inteligente
  const [isImageSearchOpen, setIsImageSearchOpen] = useState<boolean>(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [isRemovingBg, setIsRemovingBg] = useState<boolean>(false);
  const [originalPhotoUrl, setOriginalPhotoUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formulário do Equipamento
  const [formData, setFormData] = useState({
    name: '',
    category: 'router_ont',
    manufacturer: '',
    model: '',
    serial_number: '',
    mac_address: '',
    physical_location: '',
    photo_url: '',
    location_id: locationId || '',
    local_ip: '',
    subnet_mask: '255.255.255.0',
    gateway: '192.168.1.1',
    primary_dns: '',
    secondary_dns: '',
    dhcp_range: '',
    is_mac_reserved: 1,
    public_wan_ip: '',
    management_port: 80,
    protocol: 'http',
    admin_username: 'admin',
    admin_password: '', // Senha opcional para salvar no cofre
    config_path: '',
    notes: '',
    internal_notes: '',
    additional_info: '',
    warranty_expires_at: '',
    custom_fields: {} as Record<string, any>
  });

  // Modelos e campos personalizados (Fase 8)
  const [templates, setTemplates] = useState<EquipmentTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<EquipmentTemplate | null>(null);

  useEffect(() => {
    if (formData.category) {
      api.getEquipmentTemplates(formData.category)
        .then(tmpls => {
          setTemplates(tmpls);
          setActiveTemplate(tmpls.length > 0 ? tmpls[0] : null);
        })
        .catch(() => {});
    }
  }, [formData.category]);

  // Carrega catálogo ao abrir
  useEffect(() => {
    if (isOpen) {
      loadCatalog();
      if (equipmentToEdit) {
        let parsedCustom = {};
        if (equipmentToEdit.custom_fields) {
          try {
            parsedCustom = typeof equipmentToEdit.custom_fields === 'string'
              ? JSON.parse(equipmentToEdit.custom_fields)
              : equipmentToEdit.custom_fields;
          } catch {}
        }

        setFormData({
          name: equipmentToEdit.name,
          category: equipmentToEdit.category,
          manufacturer: equipmentToEdit.manufacturer || '',
          model: equipmentToEdit.model || '',
          serial_number: equipmentToEdit.serial_number || '',
          mac_address: equipmentToEdit.mac_address || '',
          physical_location: equipmentToEdit.physical_location || '',
          photo_url: equipmentToEdit.photo_url || '',
          location_id: equipmentToEdit.location_id || locationId,
          local_ip: equipmentToEdit.local_ip || '',
          subnet_mask: equipmentToEdit.subnet_mask || '255.255.255.0',
          gateway: equipmentToEdit.gateway || '192.168.1.1',
          primary_dns: equipmentToEdit.primary_dns || '',
          secondary_dns: equipmentToEdit.secondary_dns || '',
          dhcp_range: equipmentToEdit.dhcp_range || '',
          is_mac_reserved: equipmentToEdit.is_mac_reserved ? 1 : 0,
          public_wan_ip: equipmentToEdit.public_wan_ip || '',
          management_port: equipmentToEdit.management_port || 80,
          protocol: equipmentToEdit.protocol || 'http',
          admin_username: equipmentToEdit.admin_username || 'admin',
          admin_password: '',
          config_path: equipmentToEdit.config_path || '',
          notes: equipmentToEdit.notes || '',
          internal_notes: equipmentToEdit.internal_notes || '',
          additional_info: equipmentToEdit.additional_info || '',
          warranty_expires_at: equipmentToEdit.warranty_expires_at || '',
          custom_fields: parsedCustom
        });
        setSelectedCatalogItem(null);
      } else {
        // Tenta recuperar rascunho anterior de novo cadastro
        const draftKey = `rededoc_draft_eq_${clientId}`;
        const savedDraft = sessionStorage.getItem(draftKey);
        if (savedDraft) {
          try {
            setFormData(JSON.parse(savedDraft));
            setSelectedCatalogItem(null);
            return;
          } catch {}
        }

        // Reset para novo cadastro
        setFormData({
          name: '',
          category: 'router_ont',
          manufacturer: '',
          model: '',
          serial_number: '',
          mac_address: '',
          physical_location: '',
          photo_url: '',
          location_id: locationId,
          local_ip: '192.168.1.',
          subnet_mask: '255.255.255.0',
          gateway: '192.168.1.1',
          primary_dns: '',
          secondary_dns: '',
          dhcp_range: '',
          is_mac_reserved: 1,
          public_wan_ip: '',
          management_port: 80,
          protocol: 'http',
          admin_username: 'admin',
          admin_password: '',
          config_path: '',
          notes: '',
          internal_notes: '',
          additional_info: '',
          warranty_expires_at: '',
          custom_fields: {}
        });
        setSelectedCatalogItem(null);
      }
    }
  }, [isOpen, equipmentToEdit?.id]);

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (!equipmentToEdit) {
        sessionStorage.setItem(`rededoc_draft_eq_${clientId}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const items = await api.getEquipmentCatalog();
      setCatalog(items);
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Validação contínua de conflitos de IP
  useEffect(() => {
    const cleanIp = formData.local_ip?.trim();
    if (!cleanIp || existingEquipments.length === 0) {
      setIpConflictWarning(null);
      return;
    }
    const dup = existingEquipments.find(
      e => e.local_ip?.trim() === cleanIp && e.id !== equipmentToEdit?.id
    );
    if (dup) {
      setIpConflictWarning(`Conflito: IP já utilizado por "${dup.name}" (${dup.model || dup.category})`);
    } else {
      setIpConflictWarning(null);
    }
  }, [formData.local_ip, existingEquipments, equipmentToEdit?.id]);

  const handleSuggestNextFreeIp = async () => {
    if (!clientId) return;
    try {
      const subs = await api.getSubnets(clientId);
      if (subs.length > 0) {
        const usage = await api.getSubnetUsage(subs[0].id);
        if (usage.nextFreeIp) {
          setFormData(prev => ({ ...prev, local_ip: usage.nextFreeIp! }));
          showToast(`Próximo IP livre ${usage.nextFreeIp} preenchido!`, 'success');
          return;
        }
      }

      // Fallback: calcular próximo IP a partir dos equipamentos existentes
      const usedIps = new Set(existingEquipments.map(e => e.local_ip?.trim()).filter(Boolean));
      for (let i = 2; i <= 254; i++) {
        const candidate = `192.168.1.${i}`;
        if (!usedIps.has(candidate)) {
          setFormData(prev => ({ ...prev, local_ip: candidate }));
          showToast(`Próximo IP livre ${candidate} preenchido!`, 'success');
          return;
        }
      }
    } catch {
      showToast('Não foi possível calcular o próximo IP livre.', 'warning');
    }
  };

  // Fecha modais com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isNewModelImageSearchOpen) {
          setIsNewModelImageSearchOpen(false);
        } else if (isNewModelModalOpen) {
          setIsNewModelModalOpen(false);
        } else if (isImageSearchOpen) {
          setIsImageSearchOpen(false);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isNewModelModalOpen, isImageSearchOpen, isNewModelImageSearchOpen, onClose]);

  if (!isOpen) return null;

  // Filtra itens do catálogo
  const filteredCatalog = catalog.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      item.manufacturer.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      item.model.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(catalogSearch.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Ao selecionar um modelo do Catálogo
  const handleSelectCatalogItem = (item: EquipmentCatalogItem) => {
    setSelectedCatalogItem(item);
    setSaveToCatalog(false); // Já existe no catálogo
    setFormData(prev => ({
      ...prev,
      category: item.category,
      manufacturer: item.manufacturer,
      model: item.model,
      name: prev.name || `${item.model.toUpperCase()}-${prev.physical_location || 'EQUIP'}`,
      photo_url: item.photo_url || prev.photo_url,
      management_port: item.default_management_port || 80,
      protocol: item.default_protocol || 'http',
      admin_username: item.default_username || 'admin',
      config_path: item.default_config_path || '',
      notes: prev.notes || (item.notes ? `[Catálogo: ${item.name}] ${item.notes}` : '')
    }));
  };

  // Abre modal dedicado para criar novo modelo no catálogo
  const handleOpenNewModelModal = (queryText = '') => {
    let guessedMfg = '';
    let guessedModel = queryText.trim();
    const parts = queryText.trim().split(/\s+/);
    if (parts.length > 1) {
      guessedMfg = parts[0];
      guessedModel = parts.slice(1).join(' ');
    }
    setNewModelForm({
      name: queryText.trim() ? `${guessedMfg ? guessedMfg + ' ' : ''}${guessedModel}` : '',
      category: selectedCategory !== 'all' ? selectedCategory : 'router_ont',
      manufacturer: guessedMfg,
      model: guessedModel,
      default_management_port: 80,
      default_protocol: 'http',
      default_username: 'admin',
      photo_url: '',
      notes: ''
    });
    setIsNewModelModalOpen(true);
  };

  // Salva o novo modelo no catálogo do sistema e já auto-preenche o formulário
  const handleSaveNewModelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelForm.model.trim()) {
      showToast('O nome do modelo é obrigatório.', 'warning');
      return;
    }

    setIsSavingNewModel(true);
    try {
      const fullModelName = newModelForm.name.trim() || `${newModelForm.manufacturer} ${newModelForm.model}`.trim();
      const createdItem = await api.createEquipmentCatalogItem({
        name: fullModelName,
        category: newModelForm.category,
        manufacturer: newModelForm.manufacturer.trim() || 'Genérico',
        model: newModelForm.model.trim(),
        default_management_port: Number(newModelForm.default_management_port) || 80,
        default_protocol: newModelForm.default_protocol,
        default_username: newModelForm.default_username || 'admin',
        photo_url: newModelForm.photo_url || '',
        notes: newModelForm.notes || ''
      });

      showToast(`Modelo "${createdItem.name}" salvo no catálogo com sucesso!`, 'success');
      await loadCatalog();
      handleSelectCatalogItem(createdItem);
      setIsNewModelModalOpen(false);
    } catch (err: any) {
      showToast('Erro ao cadastrar modelo no catálogo: ' + err.message, 'error');
    } finally {
      setIsSavingNewModel(false);
    }
  };

  const handleUploadPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    setErrorMessage(null);
    try {
      const res = await api.uploadImageFile(file, {
        equipmentId: equipmentToEdit?.id,
        clientId
      });
      setOriginalPhotoUrl(res.localUrl);
      setFormData(prev => ({ ...prev, photo_url: res.localUrl }));
    } catch (err: any) {
      setErrorMessage('Falha ao enviar arquivo de foto: ' + err.message);
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectPhotoFromWeb = (localUrl: string) => {
    setOriginalPhotoUrl(localUrl);
    setFormData(prev => ({ ...prev, photo_url: localUrl }));
  };

  const handleRemovePhoto = () => {
    setFormData(prev => ({ ...prev, photo_url: '' }));
  };

  const handleRemoveBackground = async () => {
    if (!formData.photo_url) return;
    if (!originalPhotoUrl) {
      setOriginalPhotoUrl(formData.photo_url);
    }
    setIsRemovingBg(true);
    setErrorMessage(null);
    try {
      const res = await api.removeImageBackground(formData.photo_url, equipmentToEdit?.id);
      setFormData(prev => ({ ...prev, photo_url: res.localUrl }));
    } catch (err: any) {
      setErrorMessage('Falha ao remover fundo: ' + err.message);
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim()) {
      setErrorMessage('O nome de identificação é obrigatório.');
      return;
    }
    if (!formData.local_ip.trim()) {
      setErrorMessage('O IP Local é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    try {
      let savedEquipment: Equipment;

      if (equipmentToEdit) {
        // Atualiza equipamento existente
        savedEquipment = await api.updateEquipment(equipmentToEdit.id, {
          name: formData.name,
          category: formData.category,
          manufacturer: formData.manufacturer,
          model: formData.model,
          serial_number: formData.serial_number,
          mac_address: formData.mac_address,
          physical_location: formData.physical_location,
          photo_url: formData.photo_url,
          location_id: formData.location_id || locationId,
          local_ip: formData.local_ip,
          subnet_mask: formData.subnet_mask,
          gateway: formData.gateway,
          primary_dns: formData.primary_dns ?? '',
          secondary_dns: formData.secondary_dns ?? '',
          dhcp_range: formData.dhcp_range ?? '',
          is_mac_reserved: formData.is_mac_reserved ? 1 : 0,
          public_wan_ip: formData.public_wan_ip,
          management_port: Number(formData.management_port) || 80,
          protocol: formData.protocol,
          admin_username: formData.admin_username,
          config_path: formData.config_path,
          notes: formData.notes,
          internal_notes: formData.internal_notes,
          additional_info: formData.additional_info,
          warranty_expires_at: formData.warranty_expires_at || null,
          custom_fields: formData.custom_fields || {}
        });

        // Se o técnico informou uma nova senha na edição, atualiza ou cria a credencial no cofre (AES-256-GCM)
        if (formData.admin_password.trim()) {
          try {
            const credentials = await api.getCredentials(clientId, equipmentToEdit.id);
            const existingCred = credentials?.[0];
            if (existingCred) {
              await api.updateCredential(existingCred.id, {
                ...existingCred,
                username: formData.admin_username || existingCred.username || 'admin',
                password: formData.admin_password,
                access_url: `${formData.protocol}://${formData.local_ip}`,
                port: Number(formData.management_port) || 80
              });
            } else {
              await api.createCredential({
                client_id: clientId,
                equipment_id: equipmentToEdit.id,
                name: `Acesso Admin - ${formData.name}`,
                category: 'equipamento',
                username: formData.admin_username || 'admin',
                password: formData.admin_password,
                access_url: `${formData.protocol}://${formData.local_ip}`,
                port: Number(formData.management_port) || 80,
                notes: 'Atualizado junto com o equipamento'
              });
            }
          } catch (credErr) {
            console.error('Aviso ao sincronizar credencial no cofre:', credErr);
          }
        }
      } else {
        // Cria novo equipamento no condomínio
        savedEquipment = await api.createEquipment({
          client_id: clientId,
          location_id: formData.location_id || locationId,
          name: formData.name,
          category: formData.category,
          manufacturer: formData.manufacturer,
          model: formData.model,
          serial_number: formData.serial_number,
          mac_address: formData.mac_address,
          physical_location: formData.physical_location,
          photo_url: formData.photo_url,
          local_ip: formData.local_ip,
          subnet_mask: formData.subnet_mask,
          gateway: formData.gateway,
          primary_dns: formData.primary_dns ?? '',
          secondary_dns: formData.secondary_dns ?? '',
          dhcp_range: formData.dhcp_range ?? '',
          interface_name: '',
          vlan: '',
          is_mac_reserved: formData.is_mac_reserved ? 1 : 0,
          public_wan_ip: formData.public_wan_ip,
          access_url: `${formData.protocol}://${formData.local_ip}`,
          management_port: Number(formData.management_port) || 80,
          protocol: formData.protocol,
          admin_username: formData.admin_username,
          config_path: formData.config_path,
          notes: formData.notes,
          internal_notes: formData.internal_notes,
          additional_info: formData.additional_info,
          warranty_expires_at: formData.warranty_expires_at || null,
          custom_fields: formData.custom_fields || {}
        });

        // Se o técnico informou senha no cadastro, salva no Cofre com AES-256-GCM
        if (formData.admin_password.trim() && savedEquipment?.id) {
          try {
            await api.createCredential({
              client_id: clientId,
              equipment_id: savedEquipment.id,
              name: `Acesso Admin - ${formData.name}`,
              category: 'equipamento',
              username: formData.admin_username || 'admin',
              password: formData.admin_password,
              access_url: `${formData.protocol}://${formData.local_ip}`,
              port: Number(formData.management_port) || 80,
              notes: 'Cadastrado junto com o equipamento'
            });
          } catch (credErr) {
            console.error('Aviso ao cadastrar credencial:', credErr);
          }
        }
      }

      // Se a opção de salvar no Catálogo estiver marcada, salva o modelo no catálogo para uso futuro
      if (saveToCatalog && formData.model.trim()) {
        const mfg = formData.manufacturer.trim() || 'Genérico';
        const mdl = formData.model.trim();
        const alreadyInCatalog = catalog.some(
          c => c.model.toLowerCase() === mdl.toLowerCase() &&
               c.manufacturer.toLowerCase() === mfg.toLowerCase()
        );

        if (!alreadyInCatalog) {
          try {
            await api.createEquipmentCatalogItem({
              name: `${mfg} ${mdl}`.trim() || formData.name,
              category: formData.category,
              manufacturer: mfg,
              model: mdl,
              default_management_port: Number(formData.management_port) || 80,
              default_protocol: formData.protocol,
              default_username: formData.admin_username || 'admin',
              default_config_path: formData.config_path || '',
              photo_url: formData.photo_url || '',
              notes: formData.notes ? `Cadastrado na instalação: ${formData.notes}` : 'Cadastrado sob demanda'
            });
            await loadCatalog();
          } catch (catErr) {
            console.warn('Aviso ao registrar novo modelo no catálogo:', catErr);
          }
        }
      }

      sessionStorage.removeItem(`rededoc_draft_eq_${clientId}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao salvar equipamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'router_ont': return <RouterIcon className="w-4 h-4 text-blue-400" />;
      case 'facial_access': return <ScanFace className="w-4 h-4 text-cyan-400" />;
      case 'module_gate': return <DoorOpen className="w-4 h-4 text-amber-400" />;
      case 'dvr_nvr': return <Camera className="w-4 h-4 text-rose-400" />;
      case 'switch': return <Layers className="w-4 h-4 text-emerald-400" />;
      case 'access_point': return <Wifi className="w-4 h-4 text-purple-400" />;
      default: return <Server className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="p-5 border-b border-[#1E3150] flex items-center justify-between bg-[#0C1525]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {equipmentToEdit ? 'Editar Equipamento' : 'Adicionar Equipamento no Condomínio'}
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {equipmentToEdit ? 'Edição' : 'Catálogo Integrado'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Selecione o modelo no catálogo para auto-preenchimento ou personalize os parâmetros de rede.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1A2C49] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SEÇÃO 1: CATÁLOGO / BANCO DE EQUIPAMENTOS (Exibido para novo ou troca) */}
          {!equipmentToEdit && (
            <div className="bg-[#0C1525] border border-[#1E3150] rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Catálogo de Equipamentos Pré-configurados
                  </span>
                  <span className="text-[10px] text-slate-400">({filteredCatalog.length} modelos disponíveis)</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Buscar modelo ou fabricante..."
                      className="w-full bg-[#101C31] border border-[#24375A] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenNewModelModal(catalogSearch)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition shrink-0"
                    title="Criar novo modelo para o catálogo agora"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Novo Modelo</span>
                  </button>
                </div>
              </div>

              {/* Filtro por Categoria de Catálogo */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'router_ont', label: 'Roteadores/ONTs' },
                  { id: 'facial_access', label: 'Faciais' },
                  { id: 'module_gate', label: 'Portões/Nice' },
                  { id: 'dvr_nvr', label: 'DVRs/CFTV' },
                  { id: 'switch', label: 'Switches' },
                  { id: 'access_point', label: 'Access Points' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-md shrink-0 transition font-medium ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-[#101C31] text-slate-400 hover:text-slate-200 hover:bg-[#15253F]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Cards de Modelos do Catálogo no Estilo Vitrine Control iD */}
              {filteredCatalog.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-blue-500/40 bg-blue-500/5 text-center space-y-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </div>
                  <div className="text-xs font-bold text-white">
                    {catalogSearch.trim()
                      ? `Nenhum modelo "${catalogSearch}" encontrado no catálogo`
                      : 'Nenhum equipamento cadastrado nesta categoria'}
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    Não tem problema! Você pode cadastrar este modelo agora mesmo e ele será salvo no catálogo para as próximas vezes.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenNewModelModal(catalogSearch)}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Criar "{catalogSearch || 'Novo Modelo'}" no Catálogo</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {filteredCatalog.map(item => {
                    const isSelected = selectedCatalogItem?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectCatalogItem(item)}
                        className={`group p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between text-left relative overflow-hidden ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 shadow-lg ring-1 ring-blue-500'
                            : 'bg-[#0f1b2f] border-[#1c2c46] hover:border-blue-500/60 hover:bg-[#14233c]'
                        }`}
                      >
                        {/* Vitrine Estúdio do Produto (Estilo Control iD) */}
                        <div className="relative w-full h-24 rounded-lg bg-gradient-to-b from-[#13233c]/80 via-[#0a1424] to-[#060b13] border border-[#1e3252] p-2 flex items-center justify-center overflow-hidden mb-2 shadow-inner">
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none" />
                          {item.photo_url ? (
                            <img
                              src={item.photo_url}
                              alt={item.name}
                              className="relative z-10 max-h-full max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] transition-transform duration-200 group-hover:scale-105 select-none"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
                              {getCategoryIcon(item.category)}
                            </div>
                          )}
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm border border-slate-700/60 text-[9px] font-semibold text-slate-300">
                            {item.manufacturer}
                          </div>
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        {/* Dados do Modelo */}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-100 group-hover:text-blue-300 transition-colors line-clamp-1">
                              {item.model}
                            </div>
                            <div className="text-[10px] text-slate-400 line-clamp-1">
                              {item.name.replace(`${item.manufacturer} `, '')}
                            </div>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-[#1C2C46] flex items-center justify-between text-[10px] text-slate-400">
                            <span>Porta <strong className="text-slate-300">{item.default_management_port}</strong></span>
                            <span className={`font-semibold ${isSelected ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-400'}`}>
                              {isSelected ? 'Ativo' : 'Usar'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedCatalogItem && (
                <div className="mt-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                    <span>
                      Modelo <strong>{selectedCatalogItem.model} ({selectedCatalogItem.manufacturer})</strong> selecionado do catálogo. Portas e protocolos foram preenchidos.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCatalogItem(null)}
                    className="text-[11px] underline hover:text-white"
                  >
                    Trocar / Limpar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SEÇÃO 2: DADOS OBRIGATÓRIOS DA INSTALAÇÃO (MAC, SERIAL, IP, LOCALIZAÇÃO) */}
          <form id="equipment-form" onSubmit={handleSubmit} className="space-y-5 text-xs">
            <div className="p-4 bg-[#0C1525] border border-amber-500/30 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                <span>⚡ Dados Físicos da Instalação no Cliente (Definição Individual)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Estes são os dados únicos deste aparelho físico instalado no condomínio.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* MAC Address */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold block">
                      Endereço MAC <span className="text-amber-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setScannerTarget('mac')}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition"
                      title="Escanear etiqueta de MAC com a câmera"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>Escanear Câmera</span>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Ex: 00:1A:2B:3C:4D:5E"
                      value={formData.mac_address}
                      onChange={(e) => setFormData(p => ({ ...p, mac_address: e.target.value.toUpperCase() }))}
                      className="w-full bg-[#101C31] border border-[#24375A] focus:border-amber-400 rounded-lg px-3 py-2 text-amber-300 font-mono font-semibold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setScannerTarget('mac')}
                      className="px-3 py-2 rounded-lg bg-[#182845] hover:bg-[#20365D] border border-amber-500/30 text-amber-300 shrink-0 transition"
                      title="Abrir leitor de código de barras / QR Code para MAC"
                    >
                      <Scan className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Para reserva de IP e rastreio</span>
                </div>

                {/* Número de Série */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold block">
                      Número de Série (Serial) <span className="text-amber-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setScannerTarget('serial')}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition"
                      title="Escanear etiqueta de Serial com a câmera"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>Escanear Câmera</span>
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Ex: SN-2026-X8890"
                      value={formData.serial_number}
                      onChange={(e) => setFormData(p => ({ ...p, serial_number: e.target.value }))}
                      className="w-full bg-[#101C31] border border-[#24375A] focus:border-amber-400 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setScannerTarget('serial')}
                      className="px-3 py-2 rounded-lg bg-[#182845] hover:bg-[#20365D] border border-blue-500/30 text-blue-300 shrink-0 transition"
                      title="Abrir leitor de código de barras / QR Code para Serial"
                    >
                      <Scan className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Etiqueta do fabricante</span>
                </div>

                {/* IP Local */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold block">
                      Endereço IP Local <span className="text-emerald-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleSuggestNextFreeIp}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono font-medium transition"
                      title="Preencher com o próximo IP livre da sub-rede do condomínio"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>Usar próximo livre</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 192.168.1.50"
                    value={formData.local_ip}
                    onChange={(e) => setFormData(p => ({ ...p, local_ip: e.target.value }))}
                    className={`w-full bg-[#101C31] border ${
                      ipConflictWarning ? 'border-rose-500 focus:border-rose-400 text-rose-300' : 'border-[#24375A] focus:border-emerald-400 text-emerald-400'
                    } rounded-lg px-3 py-2 font-mono font-bold focus:outline-none`}
                  />
                  {ipConflictWarning ? (
                    <span className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {ipConflictWarning}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 mt-0.5 block">IP interno na sub-rede</span>
                  )}
                </div>

                {/* Localização Física no Condomínio */}
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Localização Física <span className="text-blue-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Guarita, Portão 1, Rack TI"
                    value={formData.physical_location}
                    onChange={(e) => setFormData(p => ({ ...p, physical_location: e.target.value }))}
                    className="w-full bg-[#101C31] border border-[#24375A] focus:border-blue-400 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Onde está fisicamente</span>
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: IDENTIFICAÇÃO E MODELO */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Nome de Identificação no Sistema *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: FACIAL-PORTARIA, DVR-GARAGEM"
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Categoria de Equipamento *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="router_ont">Roteador / ONT</option>
                  <option value="facial_access">Terminal Facial / Acesso</option>
                  <option value="module_gate">Módulo de Guarita / Portão</option>
                  <option value="dvr_nvr">DVR / NVR (CFTV)</option>
                  <option value="ip_camera">Câmera IP</option>
                  <option value="switch">Switch de Rede</option>
                  <option value="access_point">Access Point (Wi-Fi)</option>
                  <option value="server">Servidor</option>
                  <option value="computer">Computador / Terminal</option>
                  <option value="other">Outro Equipamento</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Unidade / Local do Cliente</label>
                <select
                  value={formData.location_id}
                  onChange={(e) => setFormData(p => ({ ...p, location_id: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {locations.length > 0 ? (
                    locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))
                  ) : (
                    <option value={locationId}>Local Padrão</option>
                  )}
                </select>
              </div>
            </div>

            {/* SEÇÃO 4: FOTOGRAFIA DO EQUIPAMENTO (WEB OU DISPOSITIVO) */}
            <div className="p-4 bg-[#0C1525] border border-[#24375A] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-slate-200 font-bold block flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-400" />
                    <span>Fotografia do Equipamento (Catálogo / Web ou Foto Real)</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    A foto é exibida no painel do cliente, na topologia da rede e no relatório técnico em PDF.
                  </p>
                </div>

                {isUploadingPhoto && (
                  <span className="text-xs text-blue-400 flex items-center gap-1.5 animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enviando foto...
                  </span>
                )}
              </div>

              {formData.photo_url ? (
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#101C31] p-3.5 rounded-xl border border-[#1A2C49]">
                  {/* Vitrine Estúdio do Equipamento */}
                  <div className="relative w-36 h-32 rounded-xl bg-gradient-to-b from-[#13233c] via-[#0c1626] to-[#070d18] border border-[#223659] p-2.5 flex items-center justify-center shrink-0 overflow-hidden shadow-inner group">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent pointer-events-none"></div>
                    <img
                      src={formData.photo_url}
                      alt="Foto do equipamento"
                      className="relative z-10 max-h-full max-w-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.65)] select-none transition-transform duration-200 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLElement).style.opacity = '0.3';
                      }}
                    />
                  </div>

                  <div className="flex-1 space-y-2 text-left w-full sm:w-auto">
                    <div className="text-xs text-slate-200 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Fotografia vinculada e ajustada</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate max-w-md">
                      {formData.photo_url}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleRemoveBackground}
                        disabled={isRemovingBg}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                        title="Remove o fundo com algoritmo adaptativo (fundo claro, escuro ou estúdio, preservando antenas e plásticos brancos)"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>{isRemovingBg ? 'Processando...' : '✨ Apagar Fundo'}</span>
                      </button>

                      {originalPhotoUrl && originalPhotoUrl !== formData.photo_url && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, photo_url: originalPhotoUrl }))}
                          className="px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                          title="Restaura a fotografia original enviada antes da remoção de fundo"
                        >
                          <Undo2 className="w-3.5 h-3.5 text-slate-300" />
                          <span>Restaurar Foto Original</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsImageSearchOpen(true)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Trocar no Google</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-[#182845] hover:bg-[#20365D] text-slate-200 border border-[#253A61] text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-400" />
                        <span>Enviar do Computador</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition"
                        title="Remover foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-[#24375A] hover:border-blue-500/60 rounded-xl p-4 text-center bg-[#101C31]/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-2">
                    <ImageIcon className="w-5 h-5 text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-300 font-medium mb-1">
                    Nenhuma foto cadastrada para este dispositivo
                  </p>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Você pode pesquisar o modelo comercial na web ou anexar uma fotografia tirada do aparelho físico.
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsImageSearchOpen(true)}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>⚡ Buscar Foto no Google</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg bg-[#182845] hover:bg-[#20365D] text-slate-200 border border-[#273E66] font-semibold text-xs flex items-center gap-2 transition"
                    >
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span>📁 Upload Foto Local / Câmera</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Input escondido para upload de arquivo */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadPhotoFile}
                className="hidden"
              />
            </div>

            {/* SEÇÃO 5: DETALHES DE REDE E GERENCIAMENTO */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#0C1525] p-3.5 rounded-xl border border-[#1E3150]">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Fabricante</label>
                <input
                  type="text"
                  placeholder="Ex: Huawei, Control iD, Nice"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData(p => ({ ...p, manufacturer: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Modelo Comercial</label>
                <input
                  type="text"
                  placeholder="Ex: HG8145X6, iDFace Max"
                  value={formData.model}
                  onChange={(e) => setFormData(p => ({ ...p, model: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Porta de Acesso</label>
                <input
                  type="number"
                  placeholder="80"
                  value={formData.management_port}
                  onChange={(e) => setFormData(p => ({ ...p, management_port: Number(e.target.value) || 80 }))}
                  className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Protocolo</label>
                <select
                  value={formData.protocol}
                  onChange={(e) => setFormData(p => ({ ...p, protocol: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="ssh">SSH</option>
                  <option value="winbox">Winbox</option>
                </select>
              </div>

              {/* Gateway e Máscara */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Gateway Padrão</label>
                <input
                  type="text"
                  value={formData.gateway}
                  onChange={(e) => updateFormData('gateway', e.target.value)}
                  className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              {/* Parâmetros WAN e DNS para Roteadores / ONTs */}
              {formData.category === 'router_ont' && (
                <>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">IP WAN (Público Dedicado)</label>
                    <input
                      type="text"
                      placeholder="Ex: 45.234.150.226"
                      value={formData.public_wan_ip}
                      onChange={(e) => updateFormData('public_wan_ip', e.target.value)}
                      className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Máscara de Sub-rede</label>
                    <input
                      type="text"
                      placeholder="255.255.255.0"
                      value={formData.subnet_mask}
                      onChange={(e) => updateFormData('subnet_mask', e.target.value)}
                      className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">DNS Primário</label>
                    <input
                      type="text"
                      placeholder="Ex: 1.1.1.1 ou IP de DNS"
                      value={formData.primary_dns}
                      onChange={(e) => updateFormData('primary_dns', e.target.value)}
                      className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">DNS Secundário</label>
                    <input
                      type="text"
                      placeholder="Ex: 1.0.0.1 ou secundário"
                      value={formData.secondary_dns}
                      onChange={(e) => updateFormData('secondary_dns', e.target.value)}
                      className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <label className="text-slate-300 font-semibold block mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        Faixa de Concessão DHCP
                      </span>
                      <span className="text-[10px] text-amber-400 font-normal">Ex: 192.168.1.100 - 192.168.1.200</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 192.168.1.100 - 192.168.1.200 ou 192.168.1.100-199"
                      value={formData.dhcp_range}
                      onChange={(e) => updateFormData('dhcp_range', e.target.value)}
                      className="w-full bg-[#101C31] border border-[#24375A] focus:border-amber-400 rounded-lg px-3 py-1.5 text-amber-300 font-mono focus:outline-none placeholder:text-slate-600"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Reserva de IP por MAC?</label>
                <div className="flex items-center gap-2 mt-1.5">
                  <input
                    type="checkbox"
                    id="is_mac_reserved"
                    checked={formData.is_mac_reserved === 1}
                    onChange={(e) => setFormData(p => ({ ...p, is_mac_reserved: e.target.checked ? 1 : 0 }))}
                    className="w-4 h-4 rounded text-blue-600 bg-[#101C31] border-[#24375A] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="is_mac_reserved" className="text-xs text-slate-300 cursor-pointer">
                    IP reservado no DHCP
                  </label>
                </div>
              </div>

              {/* Usuário e Senha de Acesso */}
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Usuário de Acesso</label>
                <input
                  type="text"
                  placeholder="admin"
                  value={formData.admin_username}
                  onChange={(e) => setFormData(p => ({ ...p, admin_username: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1 flex items-center justify-between">
                  <span>Senha (Cofre AES-256)</span>
                  {equipmentToEdit && (
                    <span className="text-[10px] text-slate-400 font-normal">Em branco mantém a atual</span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder={equipmentToEdit ? '•••••••• (digite para alterar no cofre)' : 'Opcional: guardar no cofre'}
                  value={formData.admin_password}
                  onChange={(e) => setFormData(p => ({ ...p, admin_password: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] focus:border-blue-500 rounded-lg px-3 py-1.5 text-slate-200 font-mono focus:outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Caminho de Configuração e Observações Técnicas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Caminho de Configuração no Roteador / Dispositivo</label>
                <input
                  type="text"
                  placeholder="Ex: Avançado > NAT > Redirecionamento de Portas"
                  value={formData.config_path}
                  onChange={(e) => setFormData(p => ({ ...p, config_path: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Observações Técnicas da Instalação</label>
                <input
                  type="text"
                  placeholder="Ex: Porta de pedestres conectada ao relé 1 da guarita"
                  value={formData.notes}
                  onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>
            </div>

            {/* Vencimento da Garantia (Fase 3 - Vencimentos e Alertas) */}
            <div className="bg-[#0C1525] p-3.5 rounded-xl border border-amber-500/30 space-y-1.5">
              <label className="text-amber-300 font-semibold block text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Validade da Garantia do Fabricante</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <input
                  type="date"
                  value={formData.warranty_expires_at || ''}
                  onChange={(e) => setFormData(p => ({ ...p, warranty_expires_at: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] focus:border-amber-400 rounded-lg px-3 py-1.5 text-amber-200 text-xs font-mono focus:outline-none"
                />
                <span className="text-[11px] text-slate-400">
                  Monitoramento proativo com alertas aos 30 e 7 dias antes do término da garantia.
                </span>
              </div>
            </div>

            {/* Campos Dinâmicos do Modelo de Hardware (Fase 8) */}
            {activeTemplate && activeTemplate.fields.length > 0 && (
              <div className="bg-[#0C1525] p-4 rounded-xl border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-500/20">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">
                      Campos do Modelo ({activeTemplate.name})
                    </span>
                  </div>
                  <span className="text-[10px] text-indigo-300 font-mono">
                    {activeTemplate.fields.length} campos específicos
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeTemplate.fields.map(field => {
                    const value = formData.custom_fields?.[field.key];
                    return (
                      <div key={field.key} className={field.type === 'boolean' ? 'sm:col-span-2' : ''}>
                        <label className="text-slate-300 font-semibold block text-xs mb-1">
                          {field.label} {field.required && <span className="text-rose-400">*</span>}
                        </label>

                        {field.type === 'select' ? (
                          <select
                            value={value || ''}
                            onChange={(e) => setFormData(p => ({
                              ...p,
                              custom_fields: { ...(p.custom_fields || {}), [field.key]: e.target.value }
                            }))}
                            className="w-full bg-[#101C31] border border-[#24375A] focus:border-indigo-500 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none"
                          >
                            <option value="">Selecione uma opção...</option>
                            {(field.options || []).map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === 'boolean' ? (
                          <label className="flex items-center gap-2 cursor-pointer pt-1 select-none">
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(e) => setFormData(p => ({
                                ...p,
                                custom_fields: { ...(p.custom_fields || {}), [field.key]: e.target.checked }
                              }))}
                              className="w-4 h-4 rounded text-indigo-600 bg-[#101C31] border-[#24375A] focus:ring-0 cursor-pointer"
                            />
                            <span className="text-xs text-slate-300 font-medium">{field.label}</span>
                          </label>
                        ) : field.type === 'number' ? (
                          <input
                            type="number"
                            placeholder="0"
                            value={value ?? ''}
                            onChange={(e) => setFormData(p => ({
                              ...p,
                              custom_fields: { ...(p.custom_fields || {}), [field.key]: e.target.value === '' ? '' : Number(e.target.value) }
                            }))}
                            className="w-full bg-[#101C31] border border-[#24375A] focus:border-indigo-500 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none"
                          />
                        ) : field.type === 'date' ? (
                          <input
                            type="date"
                            value={value || ''}
                            onChange={(e) => setFormData(p => ({
                              ...p,
                              custom_fields: { ...(p.custom_fields || {}), [field.key]: e.target.value }
                            }))}
                            className="w-full bg-[#101C31] border border-[#24375A] focus:border-indigo-500 rounded-lg px-3 py-1.5 text-slate-200 text-xs font-mono focus:outline-none"
                          />
                        ) : (
                          <input
                            type="text"
                            placeholder={field.type === 'ip' ? 'Ex: 192.168.1.10' : field.type === 'mac' ? 'Ex: 00:1A:2B:3C:4D:5E' : 'Preencher...'}
                            value={value || ''}
                            onChange={(e) => setFormData(p => ({
                              ...p,
                              custom_fields: { ...(p.custom_fields || {}), [field.key]: e.target.value }
                            }))}
                            className="w-full bg-[#101C31] border border-[#24375A] focus:border-indigo-500 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Informações Adicionais e Notas Internas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <span>Informações Adicionais (Geral / Fornecedor / Garantia)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Garantia até Nov/2027, NF 4429, Fornecedor Distribuidora Alfa, TAG Patrimônio #8812"
                  value={formData.additional_info}
                  onChange={(e) => setFormData(p => ({ ...p, additional_info: e.target.value }))}
                  className="w-full bg-[#101C31] border border-[#24375A] focus:border-blue-500 rounded-lg px-3 py-2 text-slate-200 focus:outline-none resize-none text-xs"
                />
              </div>

              <div>
                <label className="text-amber-300 font-semibold block mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Notas Internas & Dados Físicos (Restrito à Equipe Técnica)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Jumper 3 invertido na placa, pino de reset com solda fria, credencial secundária de console"
                  value={formData.internal_notes}
                  onChange={(e) => setFormData(p => ({ ...p, internal_notes: e.target.value }))}
                  className="w-full bg-[#101C31] border border-amber-500/30 focus:border-amber-400 rounded-lg px-3 py-2 text-amber-200/90 focus:outline-none resize-none text-xs"
                />
              </div>
            </div>
            {/* Opção para Salvar no Catálogo de Equipamentos para reutilização futura */}
            {!equipmentToEdit && (
              <div className="p-3.5 bg-gradient-to-r from-blue-950/40 via-[#0C1525] to-[#0C1525] border border-blue-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      <span>Salvar este equipamento no Catálogo para próximas vezes?</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-semibold">
                        Reutilizável
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      O modelo ({formData.model || 'equipamento'}) será memorizado com foto e portas padrão no catálogo para auto-preenchimento nos próximos clientes.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer shrink-0 select-none">
                  <input
                    type="checkbox"
                    checked={saveToCatalog}
                    onChange={(e) => setSaveToCatalog(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-[#101C31] border-[#24375A] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-blue-400">Salvar no Catálogo</span>
                </label>
              </div>
            )}
          </form>
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="p-4 border-t border-[#1E3150] bg-[#0C1525] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Dados auditados e registrados na linha do tempo técnica.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-[#16253E] hover:bg-[#1E3150] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="equipment-form"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{equipmentToEdit ? 'Atualizar Equipamento' : 'Salvar Equipamento no Condomínio'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Busca Inteligente de Fotos na Web */}
      <ImageSearchModal
        isOpen={isImageSearchOpen}
        onClose={() => setIsImageSearchOpen(false)}
        initialQuery={`${formData.manufacturer} ${formData.model}`.trim() || formData.name}
        title={`Buscar Foto: ${formData.model || formData.name || 'Equipamento'}`}
        clientId={clientId}
        equipmentId={equipmentToEdit?.id}
        onSelectImage={handleSelectPhotoFromWeb}
      />

      {/* MODAL: Cadastrar Novo Modelo no Catálogo Geral */}
      {isNewModelModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsNewModelModalOpen(false); }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cadastrar Novo Modelo no Catálogo</h3>
                  <p className="text-[11px] text-slate-400">
                    Ficará disponível no banco de modelos para todos os condomínios
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModelModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1A2C49] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewModelSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Fabricante *</label>
                  <input
                    type="text"
                    required
                    value={newModelForm.manufacturer}
                    onChange={(e) => setNewModelForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                    placeholder="Ex: Intelbras, Huawei, TP-Link..."
                    className="w-full bg-[#0A1220] border border-[#203456] rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Modelo Exato *</label>
                  <input
                    type="text"
                    required
                    value={newModelForm.model}
                    onChange={(e) => setNewModelForm(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="Ex: SS 3540 MF Face, EG8145V5..."
                    className="w-full bg-[#0A1220] border border-[#203456] rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Nome Comercial / Descritivo</label>
                <input
                  type="text"
                  value={newModelForm.name}
                  onChange={(e) => setNewModelForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Intelbras Facial SS 3540 MF Face"
                  className="w-full bg-[#0A1220] border border-[#203456] rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">Categoria *</label>
                  <select
                    value={newModelForm.category}
                    onChange={(e) => setNewModelForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-[#0A1220] border border-[#203456] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="router_ont">Roteador / ONT / Modem</option>
                    <option value="facial_access">Reconhecimento Facial / Acesso</option>
                    <option value="module_gate">Controladora / Módulo Guarita (Nice/Linear)</option>
                    <option value="dvr_nvr">DVR / NVR / Câmeras CFTV</option>
                    <option value="switch">Switch Gerenciável / VLAN</option>
                    <option value="access_point">Access Point / Wi-Fi</option>
                    <option value="intercom">Interfonia / Telefonia IP</option>
                    <option value="other">Outros Equipamentos</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Porta Padrão</label>
                    <input
                      type="number"
                      value={newModelForm.default_management_port}
                      onChange={(e) => setNewModelForm(prev => ({ ...prev, default_management_port: Number(e.target.value) || 80 }))}
                      className="w-full bg-[#0A1220] border border-[#203456] rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">Protocolo</label>
                    <select
                      value={newModelForm.default_protocol}
                      onChange={(e) => setNewModelForm(prev => ({ ...prev, default_protocol: e.target.value }))}
                      className="w-full bg-[#0A1220] border border-[#203456] rounded-lg px-2 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                      <option value="ssh">SSH</option>
                      <option value="telnet">Telnet</option>
                      <option value="rtsp">RTSP</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Foto do Modelo com Busca Web Integrada */}
              <div className="space-y-1.5 p-3 rounded-xl bg-[#0A1220] border border-[#203456]">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                  <span>Foto do Modelo</span>
                  <button
                    type="button"
                    onClick={() => setIsNewModelImageSearchOpen(true)}
                    className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-semibold hover:underline"
                  >
                    <Search className="w-3 h-3" />
                    Buscar Foto no Google
                  </button>
                </label>

                {newModelForm.photo_url ? (
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-b from-[#13233c] via-[#0c1626] to-[#070d18] border border-[#203456] p-1.5 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                      <img
                        src={newModelForm.photo_url}
                        alt="Preview"
                        className="max-h-full max-w-full object-contain filter drop-shadow-md select-none"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Foto Selecionada
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewModelForm(prev => ({ ...prev, photo_url: '' }))}
                        className="text-[10px] text-rose-400 hover:text-rose-300 mt-1"
                      >
                        Remover Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Nenhuma foto vinculada. Clique em "Buscar Foto no Google" para buscar automaticamente.</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">Observações Técnicas / Portas Típicas</label>
                <textarea
                  rows={2}
                  value={newModelForm.notes}
                  onChange={(e) => setNewModelForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ex: Porta SDK 8000, RTSP 554, HTTP 80..."
                  className="w-full bg-[#0A1220] border border-[#203456] rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#1D3054]">
                <button
                  type="button"
                  onClick={() => setIsNewModelModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingNewModel}
                  className="px-5 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition flex items-center gap-2"
                >
                  {isSavingNewModel ? (
                    <span>Salvando no Catálogo...</span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Salvar no Catálogo e Selecionar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Busca no Google para o Novo Modelo */}
      <ImageSearchModal
        isOpen={isNewModelImageSearchOpen}
        onClose={() => setIsNewModelImageSearchOpen(false)}
        initialQuery={`${newModelForm.manufacturer} ${newModelForm.model}`.trim() || newModelForm.name}
        title={`Buscar Foto: ${newModelForm.model || newModelForm.name || 'Novo Modelo'}`}
        clientId={clientId}
        onSelectImage={(localUrl) => {
          setNewModelForm(prev => ({ ...prev, photo_url: localUrl }));
          setIsNewModelImageSearchOpen(false);
        }}
      />

      {/* Modal: Leitor de Código de Barras / QR Code pela Câmera */}
      <BarcodeScannerModal
        isOpen={scannerTarget !== null}
        onClose={() => setScannerTarget(null)}
        targetField={scannerTarget || 'any'}
        title={scannerTarget === 'mac' ? 'Escanear MAC Address da Etiqueta' : 'Escanear Número de Série (S/N)'}
        onScan={(value) => {
          if (scannerTarget === 'mac') {
            setFormData(prev => ({ ...prev, mac_address: value }));
            showToast(`MAC Address escaneado: ${value}`, 'success');
          } else if (scannerTarget === 'serial') {
            setFormData(prev => ({ ...prev, serial_number: value }));
            showToast(`Número de Série escaneado: ${value}`, 'success');
          }
          setScannerTarget(null);
        }}
      />
    </div>
  );
};

