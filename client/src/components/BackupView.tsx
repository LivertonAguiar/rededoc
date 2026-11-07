import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Bell,
  Send,
  Play,
  Clock,
  ExternalLink,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { NotificationSetting, NotificationLog } from '../types';

interface BackupViewProps {
  onRefresh: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({ onRefresh }) => {
  const { showToast, confirm } = useDialog();

  const [activeTab, setActiveTab] = useState<'backup' | 'alerts'>('backup');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Estados de Configuração de Notificações (Fase 3)
  const [webhookUrl, setWebhookUrl] = useState('');
  const [advanceDays, setAdvanceDays] = useState('30,7,0');
  const [isActive, setIsActive] = useState(true);
  const [settingId, setSettingId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [dispatchingNow, setDispatchingNow] = useState(false);

  // Histórico de Alertas
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadAlertSettings = async () => {
    try {
      const settings = await api.getNotificationSettings();
      if (settings && settings.length > 0) {
        const primary = settings[0];
        setSettingId(primary.id);
        setWebhookUrl(primary.target_url || '');
        setAdvanceDays(primary.advance_days || '30,7,0');
        setIsActive(Boolean(primary.is_active));
      }
    } catch (err) {
      console.error('Erro ao carregar configurações de alerta:', err);
    }
  };

  const loadLogs = async () => {
    try {
      setLoadingLogs(true);
      const data = await api.getNotificationLogs();
      setLogs(data);
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'alerts') {
      loadAlertSettings();
      loadLogs();
    }
  }, [activeTab]);

  const handleSaveAlertSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      await api.saveNotificationSetting({
        id: settingId || undefined,
        channel: 'webhook',
        target_url: webhookUrl.trim() || null,
        advance_days: advanceDays.trim() || '30,7,0',
        is_active: isActive ? 1 : 0
      });
      showToast('Configurações de alerta salvas com sucesso!', 'success');
      await loadAlertSettings();
    } catch (err: any) {
      showToast('Erro ao salvar alertas: ' + err.message, 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      showToast('Informe a URL do webhook antes de testar.', 'error');
      return;
    }
    try {
      setTestingWebhook(true);
      const res = await api.testNotificationWebhook(webhookUrl.trim());
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
      await loadLogs();
    } catch (err: any) {
      showToast(err.message || 'Falha ao testar webhook', 'error');
      await loadLogs();
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleDispatchNow = async () => {
    try {
      setDispatchingNow(true);
      const res = await api.dispatchNotificationsNow();
      showToast(`Processamento concluído: ${res.totalDispatched} enviados, ${res.skippedDuplicates} desduplicados, ${res.errors} erros.`, 'info');
      await loadLogs();
    } catch (err: any) {
      showToast('Erro ao disparar verificação: ' + err.message, 'error');
    } finally {
      setDispatchingNow(false);
    }
  };

  const handleDownloadBackup = () => {
    window.location.href = api.exportBackupUrl();
  };

  const handleDownloadZipBackup = () => {
    window.location.href = api.exportBackupZipUrl();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    confirm({
      title: 'Restaurar Backup do Banco de Dados',
      message: 'Atenção: A restauração substituirá todos os dados existentes no sistema pelo conteúdo do arquivo de backup. Deseja prosseguir?',
      confirmText: 'Restaurar Banco de Dados',
      danger: true,
      onConfirm: async () => {
        setImporting(true);
        setMessage(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const json = JSON.parse(event.target?.result as string);
            const res = await api.importBackup(json);
            setMessage({ text: res.message || 'Backup restaurado com sucesso!', type: 'success' });
            showToast('Backup restaurado com sucesso!', 'success');
            onRefresh();
          } catch (err: any) {
            setMessage({ text: 'Falha na restauração: ' + err.message, type: 'error' });
            showToast('Falha na restauração: ' + err.message, 'error');
          } finally {
            setImporting(false);
            e.target.value = '';
          }
        };
        reader.readAsText(file);
      },
      onCancel: () => {
        e.target.value = '';
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Database className="w-6 h-6 text-blue-400" />
            Configurações e Administração do Sistema
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestão de persistência, dumps de banco de dados e canais de alertas automatizados.
          </p>
        </div>

        {/* Abas Superiores */}
        <div className="flex items-center gap-1.5 p-1 bg-[#091122] border border-[#1b2b48] rounded-xl text-xs">
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'backup'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Banco & Backup</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'alerts'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Alertas & Webhooks</span>
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
          message.type === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{message.text}</span>
        </div>
      )}

      {activeTab === 'backup' ? (
        /* ABA 1: BACKUP E RESTAURAÇÃO */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Exportar Backup */}
            <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold">
                  <Download className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-white">Exportar Backup Completo</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Gera uma cópia integral da infraestrutura. O formato <strong className="text-white">ZIP</strong> inclui o banco de dados binário SQLite (<code className="text-emerald-400 font-mono">rededoc.sqlite</code>), todos os arquivos e fotos de equipamentos (<code className="text-blue-400 font-mono">uploads/</code>), e o manifesto JSON com criptografia AES-256-GCM preservada.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleDownloadZipBackup}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  title="Baixar pacote completo com banco SQLite e pasta de uploads"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar Pacote Completo (.ZIP)</span>
                </button>
                <button
                  onClick={handleDownloadBackup}
                  className="py-3 px-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#172744] hover:bg-[#20365D] border border-[#24375A] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Baixar apenas registros em JSON"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Apenas JSON</span>
                </button>
              </div>
            </div>

            {/* Restaurar Backup */}
            <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Upload className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-white">Restaurar Base de Dados</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Substitui a base atual pelo conteúdo do arquivo de backup selecionado. Recomendado antes de manutenções críticas ou transferências de servidor.
                </p>
              </div>

              <label className="w-full py-3 rounded-xl text-xs font-bold text-slate-200 bg-[#172744] hover:bg-[#20365D] border border-[#24375A] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>{importing ? 'Restaurando...' : 'Selecionar Arquivo para Restaurar'}</span>
                <input
                  type="file"
                  accept=".json"
                  disabled={importing}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Informações do Runtime e Banco */}
          <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-400" />
              Informações Técnicas do Armazenamento
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-[#0B132B] border border-[#1D3054]">
                <span className="text-slate-400 block text-[11px]">Motor de Banco de Dados</span>
                <span className="font-bold text-slate-200 mt-0.5 block">SQLite 3 Nativo (node:sqlite)</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0B132B] border border-[#1D3054]">
                <span className="text-slate-400 block text-[11px]">Modo de Transação</span>
                <span className="font-bold text-emerald-400 mt-0.5 block font-mono">WAL (Write-Ahead Logging)</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0B132B] border border-[#1D3054]">
                <span className="text-slate-400 block text-[11px]">Segurança do Cofre</span>
                <span className="font-bold text-blue-400 mt-0.5 block font-mono">AES-256-GCM + SHA-256</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ABA 2: ALERTAS E WEBHOOKS (FASE 3) */
        <div className="space-y-6">
          <form onSubmit={handleSaveAlertSettings} className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Canal de Notificações via Webhook</h3>
                  <p className="text-[11px] text-slate-400">
                    Dispara requisições POST JSON compatíveis com ntfy.sh, bots de Telegram e gateways corporativos.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-semibold text-slate-200">
                  {isActive ? 'Canal Ativo' : 'Canal Desativado'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8 space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  URL de Destino do Webhook (POST JSON)
                </label>
                <input
                  type="url"
                  placeholder="https://ntfy.sh/minha_empresa_redes_alertas ou https://api.telegram.org/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#091122] border border-[#1b2b48] text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="md:col-span-4 space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Antecedência de Aviso (dias)
                </label>
                <input
                  type="text"
                  placeholder="30,7,0"
                  value={advanceDays}
                  onChange={(e) => setAdvanceDays(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#091122] border border-[#1b2b48] text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-slate-500 block">Ex: 30, 7 e 0 (dia do vencimento)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1D3054]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={testingWebhook || !webhookUrl}
                  onClick={handleTestWebhook}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#172744] hover:bg-[#20365D] text-slate-200 border border-[#24375A] text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>{testingWebhook ? 'Testando...' : 'Testar Envio de Webhook'}</span>
                </button>

                <button
                  type="button"
                  disabled={dispatchingNow}
                  onClick={handleDispatchNow}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#172744] hover:bg-[#20365D] text-slate-200 border border-[#24375A] text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                  title="Executa agora a verificação diária sem aguardar as 08:00"
                >
                  <Play className="w-3.5 h-3.5 text-blue-400" />
                  <span>{dispatchingNow ? 'Verificando...' : 'Verificar e Disparar Agora'}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/20 transition cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{savingSettings ? 'Gravando...' : 'Salvar Configurações'}</span>
              </button>
            </div>
          </form>

          {/* HISTÓRICO DE ALERTAS DISPARADOS */}
          <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3054]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-white">Histórico de Alertas Disparados</h3>
              </div>

              <button
                type="button"
                onClick={loadLogs}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Atualizar lista de logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
              {loadingLogs ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Carregando histórico...
                </div>
              ) : logs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Nenhum envio registrado ainda.
                </div>
              ) : (
                logs.map(log => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-[#091122] border border-[#1b2b48] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {log.status}
                        </span>
                        <span className="font-semibold text-slate-200 truncate">
                          {log.message}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-3">
                        <span>Canal: <strong className="text-slate-300">{log.channel}</strong></span>
                        <span>Data de Envio: {log.sent_at}</span>
                        <span>Registro: {log.created_at ? log.created_at.slice(0, 19).replace('T', ' ') : ''}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
