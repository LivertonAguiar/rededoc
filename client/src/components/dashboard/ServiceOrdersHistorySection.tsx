import React from 'react';
import { History, DollarSign, Clock, Plus, Calendar, Edit, Info } from 'lucide-react';
import { ServiceOrder } from '../../types';

interface ServiceOrdersHistorySectionProps {
  serviceOrders: ServiceOrder[];
  loadingOrders: boolean;
  totalServiceCost: number;
  formattedTotalTime: string;
  onOpenNewOrder: () => void;
  onOpenEditOrder: (order: ServiceOrder) => void;
}

export const ServiceOrdersHistorySection: React.FC<ServiceOrdersHistorySectionProps> = ({
  serviceOrders,
  loadingOrders,
  totalServiceCost,
  formattedTotalTime,
  onOpenNewOrder,
  onOpenEditOrder
}) => {
  return (
    <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-5 shadow-xl space-y-4">
      {/* Cabeçalho do Histórico com Totalizadores */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1D3054]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Histórico de Atendimentos & Serviços Técnicos
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Fixado no Cliente
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Custos de serviços realizados, tempo técnico investido e histórico de intervenções neste local
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Total Faturado */}
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Total Investido</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                R$ {totalServiceCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Horas Totais */}
          <div className="px-3.5 py-1.5 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Tempo Total</span>
              <span className="text-sm font-bold text-blue-400 font-mono">
                {formattedTotalTime}
              </span>
            </div>
          </div>

          {/* Total de Atendimentos */}
          <div className="px-3 py-1.5 rounded-xl bg-[#0C1525] border border-[#1E3150] hidden sm:block">
            <span className="text-[10px] text-slate-400 block font-medium">Registros</span>
            <span className="text-xs font-bold text-slate-200">
              {serviceOrders.length} atendimentos
            </span>
          </div>

          {/* Botão Novo Atendimento */}
          <button
            onClick={onOpenNewOrder}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20 transition shrink-0"
            title="Registrar novo atendimento para este cliente"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Atendimento</span>
          </button>
        </div>
      </div>

      {/* Lista de Atendimentos Fixados */}
      {loadingOrders ? (
        <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <span className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></span>
          <span>Carregando histórico do cliente...</span>
        </div>
      ) : serviceOrders.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-[#1E3150] text-center bg-[#091122]/40 space-y-2">
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
            <History className="w-4 h-4" />
          </div>
          <p className="text-xs text-slate-300 font-semibold">
            Nenhum atendimento técnico registrado para este cliente ainda
          </p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Registre a primeira visita ou troca de equipamento para documentar custos, tempo técnico gasto e escopo do chamado.
          </p>
          <button
            onClick={onOpenNewOrder}
            className="mt-2 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Primeiro Atendimento</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {serviceOrders.map(order => {
            const orderCost = Number(order.service_cost || 0);
            const orderMinutes = Number(order.time_spent_minutes || 0);
            const orderHoursStr = orderMinutes >= 60
              ? `${Math.floor(orderMinutes / 60)}h ${orderMinutes % 60 > 0 ? (orderMinutes % 60) + 'm' : ''}`.trim()
              : `${orderMinutes} min`;

            return (
              <div
                key={order.id}
                className="bg-[#0C1525] border border-[#1E3150] hover:border-emerald-500/40 rounded-xl p-4 flex flex-col justify-between transition-all duration-200 shadow-md group"
              >
                <div className="space-y-2.5">
                  {/* Top Row: Data, Status e Ação */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>{order.date_time}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        order.status === 'concluido'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : order.status === 'em_andamento'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        {order.status}
                      </span>

                      <button
                        onClick={() => onOpenEditOrder(order)}
                        className="p-1 rounded-lg bg-[#14233c] hover:bg-blue-600/30 text-slate-300 hover:text-white transition"
                        title="Editar atendimento, valores e informações adicionais"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Título do Serviço */}
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {order.service_type}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Técnico: <strong className="text-slate-300 font-medium">{order.technician_name}</strong>
                    </span>
                  </div>

                  {/* Destaque Financeiro e Tempo Gasto */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <span className="text-[9px] text-slate-400 block uppercase font-medium">Custo Serviço</span>
                      <span className="text-xs font-bold text-emerald-400 font-mono">
                        R$ {orderCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                      <span className="text-[9px] text-slate-400 block uppercase font-medium">Tempo Gasto</span>
                      <span className="text-xs font-bold text-blue-400 font-mono flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3" />
                        {orderHoursStr}
                      </span>
                    </div>
                  </div>

                  {/* Descrição do Problema */}
                  {order.problem_description && (
                    <p className="text-xs text-slate-300/90 line-clamp-2 leading-relaxed bg-[#101C31] p-2 rounded-lg border border-[#1A2C49]">
                      {order.problem_description}
                    </p>
                  )}

                  {/* Informações Adicionais Gerais */}
                  {order.additional_info && (
                    <div className="p-2 rounded-lg bg-blue-950/30 border border-blue-500/20 text-[11px] text-blue-200">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">
                        <Info className="w-3 h-3" />
                        <span>Informações Adicionais:</span>
                      </div>
                      <p className="line-clamp-2 leading-snug">{order.additional_info}</p>
                    </div>
                  )}
                </div>

                {/* Rodapé do Card */}
                <div className="pt-2 mt-2 border-t border-[#182845] flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate max-w-[170px]">
                    {order.technical_notes ? `Obs: ${order.technical_notes}` : 'Manutenção registrada'}
                  </span>
                  <button
                    onClick={() => onOpenEditOrder(order)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 hover:underline shrink-0"
                  >
                    <span>Ver detalhes</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
