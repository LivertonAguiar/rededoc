import React from 'react';
import { CheckCircle2, Edit } from 'lucide-react';

interface TechnicalNotesCardProps {
  notes?: string | null;
  onOpenNotesModal: () => void;
}

export const TechnicalNotesCard: React.FC<TechnicalNotesCardProps> = ({
  notes,
  onOpenNotesModal
}) => {
  return (
    <div className="bg-[#101C31] border border-[#1D3054] rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-[#1D3054] mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Observações Técnicas
        </h3>
        <button
          onClick={onOpenNotesModal}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#172744] hover:bg-[#20365D] text-blue-400 hover:text-blue-300 text-xs font-semibold transition-colors"
          title="Editar observações técnicas"
        >
          <Edit className="w-3 h-3" /> Editar
        </button>
      </div>

      {notes ? (
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
          {notes}
        </p>
      ) : (
        <div className="p-3 rounded-xl bg-[#091122]/60 border border-[#182845] text-center">
          <p className="text-xs text-slate-400">
            Nenhuma observação técnica registrada para este cliente.
          </p>
          <button
            onClick={onOpenNotesModal}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 font-semibold underline"
          >
            Adicionar observação
          </button>
        </div>
      )}
    </div>
  );
};
