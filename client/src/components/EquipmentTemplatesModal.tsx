import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit,
  X,
  CheckCircle2,
  Layers,
  Save,
  HelpCircle
} from 'lucide-react';
import { EquipmentTemplate, EquipmentFieldDefinition, EquipmentFieldType } from '../types';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';

interface EquipmentTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EquipmentTemplatesModal: React.FC<EquipmentTemplatesModalProps> = ({
  isOpen,
  onClose
}) => {
  const { showToast, confirm } = useDialog();

  const [templates, setTemplates] = useState<EquipmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modo de Edição / Criação de Modelo
  const [editingTemplate, setEditingTemplate] = useState<EquipmentTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: 'facial_access',
    name: '',
    fields: [] as EquipmentFieldDefinition[]
  });

  // Novo campo sendo adicionado ao modelo atual
  const [newField, setNewField] = useState<EquipmentFieldDefinition>({
    key: '',
    label: '',
    type: 'text',
    required: false,
    options: []
  });
  const [newOptionsText, setNewOptionsText] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await api.getEquipmentTemplates();
      setTemplates(data);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar modelos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNew = () => {
    setEditingTemplate(null);
    setFormData({
      category: 'facial_access',
      name: '',
      fields: []
    });
    setNewField({ key: '', label: '', type: 'text', required: false, options: [] });
    setNewOptionsText('');
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (t: EquipmentTemplate) => {
    setEditingTemplate(t);
    setFormData({
      category: t.category,
      name: t.name,
      fields: [...t.fields]
    });
    setNewField({ key: '', label: '', type: 'text', required: false, options: [] });
    setNewOptionsText('');
    setIsEditorOpen(true);
  };

  const handleAddField = () => {
    const cleanKey = newField.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanKey) {
      showToast('A chave técnica do campo é obrigatória (ex: versao_firmware).', 'warning');
      return;
    }
    if (!newField.label.trim()) {
      showToast('O rótulo de exibição é obrigatório.', 'warning');
      return;
    }

    if (cleanKey.includes('password') || cleanKey.includes('senha') || (newField.type as string) === 'password') {
      showToast('Campos de senha não são permitidos. Credenciais pertencem ao cofre criptografado.', 'error');
      return;
    }

    if (formData.fields.some(f => f.key === cleanKey)) {
      showToast('Já existe um campo com esta chave técnica neste modelo.', 'warning');
      return;
    }

    const options = newField.type === 'select'
      ? newOptionsText.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    setFormData(prev => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          key: cleanKey,
          label: newField.label.trim(),
          type: newField.type,
          required: Boolean(newField.required),
          options
        }
      ]
    }));

    setNewField({ key: '', label: '', type: 'text', required: false, options: [] });
    setNewOptionsText('');
  };

  const handleRemoveField = (key: string) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.key !== key)
    }));
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.category) {
      showToast('Nome do modelo e categoria são obrigatórios.', 'warning');
      return;
    }

    try {
      if (editingTemplate) {
        await api.updateEquipmentTemplate(editingTemplate.id, formData);
        showToast('Modelo atualizado com sucesso!', 'success');
      } else {
        await api.createEquipmentTemplate(formData);
        showToast('Modelo criado com sucesso!', 'success');
      }
      setIsEditorOpen(false);
      loadTemplates();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar modelo.', 'error');
    }
  };

  const handleDeleteTemplate = (t: EquipmentTemplate) => {
    confirm({
      title: 'Excluir Modelo',
      message: `Deseja realmente remover o modelo "${t.name}"? Os equipamentos cadastrados manterão seus dados, mas novos cadastros não verão mais este modelo.`,
      confirmText: 'Excluir',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteEquipmentTemplate(t.id);
          showToast('Modelo removido com sucesso.', 'info');
          loadTemplates();
        } catch (err: any) {
          showToast(err.message || 'Erro ao excluir modelo.', 'error');
        }
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-[#0F172A] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fadeIn">
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Modelos por Tipo de Equipamento</h3>
              <p className="text-xs text-slate-400">Definição de campos dinâmicos e especificações por categoria</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditorOpen && (
              <button
                onClick={handleOpenNew}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Modelo</span>
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {isEditorOpen ? (
            /* Formulário de Edição do Modelo */
            <form onSubmit={handleSaveTemplate} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nome do Modelo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Terminal Facial Avançado"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Categoria de Hardware *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="facial_access">Reconhecimento Facial</option>
                    <option value="cctv_dvr">CFTV / Câmeras / DVR</option>
                    <option value="router_ont">Roteador Gateway / ONT</option>
                    <option value="gate_module">Módulo de Portão / Guarita</option>
                    <option value="switch">Switch de Rede</option>
                    <option value="access_point">Access Point Wi-Fi</option>
                    <option value="intercom">Interfonia / VoIP</option>
                    <option value="alarm">Alarme / Cerca</option>
                    <option value="ups">Nobreak / Energia</option>
                  </select>
                </div>
              </div>

              {/* Lista de Campos do Modelo */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    Campos Definidos ({formData.fields.length})
                  </span>
                  <span className="text-[11px] text-slate-400">Campos de senha são proibidos</span>
                </div>

                {formData.fields.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#0B132B] border border-slate-800 text-center text-slate-400 text-xs">
                    Nenhum campo adicionado a este modelo ainda.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.fields.map(field => (
                      <div
                        key={field.key}
                        className="p-2.5 rounded-xl bg-[#0B132B] border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{field.label}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300">
                              {field.key}
                            </span>
                            {field.required && (
                              <span className="text-[9px] uppercase font-bold text-rose-400 bg-rose-500/10 px-1.5 rounded">
                                Obrigatório
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Tipo: <strong className="text-slate-300 capitalize">{field.type}</strong>
                            {field.options && field.options.length > 0 && ` • Opções: ${field.options.join(', ')}`}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveField(field.key)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Remover Campo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Construtor para Adicionar Novo Campo */}
              <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-3">
                <span className="font-bold text-indigo-300 text-xs block">
                  + Adicionar Campo ao Modelo
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Chave Técnica *</label>
                    <input
                      type="text"
                      placeholder="Ex: firmware_version"
                      value={newField.key}
                      onChange={(e) => setNewField({ ...newField, key: e.target.value })}
                      className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Rótulo / Nome *</label>
                    <input
                      type="text"
                      placeholder="Ex: Versão de Firmware"
                      value={newField.label}
                      onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                      className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Tipo do Campo</label>
                    <select
                      value={newField.type}
                      onChange={(e) => setNewField({ ...newField, type: e.target.value as EquipmentFieldType })}
                      className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 text-xs"
                    >
                      <option value="text">Texto</option>
                      <option value="number">Número</option>
                      <option value="ip">Endereço IP</option>
                      <option value="mac">MAC Address</option>
                      <option value="select">Seleção (Lista de Opções)</option>
                      <option value="boolean">Sim / Não (Booleano)</option>
                      <option value="date">Data</option>
                    </select>
                  </div>
                </div>

                {newField.type === 'select' && (
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-0.5">Opções da Lista (separadas por vírgula)</label>
                    <input
                      type="text"
                      placeholder="Ex: 1080p Full HD, 4K Ultra HD, 5 MP"
                      value={newOptionsText}
                      onChange={(e) => setNewOptionsText(e.target.value)}
                      className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 text-xs"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 select-none">
                    <input
                      type="checkbox"
                      checked={newField.required}
                      onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                      className="w-3.5 h-3.5 rounded bg-[#0B132B] border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Campo Obrigatório</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleAddField}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
                  >
                    Adicionar Campo
                  </button>
                </div>
              </div>

              {/* Botões do Editor */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Modelo</span>
                </button>
              </div>
            </form>
          ) : (
            /* Lista de Modelos Existentes */
            <div className="space-y-3">
              {loading ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Carregando modelos...
                </div>
              ) : templates.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <p>Nenhum modelo customizado cadastrado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      className="p-4 rounded-xl bg-[#101C31] border border-[#1E3054] hover:border-indigo-500/50 transition flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                            {t.category.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {t.fields.length} campos
                          </span>
                        </div>

                        <h4 className="font-bold text-white text-sm mt-2">{t.name}</h4>

                        {t.fields.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {t.fields.map(f => (
                              <span
                                key={f.key}
                                className="text-[10px] px-1.5 py-0.2 rounded bg-[#0B1528] text-slate-300 border border-slate-800"
                              >
                                {f.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => handleOpenEdit(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                          title="Editar Modelo"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(t)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                          title="Excluir Modelo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

