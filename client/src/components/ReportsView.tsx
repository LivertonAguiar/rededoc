import React, { useState, useEffect } from 'react';
import {
  Printer,
  FileDown,
  ShieldAlert,
  Lock,
  Globe,
  Server,
  Share2,
  CheckCircle2,
  Building2,
  MapPin,
  Calendar,
  Eye,
  EyeOff,
  Camera,
  Image as ImageIcon,
  Wrench,
  Clock,
  FileText,
  Sparkles,
  Info
} from 'lucide-react';
import { TechnicalReportData, Client } from '../types';
import { api, resolveMediaUrl } from '../services/api';
import { useDialog } from '../context/DialogContext';

interface ReportsViewProps {
  client: Client;
  onBack?: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ client, onBack }) => {
  const { confirm, showToast } = useDialog();
  const [report, setReport] = useState<TechnicalReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [includePasswords, setIncludePasswords] = useState(false);
  const [includeAttachments, setIncludeAttachments] = useState(true);

  const loadReport = async (withPasswords = false) => {
    setLoading(true);
    try {
      const data = await api.getTechnicalReport(client.id, client.locations?.[0]?.id, withPasswords);
      setReport(data);
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport(includePasswords);
  }, [client.id, includePasswords]);

  const handleTogglePasswords = () => {
    if (!includePasswords) {
      confirm({
        title: 'Exposição de Credenciais Confidenciais',
        message: 'Atenção: A inclusão de senhas no relatório técnico impresso expõe credenciais confidenciais do cliente. Deseja confirmar a autorização?',
        confirmText: 'Autorizar Inclusão de Senhas',
        danger: true,
        onConfirm: () => {
          setIncludePasswords(true);
          showToast('Senhas incluídas no relatório.', 'warning');
        }
      });
    } else {
      setIncludePasswords(false);
      showToast('Senhas ocultadas do relatório.', 'info');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading || !report) {
    return (
      <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-12 text-center text-slate-400">
        Gerando relatório técnico consolidado com anexos e configurações...
      </div>
    );
  }

  // Anexos com imagens/prints para a documentação passo a passo
  const imageAttachments = (report.attachments || []).filter(att =>
    att.mime_type.startsWith('image/') ||
    att.category === 'config_print' ||
    att.category === 'config_screenshot' ||
    att.category === 'step_by_step' ||
    att.category === 'equipment_photo'
  );

  return (
    <div className="space-y-6">
      {/* Barra de Ações Superior (Oculta na impressão) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Printer className="w-6 h-6 text-blue-400" />
            Relatório Técnico e Exportação em PDF
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visualização padronizada para entrega ao condomínio/cliente com suporte nativo a impressão e exportação em PDF
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle de Anexos/Prints no PDF */}
          <button
            onClick={() => setIncludeAttachments(!includeAttachments)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
              includeAttachments
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-[#172744] text-slate-400 border-[#263D68] hover:bg-[#20365D]'
            }`}
            title="Alterna a inclusão de fotografias, prints de configuração e passo a passo no PDF"
          >
            <Camera className="w-4 h-4 text-purple-400" />
            <span>{includeAttachments ? 'Prints/Anexos no PDF: SIM' : 'Prints/Anexos no PDF: NÃO'}</span>
          </button>

          {/* Toggle de Senhas */}
          <button
            onClick={handleTogglePasswords}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
              includePasswords
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-[#172744] text-slate-300 border-[#263D68] hover:bg-[#20365D]'
            }`}
          >
            {includePasswords ? <EyeOff className="w-4 h-4 text-rose-400" /> : <Eye className="w-4 h-4 text-amber-400" />}
            <span>{includePasswords ? 'Ocultar Senhas no PDF' : 'Incluir Senhas no PDF'}</span>
          </button>

          {/* Botão de Impressão */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Salvar em PDF</span>
          </button>
        </div>
      </div>

      {/* DOCUMENTO DO RELATÓRIO (Estilizado para tela e com print stylesheet) */}
      <div className="bg-[#0F1B2D] print:bg-white border border-[#1D3054] print:border-none rounded-2xl p-8 print:p-0 shadow-2xl print:shadow-none space-y-6 text-slate-200 print:text-slate-900">
        
        {/* Cabeçalho do Relatório */}
        <div className="pb-6 border-b border-[#1D3054] print:border-slate-300 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400 print:text-blue-700">
              RedeDoc — Relatório Técnico de Infraestrutura e Redirecionamentos
            </div>
            <h2 className="text-2xl font-bold text-white print:text-slate-900 mt-1">
              {report.client.name}
            </h2>
            <div className="text-xs text-slate-400 print:text-slate-600 mt-1 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-blue-400 print:text-blue-600" />
              <span>{report.location?.address || client.address || 'Endereço não informado'}</span>
            </div>
          </div>

          <div className="text-right text-xs text-slate-400 print:text-slate-600 space-y-1 font-mono">
            <div>Emissão: <strong className="text-slate-200 print:text-slate-900">{new Date(report.generated_at).toLocaleString('pt-BR')}</strong></div>
            <div>Técnico Resp.: <strong className="text-slate-200 print:text-slate-900">{report.latest_service_order?.technician_name || 'Liverton Aguiar'}</strong></div>
            <div>Status: <span className="text-emerald-400 print:text-emerald-700 font-bold uppercase">Validação Concluída</span></div>
          </div>
        </div>

        {/* 1. Resumo de Conectividade */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400 print:text-blue-700" />
            1. Resumo de Conectividade e Roteador Principal (ONT)
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#132238] print:bg-slate-50 p-4 rounded-xl border border-[#24375A] print:border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 print:text-slate-500 block text-[11px]">IP WAN (Público)</span>
              <span className="font-mono font-bold text-white print:text-slate-900">{report.connection_summary.public_wan_ip}</span>
            </div>
            <div>
              <span className="text-slate-400 print:text-slate-500 block text-[11px]">Roteador / ONT</span>
              <span className="font-semibold text-slate-200 print:text-slate-800">{report.connection_summary.router_model}</span>
            </div>
            <div>
              <span className="text-slate-400 print:text-slate-500 block text-[11px]">IP Local (Gateway)</span>
              <span className="font-mono font-bold text-emerald-400 print:text-emerald-700">{report.connection_summary.local_ip}</span>
            </div>
            <div>
              <span className="text-slate-400 print:text-slate-500 block text-[11px]">Faixa DHCP</span>
              <span className="font-mono text-slate-300 print:text-slate-700">{report.connection_summary.dhcp_range}</span>
            </div>
          </div>
        </div>

        {/* 2. Inventário de Equipamentos Conectados (com prints vinculados a cada equipamento) */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 mb-3 flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-400 print:text-blue-700" />
            2. Inventário de Equipamentos Conectados ({report.equipments.length})
          </h3>

          <div className="border border-[#1D3054] print:border-slate-300 rounded-xl overflow-hidden mb-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#132238] print:bg-slate-100 text-slate-400 print:text-slate-700 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Identificação</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Modelo / Fabricante</th>
                  <th className="py-2.5 px-3">IP Local</th>
                  <th className="py-2.5 px-3">MAC Address</th>
                  <th className="py-2.5 px-3">Localização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3054] print:divide-slate-200">
                {report.equipments.map(eq => (
                  <tr key={eq.id}>
                    <td className="py-2 px-3 font-bold text-white print:text-slate-900">{eq.name}</td>
                    <td className="py-2 px-3 text-slate-300 print:text-slate-700">{eq.category.replace('_', ' ').toUpperCase()}</td>
                    <td className="py-2 px-3 text-slate-300 print:text-slate-700">{eq.manufacturer} {eq.model}</td>
                    <td className="py-2 px-3 font-mono font-bold text-emerald-400 print:text-emerald-700">{eq.local_ip || '-'}</td>
                    <td className="py-2 px-3 font-mono text-slate-300 print:text-slate-700">{eq.mac_address || '-'}</td>
                    <td className="py-2 px-3 text-slate-300 print:text-slate-700">{eq.physical_location || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Visualização Detalhada por Equipamento com Prints e Fotos Vinculadas */}
          {includeAttachments && (
            <div className="space-y-4 pt-2">
              {report.equipments.map(eq => {
                const eqAttachments = (report.attachments || []).filter(a => a.equipment_id === eq.id);
                const hasPrints = eqAttachments.length > 0 || !!eq.photo_url;

                if (!hasPrints && !eq.notes && !eq.additional_info) return null;

                return (
                  <div
                    key={`detail-${eq.id}`}
                    className="p-4 rounded-xl bg-[#132238]/60 print:bg-slate-50 border border-[#24375A] print:border-slate-300 print:break-inside-avoid space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#24375A] print:border-slate-200">
                      <div>
                        <div className="text-xs font-bold text-white print:text-slate-900 flex items-center gap-2">
                          <span>{eq.name}</span>
                          <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 print:bg-blue-100 print:text-blue-800">
                            {eq.manufacturer} {eq.model || eq.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 print:text-slate-600 mt-0.5">
                          IP: <strong className="font-mono text-emerald-400 print:text-emerald-700">{eq.local_ip}</strong> • MAC: <span className="font-mono">{eq.mac_address || 'N/A'}</span> • Local: <span>{eq.physical_location || 'Local'}</span>
                        </div>
                      </div>

                      {eq.serial_number && (
                        <div className="text-[11px] font-mono text-slate-400 print:text-slate-600">
                          S/N: <strong className="text-slate-200 print:text-slate-800">{eq.serial_number}</strong>
                        </div>
                      )}
                    </div>

                    {/* Informações Adicionais / Notas */}
                    {(eq.notes || eq.additional_info) && (
                      <div className="text-xs text-slate-300 print:text-slate-700 space-y-1">
                        {eq.notes && <div><strong>Observações Técnicas:</strong> {eq.notes}</div>}
                        {eq.additional_info && <div><strong>Informações Adicionais:</strong> {eq.additional_info}</div>}
                      </div>
                    )}

                    {/* Campos Personalizados do Modelo (Fase 8) */}
                    {eq.custom_fields && (() => {
                      let parsed: Record<string, any> = {};
                      try {
                        parsed = typeof eq.custom_fields === 'string' ? JSON.parse(eq.custom_fields) : eq.custom_fields;
                      } catch {}
                      const entries = Object.entries(parsed).filter(([_, v]) => v !== undefined && v !== '' && v !== null);
                      if (entries.length === 0) return null;
                      return (
                        <div className="text-xs text-slate-300 print:text-slate-700 bg-[#0C1525]/50 print:bg-slate-100 p-2 rounded-lg border border-slate-700/50 print:border-slate-300">
                          <strong className="text-indigo-300 print:text-indigo-800 block mb-1">Especificações do Modelo:</strong>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            {entries.map(([k, v]) => (
                              <div key={k} className="text-[11px]">
                                <span className="font-semibold capitalize text-slate-400 print:text-slate-600">{k.replace(/_/g, ' ')}:</span>{' '}
                                <span>{typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Galeria de Prints de Configuração e Fotos Vinculados a este Equipamento */}
                    {eqAttachments.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-purple-400 print:text-purple-800 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5" />
                          <span>Prints de Configuração e Anexos Vinculados ({eqAttachments.length})</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {eqAttachments.map(att => {
                            const isImg = att.mime_type.startsWith('image/');
                            const fileUrl = resolveMediaUrl(att.file_path);

                            return (
                              <div
                                key={att.id}
                                className="bg-[#0C1525] print:bg-white border border-[#1E3150] print:border-slate-300 rounded-lg p-2.5 space-y-1.5 print:break-inside-avoid shadow-sm"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-white print:text-slate-900 truncate">
                                    {att.original_name}
                                  </span>
                                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 print:bg-purple-100 print:text-purple-800 font-bold shrink-0">
                                    {att.category === 'config_print' ? 'Print de Configuração' : att.category === 'step_by_step' ? 'Passo a Passo' : 'Anexo'}
                                  </span>
                                </div>

                                {isImg ? (
                                  <div className="rounded border border-[#1E3150] print:border-slate-300 overflow-hidden bg-black/30 print:bg-slate-50 flex items-center justify-center p-1">
                                    <img
                                      src={fileUrl}
                                      alt={att.original_name}
                                      className="max-h-56 w-auto object-contain rounded print:max-h-64"
                                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                    />
                                  </div>
                                ) : (
                                  <div className="p-3 bg-[#132238] print:bg-slate-100 rounded text-center text-xs text-slate-400 print:text-slate-600 flex items-center justify-center gap-2">
                                    <FileDown className="w-4 h-4 text-purple-400 print:text-purple-700" />
                                    <span>Arquivo Técnico: {att.original_name} ({Math.round(att.file_size / 1024)} KB)</span>
                                  </div>
                                )}

                                {att.notes && (
                                  <p className="text-[11px] text-slate-300 print:text-slate-700 bg-[#132238]/60 print:bg-slate-100 p-1.5 rounded leading-relaxed">
                                    <strong>Instruções / Notas:</strong> {att.notes}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Matriz de Redirecionamento de Portas (NAT) */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 mb-3 flex items-center gap-2">
            <Share2 className="w-4 h-4 text-amber-400 print:text-amber-700" />
            3. Regras de Redirecionamento de Portas (NAT)
          </h3>

          <div className="border border-[#1D3054] print:border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#132238] print:bg-slate-100 text-slate-400 print:text-slate-700 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Serviço</th>
                  <th className="py-2.5 px-3">Porta Externa (WAN)</th>
                  <th className="py-2.5 px-3">Destino Interno (LAN)</th>
                  <th className="py-2.5 px-3">Protocolo</th>
                  <th className="py-2.5 px-3">Caminho no Roteador</th>
                  <th className="py-2.5 px-3">Status de Teste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3054] print:divide-slate-200">
                {report.port_forwards.map(p => (
                  <tr key={p.id}>
                    <td className="py-2 px-3 font-bold text-white print:text-slate-900">{p.service_name}</td>
                    <td className="py-2 px-3 font-mono font-bold text-amber-300 print:text-amber-800">{p.source_wan_ip}:{p.external_port}</td>
                    <td className="py-2 px-3 font-mono font-bold text-emerald-400 print:text-emerald-700">{p.destination_local_ip}:{p.internal_port}</td>
                    <td className="py-2 px-3 font-semibold text-slate-300 print:text-slate-700">{p.protocol}</td>
                    <td className="py-2 px-3 font-mono text-[10px] text-slate-400 print:text-slate-600">{p.router_config_path || '-'}</td>
                    <td className="py-2 px-3 font-semibold">
                      <span className={p.status === 'funcionando' ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Credenciais Técnicas de Acesso */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 mb-3 flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400 print:text-purple-700" />
            4. Credenciais Técnicas de Acesso
          </h3>

          <div className="border border-[#1D3054] print:border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#132238] print:bg-slate-100 text-slate-400 print:text-slate-700 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Identificação</th>
                  <th className="py-2.5 px-3">Dispositivo</th>
                  <th className="py-2.5 px-3">Usuário</th>
                  <th className="py-2.5 px-3">Senha</th>
                  <th className="py-2.5 px-3">URL / IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3054] print:divide-slate-200">
                {report.credentials.map(c => (
                  <tr key={c.id}>
                    <td className="py-2 px-3 font-bold text-white print:text-slate-900">{c.name}</td>
                    <td className="py-2 px-3 text-slate-300 print:text-slate-700">{c.equipment_name || '-'}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-200 print:text-slate-800">{c.username}</td>
                    <td className="py-2 px-3 font-mono font-bold text-emerald-400 print:text-emerald-700">{c.password}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-blue-400 print:text-blue-700">{c.access_url || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!includePasswords && (
            <div className="text-[10px] text-slate-400 print:text-slate-500 mt-1 italic">
              * Senhas mascaradas por padrão no relatório por motivos de conformidade de segurança.
            </div>
          )}
        </div>

        {/* 5. Documentação Técnica, Telas de Configuração e Passo a Passo Ilustrado */}
        {includeAttachments && imageAttachments.length > 0 && (
          <div className="print:break-inside-avoid space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-400 print:text-indigo-700" />
              5. Documentação Técnica, Passo a Passo e Telas de Configuração
            </h3>

            <div className="space-y-4">
              {imageAttachments.map((att, idx) => {
                const fileUrl = resolveMediaUrl(att.file_path);
                const linkedEq = report.equipments.find(e => e.id === att.equipment_id);

                return (
                  <div
                    key={att.id}
                    className="p-4 rounded-xl bg-[#132238]/60 print:bg-slate-50 border border-[#24375A] print:border-slate-300 print:break-inside-avoid space-y-2.5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#24375A] print:border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white print:text-slate-900">
                          {idx + 1}. {att.original_name}
                        </span>
                        {linkedEq ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 print:bg-blue-100 print:text-blue-800">
                            Equipamento: {linkedEq.name} ({linkedEq.model || linkedEq.category})
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-500/20 text-slate-300 print:bg-slate-200 print:text-slate-700">
                            Geral da Instalação
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 print:text-slate-500 font-mono">
                        {new Date(att.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {/* Descrição do Passo a Passo / Procedimento */}
                    {att.notes && (
                      <div className="p-2.5 rounded-lg bg-blue-950/30 print:bg-blue-50 border border-blue-500/20 print:border-blue-200 text-xs text-blue-200 print:text-blue-900 leading-relaxed">
                        <strong className="block mb-0.5 text-blue-400 print:text-blue-700 text-[11px] uppercase tracking-wider">
                          Instruções Técnicas / Passo a Passo:
                        </strong>
                        <span className="whitespace-pre-line">{att.notes}</span>
                      </div>
                    )}

                    {/* Imagem do Print em Alta Resolução */}
                    <div className="rounded-lg border border-[#1E3150] print:border-slate-300 overflow-hidden bg-black/40 print:bg-white p-2 flex items-center justify-center">
                      <img
                        src={fileUrl}
                        alt={att.original_name}
                        className="max-h-96 w-auto object-contain rounded shadow-md print:max-h-[480px]"
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Histórico de Atendimentos & Manutenções Técnicas */}
        {report.service_orders && report.service_orders.length > 0 && (
          <div className="print:break-inside-avoid">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 print:text-slate-700 mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
              6. Histórico de Atendimentos & Manutenções Técnicas ({report.service_orders.length})
            </h3>

            <div className="border border-[#1D3054] print:border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#132238] print:bg-slate-100 text-slate-400 print:text-slate-700 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Data / Hora</th>
                    <th className="py-2.5 px-3">Serviço / Escopo</th>
                    <th className="py-2.5 px-3">Técnico</th>
                    <th className="py-2.5 px-3">Tempo Gasto</th>
                    <th className="py-2.5 px-3">Custo Serviço</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D3054] print:divide-slate-200">
                  {report.service_orders.map(order => {
                    const orderMinutes = Number(order.time_spent_minutes || 0);
                    const formattedTime = orderMinutes >= 60
                      ? `${Math.floor(orderMinutes / 60)}h ${orderMinutes % 60 > 0 ? (orderMinutes % 60) + 'm' : ''}`.trim()
                      : `${orderMinutes} min`;

                    return (
                      <tr key={order.id}>
                        <td className="py-2 px-3 font-mono text-slate-300 print:text-slate-700">{order.date_time}</td>
                        <td className="py-2 px-3 font-bold text-white print:text-slate-900">
                          {order.service_type}
                          {order.problem_description && (
                            <span className="block font-normal text-[11px] text-slate-400 print:text-slate-500 mt-0.5">
                              {order.problem_description}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-300 print:text-slate-700">{order.technician_name}</td>
                        <td className="py-2 px-3 font-mono text-blue-400 print:text-blue-700 font-semibold">{formattedTime}</td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-400 print:text-emerald-700">
                          R$ {Number(order.service_cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 font-semibold uppercase">
                          <span className={order.status === 'concluido' ? 'text-emerald-400 print:text-emerald-700' : 'text-blue-400 print:text-blue-700'}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. Observações Finais e Assinatura Técnica */}
        <div className="pt-6 border-t border-[#1D3054] print:border-slate-300 text-xs text-slate-300 print:text-slate-700 space-y-4 print:break-inside-avoid">
          <div>
            <div className="font-bold text-white print:text-slate-900 mb-1">Observações de Conclusão Técnica:</div>
            <p className="leading-relaxed bg-[#132238]/60 print:bg-slate-50 p-3 rounded-lg border border-[#24375A] print:border-slate-200">
              {report.latest_service_order?.technical_notes || 'Infraestrutura homologada com sucesso. Roteador, regras de portas e dispositivos operacionais conforme especificações do relatório.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
            <div className="space-y-1">
              <div className="border-t border-slate-600 print:border-slate-400 pt-1 font-bold text-white print:text-slate-900">
                {report.latest_service_order?.technician_name || 'Liverton Aguiar'}
              </div>
              <div className="text-[11px] text-slate-400 print:text-slate-500">
                Responsável Técnico — RedeDoc
              </div>
            </div>

            <div className="space-y-1">
              <div className="border-t border-slate-600 print:border-slate-400 pt-1 font-bold text-white print:text-slate-900">
                {report.client.name}
              </div>
              <div className="text-[11px] text-slate-400 print:text-slate-500">
                Administração / Síndico / Gestor de TI
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
