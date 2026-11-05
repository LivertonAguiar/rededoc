import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Verifica se já está instalado como PWA Standalone
    const isRunningStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(isRunningStandalone);

    if (isRunningStandalone) return;

    // Verifica se o usuário já fechou o prompt recentemente (últimas 24h)
    const dismissedTime = localStorage.getItem('itfy_pwa_dismissed');
    if (dismissedTime && Date.now() - parseInt(dismissedTime, 10) < 24 * 60 * 60 * 1000) {
      return;
    }

    // Detecta iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    // Captura evento de instalação do Chrome / Android
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Se for iOS e não for standalone, mostra dica após 3 segundos
    if (isAppleDevice && !isRunningStandalone) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('itfy_pwa_dismissed', Date.now().toString());
  };

  if (!showPrompt || isStandalone) {
    return null;
  }

  return (
    <div className="fixed bottom-16 lg:bottom-5 right-3 left-3 sm:left-auto sm:right-5 sm:max-w-sm z-50 animate-fadeIn">
      <div className="bg-[#0F1B2D]/95 border border-blue-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-md text-white flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center p-1.5 shadow-md shadow-blue-500/20 shrink-0">
              <img src="/logo.svg" alt="ITFY" className="w-full h-full" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Instalar App ITFY</span>
                <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.5 rounded font-mono">PWA</span>
              </div>
              <div className="text-[11px] text-slate-300">
                Acesso rápido na tela inicial do celular
              </div>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1A2C49] transition shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIOS ? (
          <div className="text-[11px] text-slate-300 bg-[#132238] p-2.5 rounded-xl border border-[#1D3054] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Instalar no iPhone / Safari:</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span>1. Toque no ícone de Compartilhar</span>
              <Share className="w-3.5 h-3.5 text-blue-400 inline" />
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span>2. Selecione</span>
              <span className="font-semibold text-white">"Adicionar à Tela de Início"</span>
              <PlusSquare className="w-3.5 h-3.5 text-blue-400 inline" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar Agora</span>
            </button>
            <button
              onClick={handleDismiss}
              className="py-2 px-3 rounded-xl bg-[#1A2C49] hover:bg-[#233B62] text-xs font-semibold text-slate-300 transition"
            >
              Agora não
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
