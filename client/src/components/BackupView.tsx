import React, { useState } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';

interface BackupViewProps {
  onRefresh: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({ onRefresh }) => {
  const { showToast, confirm } = useDialog();
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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
            Configurações, Backup e Restauração
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Persistência segura, exportação de dumps completos e restauração integral de infraestruturas
          </p>
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

      {/* Grid de Opções de Backup */}
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
              className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
              title="Baixar pacote completo com banco SQLite e pasta de uploads"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Pacote Completo (.ZIP)</span>
            </button>
            <button
              onClick={handleDownloadBackup}
              className="py-3 px-3 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-[#172744] hover:bg-[#20365D] border border-[#24375A] transition-all flex items-center justify-center gap-1.5"
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
    </div>
  );
};
