import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Tag,
  Clock,
  User,
  History,
  Printer,
  Edit,
  Trash2,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  Globe,
  Building2,
  RotateCcw,
  Eye,
  FileCode,
  Shield,
  Layers,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Article, ArticleVersion, Client } from '../types';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { RelatedItems } from './RelatedItems';

interface KnowledgeBaseViewProps {
  client?: Client | null;
  clients?: Client[];
  targetArticleId?: string;
  onNavigateToTab?: (tab: string, entityId?: string) => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  client,
  clients = [],
  targetArticleId,
  onNavigateToTab
}) => {
  const { showToast, confirm } = useDialog();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<'all' | 'current' | 'global'>('all');

  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Formulário do editor
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editClientId, setEditClientId] = useState<string>('');
  const [editVisibleInPortal, setEditVisibleInPortal] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<'write' | 'preview'>('write');
  const [saving, setSaving] = useState(false);

  // Modal de Histórico de Versões
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedPreviewVersion, setSelectedPreviewVersion] = useState<ArticleVersion | null>(null);

  // Carrega lista de artigos
  const loadArticles = async () => {
    try {
      setLoading(true);
      // Busca todos os artigos relevantes
      const data = await api.getArticles(
        clientFilter === 'current' && client ? client.id : undefined,
        selectedTag !== 'all' ? selectedTag : undefined,
        searchTerm.trim() ? searchTerm.trim() : undefined
      );
      setArticles(data);

      // Se houver um targetArticleId, abre ele diretamente
      if (targetArticleId) {
        const found = data.find(a => a.id === targetArticleId);
        if (found) {
          setSelectedArticle(found);
        }
      } else if (!selectedArticle && data.length > 0) {
        setSelectedArticle(data[0]);
      } else if (selectedArticle) {
        const updated = data.find(a => a.id === selectedArticle.id);
        if (updated) setSelectedArticle(updated);
      }
    } catch (err: any) {
      showToast('Erro ao carregar procedimentos técnicos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();
  }, [client?.id, clientFilter, selectedTag]);

  // Sincroniza quando targetArticleId muda
  useEffect(() => {
    if (targetArticleId && articles.length > 0) {
      const found = articles.find(a => a.id === targetArticleId);
      if (found) {
        setSelectedArticle(found);
        setIsEditing(false);
        setIsCreating(false);
      }
    }
  }, [targetArticleId, articles]);

  // Lista de tags únicas
  const allTags = useMemo(() => {
    const set = new Set<string>();
    articles.forEach(a => {
      if (a.tags) {
        a.tags.split(',').forEach(t => {
          const clean = t.trim();
          if (clean) set.add(clean);
        });
      }
    });
    return Array.from(set).sort();
  }, [articles]);

  // Artigos filtrados no cliente (busca rápida em memória)
  const filteredArticles = useMemo(() => {
    return articles.filter(a => {
      if (clientFilter === 'current' && client && a.client_id !== client.id) return false;
      if (clientFilter === 'global' && a.client_id) return false;
      if (selectedTag !== 'all') {
        const tags = (a.tags || '').toLowerCase().split(',').map(s => s.trim());
        if (!tags.includes(selectedTag.toLowerCase())) return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTitle = a.title.toLowerCase().includes(q);
        const matchBody = a.body_md.toLowerCase().includes(q);
        const matchTags = (a.tags || '').toLowerCase().includes(q);
        return matchTitle || matchBody || matchTags;
      }
      return true;
    });
  }, [articles, clientFilter, client, selectedTag, searchTerm]);

  // Renderizador seguro de Markdown
  const renderSafeMarkdown = (content: string) => {
    try {
      const rawHtml = marked.parse(content || '') as string;
      return DOMPurify.sanitize(rawHtml);
    } catch {
      return '<p class="text-rose-400">Erro ao renderizar o documento Markdown.</p>';
    }
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setIsEditing(false);
    setEditTitle('');
    setEditBody('# Procedimento: [Título]\n\n## 1. Objetivo\nDescreva aqui o propósito deste procedimento operacional.\n\n## 2. Pré-requisitos e Acessos\n- Equipamento envolvido:\n- IP de Acesso:\n- Credencial necessária:\n\n## 3. Passo a Passo\n1. Primeiro passo...\n2. Segundo passo...\n\n> [!NOTE]\n> Observações importantes para a equipe técnica.');
    setEditTags('');
    setEditClientId(client?.id || '');
    setEditVisibleInPortal(false);
    setActiveEditorTab('write');
  };

  const handleStartEdit = () => {
    if (!selectedArticle) return;
    setIsEditing(true);
    setIsCreating(false);
    setEditTitle(selectedArticle.title);
    setEditBody(selectedArticle.body_md);
    setEditTags(selectedArticle.tags || '');
    setEditClientId(selectedArticle.client_id || '');
    setEditVisibleInPortal(Boolean(selectedArticle.visible_in_portal));
    setActiveEditorTab('write');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsCreating(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      showToast('O título do procedimento é obrigatório.', 'error');
      return;
    }
    if (!editBody.trim()) {
      showToast('O conteúdo do procedimento não pode ficar vazio.', 'error');
      return;
    }

    try {
      setSaving(true);
      if (isCreating) {
        const created = await api.createArticle({
          title: editTitle.trim(),
          body_md: editBody,
          tags: editTags.trim() || undefined,
          client_id: editClientId || null,
          visible_in_portal: editVisibleInPortal ? 1 : 0
        });
        showToast('Procedimento criado com sucesso!', 'success');
        setIsCreating(false);
        await loadArticles();
        setSelectedArticle(created);
      } else if (isEditing && selectedArticle) {
        const updated = await api.updateArticle(selectedArticle.id, {
          title: editTitle.trim(),
          body_md: editBody,
          tags: editTags.trim() || undefined,
          client_id: editClientId || null,
          visible_in_portal: editVisibleInPortal ? 1 : 0
        });
        showToast(`Procedimento atualizado para a versão v${updated.version}!`, 'success');
        setIsEditing(false);
        await loadArticles();
        setSelectedArticle(updated);
      }
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar procedimento.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!selectedArticle) return;
    confirm({
      title: 'Excluir Procedimento',
      message: `Tem certeza que deseja excluir o procedimento "${selectedArticle.title}"? Todos os vínculos e versões históricas serão removidos permanentemente.`,
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteArticle(selectedArticle.id);
          showToast('Procedimento excluído com sucesso.', 'info');
          setSelectedArticle(null);
          await loadArticles();
        } catch (err: any) {
          showToast('Erro ao excluir procedimento.', 'error');
        }
      }
    });
  };

  const handleOpenVersions = async () => {
    if (!selectedArticle) return;
    try {
      setShowVersionsModal(true);
      setLoadingVersions(true);
      setSelectedPreviewVersion(null);
      const data = await api.getArticleVersions(selectedArticle.id);
      setVersions(data);
    } catch (err: any) {
      showToast('Erro ao carregar histórico de versões.', 'error');
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRestoreVersion = (ver: ArticleVersion) => {
    if (!selectedArticle) return;
    confirm({
      title: `Restaurar Versão v${ver.version}`,
      message: `Deseja restaurar o procedimento "${ver.title}" para o conteúdo da versão ${ver.version}? Uma nova versão com este conteúdo será salva no histórico.`,
      onConfirm: async () => {
        try {
          const restored = await api.restoreArticleVersion(selectedArticle.id, ver.version);
          showToast(`Procedimento restaurado com sucesso para v${restored.version}!`, 'success');
          setShowVersionsModal(false);
          await loadArticles();
          setSelectedArticle(restored);
        } catch (err: any) {
          showToast('Erro ao restaurar versão do procedimento.', 'error');
        }
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho de Navegação e Ações Rápidas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#1D3054] print:hidden">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/5">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Base de Conhecimento e Procedimentos
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Fase 2
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Instruções operacionais passo a passo, tutoriais de configuração de rede e histórico com versionamento.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleStartCreate}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Procedimento</span>
          </button>
        </div>
      </div>

      {/* Interface Principal: Duas Colunas (Lista na Esquerda + Leitor/Editor na Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA: Filtros e Lista de Artigos */}
        <div className={`lg:col-span-4 space-y-4 print:hidden ${isEditing || isCreating ? 'hidden lg:block' : ''}`}>
          {/* Caixa de Busca */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar título, tag ou conteúdo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#0b1528] border border-[#1b2b48] text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition"
            />
          </div>

          {/* Filtros por Escopo (Todos / Atual / Globais) */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#091122] border border-[#18263f] text-xs">
            <button
              onClick={() => setClientFilter('all')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition ${
                clientFilter === 'all'
                  ? 'bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({articles.length})
            </button>
            {client && (
              <button
                onClick={() => setClientFilter('current')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition ${
                  clientFilter === 'current'
                    ? 'bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Este Cliente
              </button>
            )}
            <button
              onClick={() => setClientFilter('global')}
              className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition ${
                clientFilter === 'global'
                  ? 'bg-blue-600/30 text-blue-300 font-semibold border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Globais
            </button>
          </div>

          {/* Filtro por Tags */}
          {allTags.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Filtrar por Tag
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedTag('all')}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                    selectedTag === 'all'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                      : 'bg-[#0b1528] text-slate-400 border-[#18263f] hover:text-slate-200'
                  }`}
                >
                  Todas
                </button>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag === selectedTag ? 'all' : tag)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                      selectedTag === tag
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold'
                        : 'bg-[#0b1528] text-slate-400 border-[#18263f] hover:text-slate-200'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lista de Artigos */}
          <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 scrollbar-thin">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Carregando procedimentos...
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#0b1528] border border-[#1b2b48] text-center space-y-2">
                <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-xs font-semibold text-slate-300">Nenhum procedimento encontrado</div>
                <div className="text-[11px] text-slate-500">
                  Crie um procedimento manual ou use o botão de importação.
                </div>
              </div>
            ) : (
              filteredArticles.map(art => {
                const isSelected = selectedArticle?.id === art.id && !isCreating;
                return (
                  <div
                    key={art.id}
                    onClick={() => {
                      setSelectedArticle(art);
                      setIsEditing(false);
                      setIsCreating(false);
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left relative ${
                      isSelected
                        ? 'bg-[#122240] border-cyan-500/50 shadow-md shadow-cyan-900/10'
                        : 'bg-[#0b1528] border-[#18263f] hover:border-slate-600 hover:bg-[#0e1b33]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug">
                        {art.title}
                      </h4>
                      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                        v{art.version || 1}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {art.client_id ? (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Building2 className="w-3 h-3 text-blue-400" />
                          <span>{art.client_name || 'Cliente'}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                          <Globe className="w-3 h-3" />
                          <span>Global</span>
                        </span>
                      )}

                      {art.tags && art.tags.split(',').slice(0, 3).map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60"
                        >
                          #{t.trim()}
                        </span>
                      ))}
                    </div>

                    <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-500" />
                        {art.updated_by || art.created_by || 'Técnico'}
                      </span>
                      <span>
                        {art.updated_at ? art.updated_at.slice(0, 10) : ''}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: Editor ou Leitor do Artigo */}
        <div className="lg:col-span-8 space-y-4">
          {isCreating || isEditing ? (
            /* MODO EDITOR */
            <form onSubmit={handleSave} className="p-5 rounded-2xl bg-[#0b1528] border border-[#1b2b48] space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#18263f]">
                <div className="flex items-center gap-2">
                  <Edit className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">
                    {isCreating ? 'Novo Procedimento Operacional' : `Editando: ${selectedArticle?.title}`}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  {/* Abas no Celular: Escrever vs Pré-visualizar */}
                  <div className="flex md:hidden items-center bg-[#070d1a] p-1 rounded-xl border border-[#18263f]">
                    <button
                      type="button"
                      onClick={() => setActiveEditorTab('write')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        activeEditorTab === 'write' ? 'bg-blue-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      Escrever
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEditorTab('preview')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        activeEditorTab === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      Visualizar
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Campos de Título e Metadados */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-8 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Título do Procedimento *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Reset e Configuração do Terminal Facial Control ID"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070d1a] border border-[#18263f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="md:col-span-4 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Vínculo de Cliente
                  </label>
                  <select
                    value={editClientId}
                    onChange={(e) => setEditClientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070d1a] border border-[#18263f] text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Artigo Global (Todos os Clientes)</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    {client && !clients.some(c => c.id === client.id) && (
                      <option value={client.id}>{client.name}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Tags e Visibilidade no Portal */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-8 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Tags (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: facial, control_id, reset, cftv"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#070d1a] border border-[#18263f] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="md:col-span-4 flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editVisibleInPortal}
                      onChange={(e) => setEditVisibleInPortal(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs text-slate-300">Visível no Portal do Cliente</span>
                  </label>
                </div>
              </div>

              {/* Área de Edição e Pré-visualização lado a lado */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                  <span>Conteúdo Markdown *</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Formatos suportados: títulos, listas, tabelas, código e avisos.
                  </span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Campo de Escrita */}
                  <div className={`${activeEditorTab === 'write' ? 'block' : 'hidden md:block'}`}>
                    <textarea
                      rows={18}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full p-3.5 rounded-xl bg-[#060b14] border border-[#18263f] text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 resize-y leading-relaxed"
                      placeholder="Escreva as instruções passo a passo em Markdown..."
                    />
                  </div>

                  {/* Pré-visualização em Tempo Real com Sanitização */}
                  <div className={`${activeEditorTab === 'preview' ? 'block' : 'hidden md:block'}`}>
                    <div className="p-3.5 rounded-xl bg-[#060b14]/70 border border-[#18263f] min-h-[360px] max-h-[500px] overflow-y-auto">
                      <div className="text-[10px] uppercase font-bold text-cyan-400 mb-2 pb-1 border-b border-[#18263f] flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Pré-visualização Sanitizada</span>
                      </div>
                      <div
                        className="prose prose-invert prose-xs max-w-none text-slate-300 leading-relaxed space-y-2 [&>h1]:text-base [&>h1]:font-bold [&>h1]:text-white [&>h2]:text-sm [&>h2]:font-bold [&>h2]:text-cyan-300 [&>h3]:text-xs [&>h3]:font-semibold [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>blockquote]:border-l-2 [&>blockquote]:border-cyan-500 [&>blockquote]:pl-3 [&>blockquote]:italic [&>pre]:bg-slate-900 [&>pre]:p-2 [&>pre]:rounded-lg"
                        dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(editBody) }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#18263f]">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Gravando...' : isCreating ? 'Criar Procedimento' : 'Salvar Alterações (Nova Versão)'}</span>
                </button>
              </div>
            </form>
          ) : selectedArticle ? (
            /* MODO LEITOR / VISUALIZAÇÃO */
            <div className="space-y-6">
              {/* Artigo Formatado com Barra Superior */}
              <div className="p-6 sm:p-8 rounded-2xl bg-[#0b1528] border border-[#1b2b48] shadow-xl relative print:border-none print:shadow-none print:p-0">
                {/* Barra de Ações do Artigo */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-[#18263f] print:hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      Versão {selectedArticle.version || 1}
                    </span>
                    {selectedArticle.client_id ? (
                      <span className="flex items-center gap-1.5 text-xs text-blue-300 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>{selectedArticle.client_name || 'Específico do Cliente'}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Procedimento Global</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrint}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/60 transition cursor-pointer"
                      title="Imprimir ou Salvar em PDF"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir / PDF</span>
                    </button>

                    <button
                      onClick={handleOpenVersions}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-medium border border-purple-500/30 transition cursor-pointer"
                      title="Ver histórico de edições e versões anteriores"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Versões ({selectedArticle.version || 1})</span>
                    </button>

                    <button
                      onClick={handleStartEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-medium border border-blue-500/30 transition cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      onClick={handleDelete}
                      className="p-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition cursor-pointer"
                      title="Excluir Procedimento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Título e Metadados do Artigo */}
                <div className="space-y-3 mb-6">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                    {selectedArticle.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Autor: {selectedArticle.updated_by || selectedArticle.created_by || 'Equipe Técnica'}</span>
                    </span>

                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Atualizado em: {selectedArticle.updated_at ? selectedArticle.updated_at.slice(0, 10) : 'Recentemente'}</span>
                    </span>

                    {selectedArticle.visible_in_portal === 1 && (
                      <span className="flex items-center gap-1 text-[11px] text-cyan-400">
                        <Shield className="w-3.5 h-3.5" />
                        <span>Publicado no Portal do Cliente</span>
                      </span>
                    )}
                  </div>

                  {selectedArticle.tags && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedArticle.tags.split(',').map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60 font-medium"
                        >
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Conteúdo Renderizado com Sanitização DOMPurify */}
                <div
                  className="prose prose-invert max-w-none text-slate-200 text-xs sm:text-sm leading-relaxed space-y-3 pt-4 border-t border-[#18263f] [&>h1]:text-xl [&>h1]:font-black [&>h1]:text-white [&>h1]:pb-2 [&>h1]:border-b [&>h1]:border-slate-800 [&>h2]:text-base [&>h2]:font-bold [&>h2]:text-cyan-300 [&>h2]:mt-5 [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:text-slate-100 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:space-y-1 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:space-y-1 [&>blockquote]:border-l-4 [&>blockquote]:border-cyan-500 [&>blockquote]:bg-[#081220] [&>blockquote]:p-3 [&>blockquote]:rounded-r-xl [&>pre]:bg-[#060b14] [&>pre]:p-3.5 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-[#18263f] [&>pre]:overflow-x-auto [&>table]:w-full [&>table]:border-collapse [&>th]:bg-slate-800 [&>th]:p-2 [&>th]:text-left [&>td]:p-2 [&>td]:border-t [&>td]:border-slate-800"
                  dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(selectedArticle.body_md) }}
                />
              </div>

              {/* VÍNCULOS COM OUTROS REGISTROS (Fase 1 + Fase 2) */}
              <div className="print:hidden">
                <RelatedItems
                  clientId={selectedArticle.client_id || client?.id || ''}
                  entityType="article"
                  entityId={selectedArticle.id}
                  onNavigate={onNavigateToTab}
                />
              </div>
            </div>
          ) : (
            /* Nenhum Artigo Selecionado */
            <div className="p-12 rounded-2xl bg-[#0b1528] border border-[#1b2b48] text-center space-y-3">
              <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">Nenhum procedimento selecionado</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Escolha um item da lista à esquerda ou clique em "Novo Procedimento" para cadastrar instruções técnicas.
              </p>
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Procedimento</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE HISTÓRICO DE VERSÕES */}
      {showVersionsModal && selectedArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0b1528] border border-[#1b2b48] rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#18263f]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Histórico de Versões</h3>
                  <p className="text-[11px] text-slate-400 truncate max-w-md">
                    {selectedArticle.title} (Versão atual: v{selectedArticle.version || 1})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowVersionsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingVersions ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Carregando versões...
                </div>
              ) : versions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Nenhuma versão histórica anterior registrada.
                </div>
              ) : (
                versions.map(ver => {
                  const isCurrent = ver.version === selectedArticle.version;
                  const isPreviewing = selectedPreviewVersion?.id === ver.id;
                  return (
                    <div
                      key={ver.id}
                      className={`p-3.5 rounded-xl border transition ${
                        isPreviewing
                          ? 'bg-[#15233c] border-purple-500/50'
                          : 'bg-[#070d1a] border-[#18263f] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            isCurrent
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}>
                            v{ver.version} {isCurrent && '(Atual)'}
                          </span>
                          <span className="text-xs font-semibold text-white">
                            {ver.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedPreviewVersion(isPreviewing ? null : ver)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          >
                            {isPreviewing ? 'Ocultar' : 'Ver Conteúdo'}
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => handleRestoreVersion(ver)}
                              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 font-semibold transition"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Restaurar</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-[10px] text-slate-400 mt-2">
                        <span>Alterado por: <strong className="text-slate-300">{ver.changed_by || 'Técnico'}</strong></span>
                        <span>Data: {ver.created_at ? ver.created_at.slice(0, 16).replace('T', ' ') : ''}</span>
                      </div>

                      {/* Pré-visualização do conteúdo da versão selecionada */}
                      {isPreviewing && (
                        <div className="mt-3 p-3 rounded-lg bg-[#050912] border border-[#1b2b48] max-h-60 overflow-y-auto">
                          <div
                            className="prose prose-invert prose-xs max-w-none text-slate-300"
                            dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(ver.body_md) }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-[#18263f] flex justify-end">
              <button
                onClick={() => setShowVersionsModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

