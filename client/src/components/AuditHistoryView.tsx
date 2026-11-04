import React, { useState, useEffect } from 'react';
import {
  History,
  Server,
  Share2,
  Lock,
  ArrowRight,
  Filter,
  User,
  Calendar
} from 'lucide-react';
import { AuditHistory, Client } from '../types';
import { api } from '../services/api';

interface AuditHistoryViewProps {
  client: Client;
}

export const AuditHistoryView: React.FC<AuditHistoryViewProps> = ({ client }) => {
  const [logs, setLogs] = useState<AuditHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getAuditHistory(client.id);
        setLogs(data);
      } catch (err) {
        console.error('Erro ao carregar histórico:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [client.id]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#101C31] border border-[#1D3054] rounded-2xl p-6 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <History className="w-6 h-6 text-blue-400" />
            Histórico Técnico e Auditoria de Alterações
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Rastreabilidade completa de trocas de IPs, reservas de MAC, modelos de equipamentos e regras de firewall
          </p>
        </div>
      </div>

      {/* Tabela de Histórico */}
      <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0D172A] border-b border-[#1D3054] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Data / Hora</th>
                <th className="py-3.5 px-4">Ação</th>
                <th className="py-3.5 px-4">Entidade Afetada</th>
                <th className="py-3.5 px-4">Campo Alterado</th>
                <th className="py-3.5 px-4">Modificação (Anterior → Novo)</th>
                <th className="py-3.5 px-4">Técnico Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D3054]/60">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-[#14233D] transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      {log.action}
                    </span>
                  </td>

                  <td className="py-3 px-4 font-semibold text-white">
                    {log.entity_name}
                  </td>

                  <td className="py-3 px-4 text-slate-300">
                    {log.field_name || 'N/A'}
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      {log.old_value && (
                        <>
                          <span className="text-slate-400 line-through truncate max-w-xs">{log.old_value}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </>
                      )}
                      <span className="text-emerald-400 font-bold truncate max-w-xs">{log.new_value || '-'}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{log.user_name}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
