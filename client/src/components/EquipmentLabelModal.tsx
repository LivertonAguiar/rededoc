import React from 'react';
import { Printer, X, QrCode, Tag, Check, Copy } from 'lucide-react';
import { Equipment, Client } from '../types';
import { useDialog } from '../context/DialogContext';

interface EquipmentLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;
  client: Client;
}

export const EquipmentLabelModal: React.FC<EquipmentLabelModalProps> = ({
  isOpen,
  onClose,
  equipment,
  client
}) => {
  const { showToast } = useDialog();

  if (!isOpen || !equipment) return null;

  const handlePrint = () => {
    window.print();
  };

  const qrPayload = JSON.stringify({
    system: 'RedeDoc',
    id: equipment.id,
    name: equipment.name,
    ip: equipment.local_ip,
    mac: equipment.mac_address,
    client: client.name
  });

  // Gera QR Code SVG seguro através da API rápida de QR ou representação visual direta
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrPayload)}&margin=1`;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
    >
      <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 print:p-0 print:border-none print:shadow-none print:bg-white">
        {/* Cabeçalho do Modal (Oculto na Impressão) */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1D3054] print:hidden">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white">Etiqueta de Identificação Técnica</h2>
              <p className="text-[10px] text-slate-400">Pronta para impressão em etiquetas adesivas ou papel térmico</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ÁREA DA ETIQUETA ADESIVA (Formatada para tela e impressora) */}
        <div className="bg-white text-slate-900 rounded-xl p-5 border-2 border-slate-300 shadow-md font-sans print:border-2 print:border-black print:rounded-none print:shadow-none print:p-4 max-w-md mx-auto">
          {/* Topo da Etiqueta */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm tracking-tight text-blue-900 print:text-black">RedeDoc</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300 text-slate-700 print:border-black">
                {equipment.category.replace('_', ' ')}
              </span>
            </div>
            <div className="text-[10px] font-semibold text-slate-600 truncate max-w-[170px] print:text-black">
              {client.identification_name || client.name}
            </div>
          </div>

          {/* Corpo da Etiqueta */}
          <div className="flex gap-4 items-center">
            {/* Dados Textuais */}
            <div className="flex-1 space-y-1 text-xs">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Dispositivo</span>
                <span className="font-extrabold text-sm text-slate-900 leading-tight block">{equipment.name}</span>
                <span className="text-[11px] text-slate-700 font-medium">{equipment.manufacturer} {equipment.model}</span>
              </div>

              <div className="pt-1 grid grid-cols-2 gap-1 text-[11px]">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">IP Local</span>
                  <span className="font-mono font-bold text-blue-800 print:text-black text-xs">{equipment.local_ip || 'Sem IP'}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Gateway</span>
                  <span className="font-mono font-medium text-slate-800 text-[10px]">{equipment.gateway || '192.168.1.1'}</span>
                </div>
              </div>

              <div className="pt-0.5">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">MAC Address</span>
                <span className="font-mono font-bold text-slate-900 text-[11px]">{equipment.mac_address || 'NÃO CADASTRADO'}</span>
              </div>

              {equipment.serial_number && (
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Serial (S/N)</span>
                  <span className="font-mono font-semibold text-slate-700 text-[10px]">{equipment.serial_number}</span>
                </div>
              )}
            </div>

            {/* QR Code Técnico */}
            <div className="shrink-0 flex flex-col items-center">
              <div className="w-24 h-24 p-1 bg-white border border-slate-300 rounded flex items-center justify-center print:border-black">
                <img
                  src={qrCodeUrl}
                  alt={`QR Code: ${equipment.name}`}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-[8px] font-mono font-bold text-slate-500 mt-0.5 uppercase tracking-wider">
                ID: {equipment.id.slice(0, 10)}
              </span>
            </div>
          </div>

          {/* Rodapé da Etiqueta */}
          <div className="border-t border-slate-200 mt-2.5 pt-1.5 flex justify-between items-center text-[9px] text-slate-500 font-mono print:text-black">
            <span>Local: {equipment.physical_location || 'Rack Principal'}</span>
            <span>{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        {/* Ações do Modal (Ocultas na Impressão) */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1D3054] print:hidden text-xs">
          <p className="text-[11px] text-slate-400">
            Dica: No diálogo de impressão, escolha o formato de papel térmico (ex: 80x50mm) ou A4 adesivo.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#172744] hover:bg-[#20365D]"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/25 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Etiqueta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

