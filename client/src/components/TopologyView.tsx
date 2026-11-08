import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Network,
  Globe,
  Router,
  Server,
  Layers,
  Save,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Camera,
  DoorOpen,
  ScanFace,
  Plus,
  Link as LinkIcon,
  Unlink,
  Trash2,
  Sparkles,
  RotateCcw,
  Move,
  Wifi,
  Radio,
  Sliders,
  X,
  ArrowRight
} from 'lucide-react';
import { Client, Equipment, PortForward, TopologyData, TopologyNode, TopologyEdge } from '../types';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { AddEquipmentModal } from './AddEquipmentModal';

interface TopologyViewProps {
  client: Client;
  equipments: Equipment[];
  portForwards: PortForward[];
  onRefresh: () => void;
}

export const TopologyView: React.FC<TopologyViewProps> = ({
  client,
  equipments,
  portForwards,
  onRefresh
}) => {
  const { showToast, confirm } = useDialog();
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Seleção e inspeção
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Modais
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [showManageEdgesModal, setShowManageEdgesModal] = useState(false);
  const [showCreateEquipmentModal, setShowCreateEquipmentModal] = useState(false);

  // Formulário de Nova Conexão
  const [connectFromId, setConnectFromId] = useState<string>('');
  const [connectToId, setConnectToId] = useState<string>('');
  const [connectLabel, setConnectLabel] = useState<string>('Porta 1');

  // Arrastar e soltar (Drag & Drop de Nós)
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Carrega a topologia do backend
  const loadTopology = async () => {
    setLoading(true);
    try {
      const data = await api.getTopology(client.id, client.locations?.[0]?.id);

      // Normalização automática de coordenadas antigas para evitar nós cortados no topo
      if (data && data.nodes && data.nodes.length > 0) {
        const internetNode = data.nodes.find((n: any) => n.id === 'internet');
        if (internetNode && internetNode.y < 70) {
          const shiftY = 80 - internetNode.y;
          data.nodes = data.nodes.map((n: any) => ({
            ...n,
            y: Math.round(n.y + shiftY)
          }));
        }
      }

      setTopology(data);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      console.error('Erro ao carregar topologia:', err);
      showToast('Erro ao carregar topologia: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopology();
  }, [client.id]);

  // Ícone de acordo com a categoria
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'internet':
        return <Globe className="w-5 h-5 text-blue-400" />;
      case 'router_ont':
      case 'router':
      case 'ont':
        return <Router className="w-5 h-5 text-emerald-400" />;
      case 'switch':
        return <Layers className="w-5 h-5 text-indigo-400" />;
      case 'access_point':
        return <Wifi className="w-5 h-5 text-amber-400" />;
      case 'ip_camera':
        return <Camera className="w-5 h-5 text-rose-400" />;
      case 'dvr_nvr':
      case 'server':
        return <Server className="w-5 h-5 text-purple-400" />;
      case 'facial_recognition':
        return <ScanFace className="w-5 h-5 text-cyan-400" />;
      case 'gate_module':
      case 'intercom':
        return <DoorOpen className="w-5 h-5 text-orange-400" />;
      default:
        return <Radio className="w-5 h-5 text-slate-400" />;
    }
  };

  // Salvar topologia no banco
  const handleSaveTopology = async () => {
    if (!topology) return;
    setIsSaving(true);
    try {
      await api.saveTopology({
        client_id: client.id,
        location_id: client.locations?.[0]?.id || '',
        nodes: topology.nodes,
        edges: topology.edges,
        view_mode: topology.view_mode
      });
      setHasUnsavedChanges(false);
      showToast('Topologia de rede salva com sucesso!', 'success');
    } catch (err: any) {
      showToast('Erro ao salvar topologia: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Redefinir para o padrão automático
  const handleResetTopology = () => {
    confirm({
      title: 'Redefinir Topologia para Padrão?',
      message: 'Todas as conexões personalizadas serão recalculadas com base no Roteador/ONT principal. Deseja continuar?',
      confirmText: 'Sim, Redefinir',
      cancelText: 'Cancelar',
      danger: true,
      onConfirm: async () => {
        try {
          await api.resetTopology(client.id, client.locations?.[0]?.id);
          showToast('Topologia redefinida com sucesso.', 'success');
          loadTopology();
        } catch (err: any) {
          showToast('Erro ao redefinir: ' + err.message, 'error');
        }
      }
    });
  };

  // Adicionar uma nova conexão entre dois nós
  const handleAddEdge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topology) return;

    if (!connectFromId || !connectToId) {
      showToast('Selecione os equipamentos de origem e destino.', 'warning');
      return;
    }
    if (connectFromId === connectToId) {
      showToast('Um equipamento não pode ser conectado a ele mesmo.', 'warning');
      return;
    }

    // Verifica se já existe a conexão
    const alreadyExists = topology.edges.some(
      edge => (edge.from === connectFromId && edge.to === connectToId) ||
              (edge.from === connectToId && edge.to === connectFromId)
    );

    if (alreadyExists) {
      showToast('Esses dois equipamentos já possuem uma conexão configurada.', 'warning');
      return;
    }

    const newEdge: TopologyEdge = {
      from: connectFromId,
      to: connectToId,
      label: connectLabel.trim() || 'Link'
    };

    setTopology(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        edges: [...prev.edges, newEdge]
      };
    });

    setHasUnsavedChanges(true);
    setShowConnectModal(false);
    setConnectFromId('');
    setConnectToId('');
    setConnectLabel('Porta 1');
    showToast('Conexão adicionada! Lembre-se de salvar.', 'success');
  };

  // Abrir modal de conexão já com o nó de origem pré-selecionado
  const handleOpenConnectForNode = (nodeId: string) => {
    setConnectFromId(nodeId);
    // Sugere o primeiro destino diferente
    const other = topology?.nodes.find(n => n.id !== nodeId);
    setConnectToId(other ? other.id : '');
    setConnectLabel('Porta 1');
    setShowConnectModal(true);
  };

  // Remover uma conexão específica
  const handleRemoveEdge = (fromId: string, toId: string) => {
    if (!topology) return;
    setTopology(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        edges: prev.edges.filter(e => !(e.from === fromId && e.to === toId) && !(e.from === toId && e.to === fromId))
      };
    });
    setHasUnsavedChanges(true);
    showToast('Conexão removida da topologia.', 'info');
  };

  // Adicionar equipamento existente cadastrado no cliente ao canvas
  const handleAddExistingEquipmentToTopology = (eq: Equipment) => {
    if (!topology) return;

    // Calcula posição para não sobrepor
    const existingCount = topology.nodes.length;
    const posX = Math.min(800, 150 + (existingCount % 4) * 200);
    const posY = Math.min(600, 200 + Math.floor(existingCount / 4) * 160);

    const ports = portForwards.filter(p => p.equipment_id === eq.id);
    const portBadge = ports.length > 0 ? `${ports[0].external_port} → ${ports[0].internal_port}` : undefined;
    const hasFailure = ports.some(p => p.status === 'com_falha');

    const newNode: TopologyNode = {
      id: eq.id,
      label: eq.name,
      sublabel: `${eq.manufacturer || ''} ${eq.model || ''}`.trim(),
      ip: eq.local_ip || undefined,
      mac: eq.mac_address || undefined,
      type: eq.category,
      photo_url: eq.photo_url || null,
      x: posX,
      y: posY,
      portBadge,
      status: hasFailure ? 'com_falha' : 'funcionando'
    };

    // Conecta automaticamente à ONT ou ao último switch se houver
    const routerOrSwitch = topology.nodes.find(n => n.type === 'switch') ||
                          topology.nodes.find(n => n.type === 'router_ont' || n.type === 'router') ||
                          topology.nodes.find(n => n.id !== 'internet');

    const newEdges = [...topology.edges];
    if (routerOrSwitch) {
      newEdges.push({
        from: routerOrSwitch.id,
        to: eq.id,
        label: `Porta ${newEdges.filter(e => e.from === routerOrSwitch.id).length + 1}`
      });
    }

    setTopology(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: [...prev.nodes, newNode],
        edges: newEdges
      };
    });

    setHasUnsavedChanges(true);
    setShowAddNodeModal(false);
    showToast(`${eq.name} adicionado à topologia!`, 'success');
  };

  // Remover nó da topologia (apenas do mapa visual)
  const handleRemoveNodeFromTopology = (nodeId: string) => {
    if (!topology) return;
    if (nodeId === 'internet') {
      showToast('O nó de Internet não pode ser removido.', 'warning');
      return;
    }

    setTopology(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== nodeId),
        edges: prev.edges.filter(e => e.from !== nodeId && e.to !== nodeId)
      };
    });

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }

    setHasUnsavedChanges(true);
    showToast('Nó removido do mapa de topologia.', 'info');
  };

  // Auto-organização hierárquica inteligente dos nós
  const handleAutoOrganize = () => {
    if (!topology || topology.nodes.length === 0) return;

    // Monta mapa de adjacência
    const nodes = [...topology.nodes];
    const edges = topology.edges;

    // Determina o nível de profundidade de cada nó
    const depths = new Map<string, number>();
    depths.set('internet', 0);

    // BFS para determinar distâncias a partir do nó raiz (internet ou roteador)
    const queue: string[] = ['internet'];
    const visited = new Set<string>(['internet']);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDepth = depths.get(current) ?? 0;

      // Vizinhos onde current é 'from'
      const outgoing = edges.filter(e => e.from === current).map(e => e.to);
      for (const target of outgoing) {
        if (!visited.has(target)) {
          visited.add(target);
          depths.set(target, currentDepth + 1);
          queue.push(target);
        }
      }
    }

    // Para nós desconectados, coloca na categoria adequada
    nodes.forEach(n => {
      if (!depths.has(n.id)) {
        if (n.type === 'router_ont' || n.type === 'router' || n.type === 'ont') depths.set(n.id, 1);
        else if (n.type === 'switch') depths.set(n.id, 2);
        else if (n.type === 'access_point' || n.type === 'server' || n.type === 'dvr_nvr') depths.set(n.id, 3);
        else depths.set(n.id, 4);
      }
    });

    // Agrupa nós por profundidade
    const levels = new Map<number, TopologyNode[]>();
    nodes.forEach(n => {
      const d = depths.get(n.id) ?? 3;
      const list = levels.get(d) || [];
      list.push(n);
      levels.set(d, list);
    });

    const canvasWidth = 860;
    const organizedNodes = nodes.map(n => {
      const d = depths.get(n.id) ?? 3;
      const levelList = levels.get(d) || [n];
      const indexInLevel = levelList.findIndex(item => item.id === n.id);
      const totalInLevel = levelList.length;

      const spacing = totalInLevel > 1 ? canvasWidth / (totalInLevel + 1) : canvasWidth / 2;
      const newX = Math.round(spacing * (indexInLevel + 1));
      const newY = 80 + d * 140;

      return {
        ...n,
        x: newX,
        y: newY
      };
    });

    setTopology(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: organizedNodes
      };
    });

    setHasUnsavedChanges(true);
    showToast('Topologia organizada automaticamente!', 'success');
  };

  // Gerenciamento de Drag & Drop no canvas
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    // Apenas com o botão esquerdo
    if (e.button !== 0) return;
    e.stopPropagation();

    const node = topology?.nodes.find(n => n.id === nodeId);
    if (!node || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    setDraggingNodeId(nodeId);
    setDragOffset({
      x: mouseX - node.x,
      y: mouseY - node.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !canvasRef.current || !topology) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    const newX = Math.max(90, Math.min(canvasRect.width - 90, mouseX - dragOffset.x));
    const newY = Math.max(60, Math.min(canvasRect.height - 60, mouseY - dragOffset.y));

    setTopology(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map(n => n.id === draggingNodeId ? { ...n, x: Math.round(newX), y: Math.round(newY) } : n)
      };
    });

    if (!hasUnsavedChanges) {
      setHasUnsavedChanges(true);
    }
  };

  const handleMouseUp = () => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }
  };

  // Identifica equipamentos que estão no cadastro do cliente mas ainda não no mapa
  const availableEquipments = useMemo(() => {
    if (!topology) return [];
    const nodeIds = new Set(topology.nodes.map(n => n.id));
    return equipments.filter(eq => !nodeIds.has(eq.id));
  }, [topology, equipments]);

  const selectedNode = useMemo(() => {
    return topology?.nodes.find(n => n.id === selectedNodeId) || null;
  }, [topology, selectedNodeId]);

  return (
    <div className="space-y-5" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Barra de Título e Ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#101C31] border border-[#1D3054] rounded-2xl p-5 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Network className="w-5 h-5 text-blue-400" />
            Topologia de Rede Interativa
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Adicione dispositivos, conecte portas e organize o fluxo físico da infraestrutura em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Conectar */}
          <button
            onClick={() => {
              if (topology?.nodes && topology.nodes.length >= 2) {
                setConnectFromId(topology.nodes[0].id);
                setConnectToId(topology.nodes[1].id);
              }
              setShowConnectModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-blue-300 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/40 shadow-sm transition"
            title="Criar nova ligação entre dois equipamentos"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>+ Conectar Nós</span>
          </button>

          {/* Botão Adicionar Equipamento */}
          <button
            onClick={() => setShowAddNodeModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/40 shadow-sm transition"
            title="Inserir equipamento existente ou cadastrar novo"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Adicionar Equipamento</span>
          </button>

          {/* Botão Conexões Ativas */}
          <button
            onClick={() => setShowManageEdgesModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D] border border-[#24375A] transition"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Conexões ({topology?.edges.length || 0})</span>
          </button>

          {/* Auto Organizar */}
          <button
            onClick={handleAutoOrganize}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D] border border-[#24375A] transition"
            title="Alinhar e nivelar nós hierarquicamente"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Auto-organizar</span>
          </button>

          {/* Redefinir para Padrão */}
          <button
            onClick={handleResetTopology}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 bg-[#172744] hover:bg-[#20365D] border border-[#24375A] transition"
            title="Redefinir para estrutura automática da rede"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Salvar Topologia */}
          <button
            onClick={handleSaveTopology}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition ${
              hasUnsavedChanges
                ? 'bg-amber-600 hover:bg-amber-500 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Salvando...' : hasUnsavedChanges ? 'Salvar Alterações *' : 'Salvar Topologia'}</span>
          </button>
        </div>
      </div>

      {/* Canvas da Topologia (Área Gráfica com SVG e Cartões Interativos) */}
      <div className="bg-[#0A1224] border border-[#1D3054] rounded-2xl overflow-hidden select-none shadow-2xl flex flex-col">
        {/* Barra superior de status interno do mapa */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#0E1A30]/90 border-b border-[#1D3054] text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{client.name}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">{topology?.nodes.length || 0} dispositivos mapeados</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Operacional
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Com falha
            </span>
          </div>
        </div>

        {/* Área Gráfica Interativa */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          className="relative overflow-hidden min-h-[580px] w-full"
          style={{
            backgroundImage: 'radial-gradient(#1E3A8A 0.75px, transparent 0.75px)',
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0'
          }}
        >

        {/* Camada SVG para desenho das Conexões (Edges) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {topology?.edges.map((edge, idx) => {
            const sourceNode = topology.nodes.find(n => n.id === edge.from);
            const targetNode = topology.nodes.find(n => n.id === edge.to);
            if (!sourceNode || !targetNode) return null;

            // Pontos de ancoragem
            const startX = sourceNode.x;
            const startY = sourceNode.y + 36;
            const endX = targetNode.x;
            const endY = targetNode.y - 36;

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            // Curva suave em Bezier cúbico
            const deltaY = Math.abs(endY - startY);
            const controlOffset = Math.max(30, deltaY * 0.4);
            const pathData = `M ${startX} ${startY} C ${startX} ${startY + controlOffset}, ${endX} ${endY - controlOffset}, ${endX} ${endY}`;

            return (
              <g key={`edge-${edge.from}-${edge.to}-${idx}`}>
                {/* Linha externa de brilho */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="#1D4ED8"
                  strokeWidth="4"
                  strokeOpacity="0.4"
                />
                {/* Linha principal */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="url(#edgeGradient)"
                  strokeWidth="2.5"
                  strokeDasharray={edge.label?.toLowerCase().includes('wi-fi') ? '4 4' : undefined}
                />

                {/* Badge do Rótulo da Conexão / Porta (Interativo) */}
                <foreignObject
                  x={midX - 55}
                  y={midY - 12}
                  width="110"
                  height="26"
                  className="pointer-events-auto"
                >
                  <div className="flex items-center justify-center">
                    <div
                      className="group flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0D1829] border border-blue-500/50 text-[10px] font-mono text-blue-300 font-semibold shadow-md hover:border-rose-500 hover:text-white transition cursor-pointer select-none"
                      onClick={() => handleRemoveEdge(edge.from, edge.to)}
                      title="Clique para remover esta conexão"
                    >
                      <span className="truncate max-w-[70px]">{edge.label || 'Link'}</span>
                      <X className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 group-hover:text-rose-400" />
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        {/* Nós do Diagrama (Renderizados em HTML Absoluto sobre o SVG) */}
        <div className="absolute inset-0 pointer-events-none">
          {topology?.nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isDragging = draggingNodeId === node.id;
            const isInternet = node.id === 'internet';

            return (
              <div
                key={node.id}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  transform: 'translate(-50%, -50%)'
                }}
                className={`absolute pointer-events-auto transition-shadow ${
                  isDragging ? 'cursor-grabbing z-30 scale-105' : 'cursor-grab z-10'
                }`}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                onClick={() => setSelectedNodeId(node.id)}
              >
                {/* Cartão do Nó */}
                <div
                  className={`w-44 rounded-2xl p-3 text-center transition-all shadow-xl backdrop-blur-md ${
                    isInternet
                      ? 'bg-blue-600 border-2 border-blue-400 text-white font-bold'
                      : isSelected
                      ? 'bg-[#182B4B] border-2 border-blue-400 shadow-blue-500/30'
                      : 'bg-[#121F38]/95 border border-[#223961] hover:border-blue-500/70'
                  }`}
                >
                  {/* Cabeçalho do Nó com Ícone e Tipo */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {getNodeIcon(node.type)}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                        {node.type === 'internet' ? 'WAN' : node.type.replace('_', ' ')}
                      </span>
                    </div>

                    {!isInternet && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenConnectForNode(node.id);
                          }}
                          className="p-1 rounded-md text-blue-400 hover:text-white hover:bg-blue-600/40 transition"
                          title="Conectar a outro equipamento"
                        >
                          <LinkIcon className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveNodeFromTopology(node.id);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-900/30 transition"
                          title="Remover do mapa"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Nome e Modelo */}
                  <div className="font-bold text-white text-xs truncate">
                    {node.label}
                  </div>
                  {node.sublabel && (
                    <div className="text-[10px] text-slate-400 truncate">
                      {node.sublabel}
                    </div>
                  )}

                  {/* Endereço IP */}
                  <div className="mt-1 font-mono text-[11px] font-bold text-emerald-400">
                    {node.ip || 'IP não inf.'}
                  </div>

                  {/* Badge de Portas / NAT (se houver) */}
                  {node.portBadge && (
                    <div className="mt-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono text-amber-300 font-semibold truncate">
                      {node.portBadge}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dica no rodapé do canvas */}
        <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between pointer-events-none text-[11px] text-slate-400 bg-[#0E1A30]/80 backdrop-blur-md px-4 py-2 rounded-xl border border-[#1D3054]">
          <span className="flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-blue-400" />
            Clique e arraste qualquer cartão para reorganizar o mapa livremente.
          </span>
          <span className="flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-indigo-400" />
            Clique no ícone de corrente no nó para ligá-lo a outro equipamento.
          </span>
        </div>
        </div>
      </div>

      {/* Painel Inferior: Inspeção e Ações do Nó Selecionado */}
      {selectedNode && (
        <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
              {getNodeIcon(selectedNode.type)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{selectedNode.label}</span>
                {selectedNode.sublabel && (
                  <span className="text-xs text-slate-400">({selectedNode.sublabel})</span>
                )}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
                <span>IP: <strong className="text-emerald-400">{selectedNode.ip || '—'}</strong></span>
                {selectedNode.mac && <span>MAC: <strong>{selectedNode.mac}</strong></span>}
                <span>Tipo: <strong>{selectedNode.type}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenConnectForNode(selectedNode.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-300 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/40"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Conectar a outro dispositivo</span>
            </button>

            {selectedNode.id !== 'internet' && (
              <button
                onClick={() => handleRemoveNodeFromTopology(selectedNode.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-900/30 hover:bg-rose-800/50 border border-rose-500/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remover do Mapa</span>
              </button>
            )}

            <button
              onClick={() => setSelectedNodeId(null)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#1D3054]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: Conectar Dois Nós */}
      {showConnectModal && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl w-full max-w-md p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054] mb-4">
              <h2 className="text-base font-bold flex items-center gap-2 text-blue-400">
                <LinkIcon className="w-5 h-5" />
                Conectar Equipamentos na Rede
              </h2>
              <button onClick={() => setShowConnectModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEdge} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  1. Equipamento de Origem (Pai / Concentrador)
                </label>
                <select
                  value={connectFromId}
                  onChange={(e) => setConnectFromId(e.target.value)}
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  {topology?.nodes.map(n => (
                    <option key={n.id} value={n.id}>
                      {n.label} {n.ip ? `(${n.ip})` : ''} — {n.type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  2. Equipamento de Destino (Filho / Conectado)
                </label>
                <select
                  value={connectToId}
                  onChange={(e) => setConnectToId(e.target.value)}
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled>Selecione o destino...</option>
                  {topology?.nodes.filter(n => n.id !== connectFromId).map(n => (
                    <option key={n.id} value={n.id}>
                      {n.label} {n.ip ? `(${n.ip})` : ''} — {n.type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  3. Identificação do Link / Porta
                </label>
                <input
                  type="text"
                  value={connectLabel}
                  onChange={(e) => setConnectLabel(e.target.value)}
                  placeholder="Ex: Porta 1, Porta PoE 3, LAN, Wi-Fi 5G, Trunk"
                  className="w-full bg-[#132238] border border-[#24375A] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                />

                {/* Sugestões Rápidas */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Porta 1', 'Porta 2', 'Porta 3', 'PoE', 'Trunk', 'LAN', 'Wi-Fi 5GHz', 'SFP Fibra'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setConnectLabel(tag)}
                      className="px-2 py-0.5 rounded bg-[#172744] hover:bg-[#20365D] text-[10px] text-blue-300 font-mono transition"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#1D3054]">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 bg-[#172744] hover:bg-[#20365D]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-white font-semibold bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/25"
                >
                  Estabelecer Conexão
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Adicionar Equipamento à Topologia */}
      {showAddNodeModal && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl w-full max-w-lg p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054] mb-4">
              <h2 className="text-base font-bold flex items-center gap-2 text-emerald-400">
                <Plus className="w-5 h-5" />
                Adicionar Equipamento ao Mapa
              </h2>
              <button onClick={() => setShowAddNodeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Opção 1: Equipamentos já cadastrados que ainda não estão no mapa */}
              <div>
                <h3 className="font-semibold text-slate-300 mb-2">
                  Equipamentos Cadastrados Disponíveis ({availableEquipments.length})
                </h3>

                {availableEquipments.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#091122] border border-[#1D3054] text-center text-slate-400">
                    Todos os equipamentos cadastrados deste cliente já estão inseridos no mapa de topologia.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                    {availableEquipments.map(eq => (
                      <div
                        key={eq.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#132238] border border-[#24375A] hover:border-emerald-500/60 transition"
                      >
                        <div>
                          <div className="font-bold text-white text-xs">{eq.name}</div>
                          <div className="text-slate-400 text-[11px]">
                            {eq.manufacturer} {eq.model} • <span className="font-mono text-emerald-400">{eq.local_ip || 'Sem IP'}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddExistingEquipmentToTopology(eq)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Inserir no Mapa</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Opção 2: Cadastrar um novo equipamento do zero */}
              <div className="pt-3 border-t border-[#1D3054] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-200 block">Precisa de um novo dispositivo?</span>
                  <span className="text-[11px] text-slate-400">Cadastre um Switch, AP, Câmera ou Roteador diretamente.</span>
                </div>
                <button
                  onClick={() => {
                    setShowAddNodeModal(false);
                    setShowCreateEquipmentModal(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Novo</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: Gerenciar Todas as Conexões Existentes */}
      {showManageEdgesModal && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl w-full max-w-lg p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054] mb-4">
              <h2 className="text-base font-bold flex items-center gap-2 text-indigo-400">
                <Layers className="w-5 h-5" />
                Conexões Físicas Ativas ({topology?.edges.length || 0})
              </h2>
              <button onClick={() => setShowManageEdgesModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2 max-h-72 overflow-y-auto pr-1">
              {(!topology?.edges || topology.edges.length === 0) ? (
                <div className="p-6 text-center text-slate-400">
                  Nenhuma conexão cadastrada no momento.
                </div>
              ) : (
                topology.edges.map((edge, idx) => {
                  const fromNode = topology.nodes.find(n => n.id === edge.from);
                  const toNode = topology.nodes.find(n => n.id === edge.to);

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-[#132238] border border-[#24375A]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{fromNode?.label || edge.from}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-semibold text-white">{toNode?.label || edge.to}</span>
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono text-[10px]">
                          {edge.label || 'Link'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleRemoveEdge(edge.from, edge.to)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-900/30 transition"
                        title="Excluir Conexão"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-[#1D3054] flex justify-end">
              <button
                onClick={() => setShowManageEdgesModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Criação de Novo Equipamento integrado */}
      <AddEquipmentModal
        isOpen={showCreateEquipmentModal}
        onClose={() => setShowCreateEquipmentModal(false)}
        clientId={client.id}
        locationId={client.locations?.[0]?.id || ''}
        locations={client.locations || []}
        onSuccess={() => {
          setShowCreateEquipmentModal(false);
          onRefresh();
          loadTopology();
        }}
      />
    </div>
  );
};
