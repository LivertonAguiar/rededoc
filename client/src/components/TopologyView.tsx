import React, { useState, useEffect } from 'react';
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
  ScanFace
} from 'lucide-react';
import { Client, Equipment, PortForward, TopologyData } from '../types';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';

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
  const { showToast } = useDialog();
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadTopology = async () => {
    setLoading(true);
    try {
      const data = await api.getTopology(client.id, client.locations?.[0]?.id);
      setTopology(data);
    } catch (err) {
      console.error('Erro ao carregar topologia:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopology();
  }, [client.id]);

  const handleSave = async () => {
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
      showToast('Layout da topologia salvo com sucesso!', 'success');
    } catch (err: any) {
      showToast('Erro ao salvar topologia: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const routerOnt = equipments.find(e => e.category === 'router_ont');
  const wanIp = routerOnt?.public_wan_ip || '203.0.113.45';

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Network className="w-6 h-6 text-blue-400" />
            Topologia Visual da Infraestrutura de Rede
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Representação visual dinâmica: Internet → Roteador/ONT → Switches → Dispositivos de CFTV e Controle de Acesso
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTopology}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D] border border-[#24375A]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recarregar</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Salvando...' : 'Salvar Topologia'}</span>
          </button>
        </div>
      </div>

      {/* Área do Diagrama Visual */}
      <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl min-h-[500px] flex flex-col justify-between relative overflow-hidden select-none">
        <div className="flex items-center justify-between text-xs text-slate-400 pb-4 border-b border-[#1D3054]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Cliente:</span>
            <span>{client.name}</span>
          </div>
          <div className="flex items-center gap-4">
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

        {/* Árvore Hierárquica em Alta Definição */}
        <div className="py-8 flex flex-col items-center justify-center flex-1">
          {/* Nível 1: Internet */}
          <div className="flex flex-col items-center">
            <div className="px-6 py-2.5 rounded-xl bg-blue-600 shadow-xl shadow-blue-500/25 text-white font-bold flex items-center gap-2 text-sm border border-blue-400">
              <Globe className="w-4 h-4" />
              <span>Internet WAN ({wanIp})</span>
            </div>
            <div className="w-0.5 h-8 bg-blue-500"></div>
          </div>

          {/* Nível 2: Roteador / ONT */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => setSelectedNode(routerOnt)}
              className="px-6 py-3.5 rounded-2xl bg-[#172744] border-2 border-blue-500 shadow-xl text-center cursor-pointer hover:border-blue-400 transition-all min-w-[240px]"
            >
              <div className="text-xs uppercase font-bold text-blue-400 flex items-center justify-center gap-1.5">
                <Router className="w-4 h-4" />
                {routerOnt?.name || 'ONT Huawei HG8145X6'}
              </div>
              <div className="text-xs text-slate-200 mt-1 font-semibold">
                {routerOnt?.manufacturer} {routerOnt?.model}
              </div>
              <div className="text-xs font-mono font-bold text-emerald-400 mt-1">
                {routerOnt?.local_ip || '192.168.1.1'}
              </div>
            </div>

            {/* Linhas conectores para os ramos */}
            <div className="w-full max-w-3xl flex flex-col items-center">
              <div className="w-0.5 h-8 bg-blue-500"></div>
              <div className="w-[84%] h-0.5 bg-blue-500"></div>
            </div>
          </div>

          {/* Nível 3: Equipamentos Conectados (LAN) */}
          <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-6 pt-0">
            {equipments.filter(e => e.id !== routerOnt?.id).map((eq, idx) => {
              const ports = portForwards.filter(p => p.equipment_id === eq.id);
              const hasFailure = ports.some(p => p.status === 'com_falha');

              return (
                <div key={eq.id} className="flex flex-col items-center">
                  <div className="w-0.5 h-6 bg-blue-500"></div>

                  {/* Selo Âmbar de Portas */}
                  {ports.length > 0 && (
                    <div className="mb-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-xs font-bold shadow-md">
                      {ports[0].external_port} → {ports[0].internal_port}
                      {ports.length > 1 ? ` +${ports.length - 1}` : ''}
                    </div>
                  )}

                  {/* Card do Dispositivo */}
                  <div
                    onClick={() => setSelectedNode(eq)}
                    className={`w-full bg-[#132238] hover:bg-[#1A2E4E] border ${
                      hasFailure ? 'border-rose-500/80 shadow-rose-900/30' : 'border-[#263D68]'
                    } rounded-2xl p-4 text-center cursor-pointer transition-all shadow-lg group`}
                  >
                    <div className="font-bold text-white text-sm group-hover:text-blue-300 transition-colors">
                      {eq.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {eq.model || eq.category}
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-400 mt-1.5">
                      {eq.local_ip || '192.168.1.X'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      MAC: {eq.mac_address || 'N/A'}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#1D3054] flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Status:</span>
                      <span className={`font-semibold flex items-center gap-1 ${
                        hasFailure ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${
                          hasFailure ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                        }`}></span>
                        {hasFailure ? 'Com falha' : 'Operacional'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gaveta de Detalhes do Nó Selecionado */}
        {selectedNode && (
          <div className="mt-4 p-4 rounded-xl bg-[#091122] border border-blue-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white text-sm">{selectedNode.name}</span>
                <span className="text-slate-400 ml-2">({selectedNode.manufacturer} {selectedNode.model})</span>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  IP: <span className="text-emerald-400">{selectedNode.local_ip}</span> • MAC: {selectedNode.mac_address} • Gateway: {selectedNode.gateway}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Fechar Detalhes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
