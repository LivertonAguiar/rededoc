import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  X,
  CheckCircle2,
  Sparkles,
  WifiOff,
  Clock,
  Image as ImageIcon,
  Tag,
  FileText
} from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';
import { enqueueUpload, processOfflineQueue } from '../utils/offlineQueue';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  locationId?: string;
  equipmentId?: string;
  serviceOrderId?: string;
  onSuccess: () => void;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  clientId,
  locationId,
  equipmentId,
  serviceOrderId,
  onSuccess,
  title = 'Captura de Foto em Campo'
}) => {
  const { showToast } = useDialog();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<'foto_campo' | 'antes_servico' | 'depois_servico' | 'config_print' | 'documento'>('foto_campo');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      // Comprime a foto no cliente (Canvas -> max 1600px lado maior)
      const compressed = await compressImage(file, 1600, 0.85);
      setSelectedFile(compressed);

      const objectUrl = URL.createObjectURL(compressed);
      setPreviewUrl(objectUrl);
    } catch (err: any) {
      showToast('Erro ao processar imagem: ' + err.message, 'error');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast('Por favor, tire uma foto ou selecione uma imagem.', 'warning');
      return;
    }

    setIsUploading(true);

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (isOffline) {
      // Modo offline (sem conexão ou modo avião): salva na fila IndexedDB
      try {
        await enqueueUpload(selectedFile, {
          clientId,
          locationId,
          equipmentId,
          serviceOrderId,
          category,
          notes: notes.trim() || undefined,
          fileName: selectedFile.name
        });

        showToast('Foto salva offline! O envio será realizado automaticamente ao reconectar.', 'info');
        onSuccess();
        onClose();
      } catch (err: any) {
        showToast('Erro ao gravar foto na fila offline: ' + err.message, 'error');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Modo online: tenta envio imediato com fallback para fila em caso de instabilidade
    try {
      await api.uploadAttachment(selectedFile, {
        clientId,
        locationId,
        equipmentId,
        serviceOrderId,
        category,
        notes: notes.trim() || undefined,
        fileName: selectedFile.name
      });

      showToast('Foto enviada com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      // Falha de rede: enfileira automaticamente no IndexedDB
      try {
        await enqueueUpload(selectedFile, {
          clientId,
          locationId,
          equipmentId,
          serviceOrderId,
          category,
          notes: notes.trim() || undefined,
          fileName: selectedFile.name
        });

        showToast('Falha de conexão. Foto salva na fila e será enviada assim que a internet voltar.', 'info');
        onSuccess();
        onClose();
      } catch (queueErr: any) {
        showToast('Erro no envio: ' + err.message, 'error');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0F172A] border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{title}</h3>
              <p className="text-[11px] text-slate-400">Tire foto com a câmera ou anexe da galeria</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inputs ocultos de Câmera e Galeria */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
          {/* Pré-visualização / Botões de Captura */}
          {previewUrl ? (
            <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 h-52 flex items-center justify-center group">
              <img
                src={previewUrl}
                alt="Foto capturada"
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg bg-black/75 hover:bg-black text-white text-[10px] font-semibold flex items-center gap-1 backdrop-blur-sm"
                >
                  <Camera className="w-3 h-3" /> Tirar Outra
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isCompressing}
                className="p-5 rounded-2xl bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-300 flex flex-col items-center justify-center gap-2 transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30 group-hover:scale-105 transition">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="font-bold text-xs text-white">Tirar Foto</span>
                <span className="text-[10px] text-blue-400/80">Câmera Traseira</span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isCompressing}
                className="p-5 rounded-2xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-slate-300 flex flex-col items-center justify-center gap-2 transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-slate-200 group-hover:scale-105 transition">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="font-bold text-xs text-white">Galeria</span>
                <span className="text-[10px] text-slate-400">Escolher Arquivo</span>
              </button>
            </div>
          )}

          {isCompressing && (
            <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-blue-300 text-center text-xs flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Otimizando imagem para upload rápido em campo...</span>
            </div>
          )}

          {/* Categoria do Anexo */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Categoria da Foto</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-xs"
            >
              <option value="foto_campo">Foto do Equipamento / Rack no Local</option>
              <option value="antes_servico">Estado Anterior (Antes do Serviço)</option>
              <option value="depois_servico">Resultado Final (Depois do Serviço)</option>
              <option value="config_print">Print de Configuração / Tela do Roteador</option>
              <option value="documento">Ordem de Serviço Assinada / Documento</option>
            </select>
          </div>

          {/* Legenda / Observações */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Legenda / Descrição da Foto</label>
            <input
              type="text"
              placeholder="Ex: Etiqueta de patrimônio no rack ou detalhe do cabo de fibra"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#0B132B] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          {/* Indicador de Modo Offline */}
          {typeof navigator !== 'undefined' && !navigator.onLine && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Você está sem conexão. A foto será enfileirada no celular e enviada ao reconectar.</span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!selectedFile || isUploading || isCompressing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold shadow transition"
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Salvar Foto</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

