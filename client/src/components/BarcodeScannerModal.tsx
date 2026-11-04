import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, Zap, CheckCircle2, AlertTriangle, Scan } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  targetField: 'mac' | 'serial' | 'any';
  onScan: (scannedValue: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  title = 'Leitor Óptico de Código de Barras / QR Code',
  targetField,
  onScan
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [manualInput, setManualInput] = useState<string>('');

  // Toca bip sonoro suave ao identificar o código
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880; // A5
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // AudioContext não suportado ou bloqueado
    }
  };

  // Formata strings hexadecimais para o padrão MAC (XX:XX:XX:XX:XX:XX)
  const formatIfMac = (val: string): string => {
    const cleaned = val.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    if (cleaned.length === 12) {
      return cleaned.match(/.{1,2}/g)?.join(':') || val;
    }
    return val;
  };

  const handleDetected = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;

    playBeep();
    if (targetField === 'mac') {
      onScan(formatIfMac(trimmed));
    } else {
      onScan(trimmed);
    }
    stopCamera();
    onClose();
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Inicializa o acesso à câmera
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let active = true;

    async function startCamera() {
      setCameraError(null);
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (!active) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }

        // Verifica suporte a Lanterna
        const track = mediaStream.getVideoTracks()[0];
        const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        if (caps.torch) {
          setHasTorch(true);
        }
      } catch (err: any) {
        setCameraError(
          err.name === 'NotAllowedError'
            ? 'Permissão da câmera negada. Habilite o acesso à câmera no navegador.'
            : 'Câmera não encontrada ou ocupada por outro aplicativo.'
        );
      }
    }

    startCamera();

    return () => {
      active = false;
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Loop de detecção com a API nativa BarcodeDetector (quando suportada)
  useEffect(() => {
    if (!isOpen || !stream || !videoRef.current) return;

    let timer: any = null;
    let cancelled = false;

    if ('BarcodeDetector' in window) {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix', 'upc_a']
      });

      const detectFrame = async () => {
        if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
          timer = setTimeout(detectFrame, 200);
          return;
        }

        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0 && !cancelled) {
            handleDetected(barcodes[0].rawValue);
            return;
          }
        } catch {
          // Frame com leitura parcial
        }

        if (!cancelled) {
          timer = setTimeout(detectFrame, 200);
        }
      };

      timer = setTimeout(detectFrame, 300);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, stream]);

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch {
      // Falha ao alternar lanterna
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) { stopCamera(); onClose(); } }}
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[999] animate-fadeIn"
    >
      <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-4 border-b border-[#1D3054]">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-white">{title}</h2>
              <p className="text-[10px] text-slate-400">
                {targetField === 'mac' ? 'Aponte para o código do MAC Address' : 'Aponte para o código de barras ou QR Code'}
              </p>
            </div>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1A2C49]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visor da Câmera */}
        <div className="relative bg-black h-72 flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-xs text-rose-300 leading-relaxed">{cameraError}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Mira visual com animação de leitura */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-36 border-2 border-amber-400/80 rounded-xl relative shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-amber-400 -mt-1 -ml-1 rounded-tl"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-amber-400 -mt-1 -mr-1 rounded-tr"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-amber-400 -mb-1 -ml-1 rounded-bl"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-amber-400 -mb-1 -mr-1 rounded-br"></div>

                  {/* Linha vermelha de varredura */}
                  <div className="w-full h-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse absolute top-1/2 -translate-y-1/2"></div>
                </div>
              </div>

              {/* Controles de Câmera sobrepostos */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl backdrop-blur-md transition ${
                      torchOn ? 'bg-amber-400 text-slate-900 font-bold' : 'bg-black/60 text-white'
                    }`}
                    title="Alternar Lanterna"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={toggleCamera}
                  className="p-2 rounded-xl bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition"
                  title="Alternar Câmera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Rodapé com Entrada Manual / Teste */}
        <div className="p-4 bg-[#0C1525] border-t border-[#1D3054] space-y-3 text-xs">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={targetField === 'mac' ? 'Ou digite o código / MAC manualmente...' : 'Ou digite o código...'}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 bg-[#101C31] border border-[#24375A] rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400 text-xs"
            />
            <button
              onClick={() => handleDetected(manualInput)}
              disabled={!manualInput.trim()}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-900 font-bold text-xs transition"
            >
              Aplicar
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center">
            Suporta etiquetas 1D de código de barras (Code 128/39) e QR Code em etiquetas de ONTs, roteadores e leitores faciais.
          </p>
        </div>
      </div>
    </div>
  );
};

