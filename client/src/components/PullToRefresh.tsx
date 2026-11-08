import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowDown, RefreshCw, CheckCircle2 } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  pullThreshold?: number; // Distância mínima em px para acionar a atualização
  maxPull?: number;       // Distância máxima do indicador
}

type PullStatus = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'success';

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  pullThreshold = 70,
  maxPull = 120
}) => {
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [status, setStatus] = useState<PullStatus>('idle');
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef<number>(0);
  const isPullingRef = useRef<boolean>(false);
  const isRefreshingRef = useRef<boolean>(false);
  const hasVibratedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Verifica se o scroll da janela e do container estão no topo absoluto
  const isAtTop = useCallback(() => {
    const windowScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const containerScrollTop = containerRef.current ? containerRef.current.scrollTop : 0;
    return windowScrollTop <= 0 && containerScrollTop <= 0;
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshingRef.current) return;
    if (isAtTop()) {
      startYRef.current = e.touches[0].clientY;
      currentYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
      hasVibratedRef.current = false;
    } else {
      startYRef.current = null;
      isPullingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || startYRef.current === null || isRefreshingRef.current) return;

    currentYRef.current = e.touches[0].clientY;
    const rawDelta = currentYRef.current - startYRef.current;

    // Se o usuário estiver arrastando para baixo a partir do topo
    if (rawDelta > 0 && isAtTop()) {
      // Amortecimento físico com resistência elástica (rubber-band)
      const dampedDistance = Math.min(maxPull, Math.pow(rawDelta, 0.82));
      setPullDistance(dampedDistance);

      if (dampedDistance >= pullThreshold) {
        setStatus('ready');
        // Vibração háptica discreta ao atingir o limiar de liberação
        if (!hasVibratedRef.current && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(15);
          } catch {}
          hasVibratedRef.current = true;
        }
      } else {
        setStatus('pulling');
        hasVibratedRef.current = false;
      }
    } else {
      setPullDistance(0);
      setStatus('idle');
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current || isRefreshingRef.current) return;
    isPullingRef.current = false;
    startYRef.current = null;

    if (status === 'ready') {
      isRefreshingRef.current = true;
      setStatus('refreshing');
      setPullDistance(56); // Fixa na altura ideal de carregamento

      try {
        await Promise.resolve(onRefresh());
        setStatus('success');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([10, 30, 10]);
          } catch {}
        }
        // Exibe o status de sucesso brevemente antes de recolher
        setTimeout(() => {
          setPullDistance(0);
          setTimeout(() => {
            setStatus('idle');
            isRefreshingRef.current = false;
          }, 250);
        }, 500);
      } catch (err) {
        console.warn('Erro ao atualizar via pull-to-refresh:', err);
        setPullDistance(0);
        setStatus('idle');
        isRefreshingRef.current = false;
      }
    } else {
      setPullDistance(0);
      setStatus('idle');
    }
  };

  const isVisible = pullDistance > 0 || status === 'refreshing' || status === 'success';

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="relative w-full min-h-full"
    >
      {/* Indicador Flutuante Superior com Animação Glassmorphism */}
      <div
        className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200 ease-out ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90 -translate-y-6'
        }`}
        style={{
          transform: isVisible
            ? `translate(-50%, ${Math.min(pullDistance, 70)}px)`
            : 'translate(-50%, -100%)'
        }}
      >
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0F1B2D]/95 border border-blue-500/40 shadow-xl shadow-black/80 backdrop-blur-md text-xs font-semibold text-slate-100">
          {status === 'pulling' && (
            <>
              <ArrowDown
                className="w-4 h-4 text-blue-400 transition-transform duration-150"
                style={{
                  transform: `rotate(${Math.min(180, (pullDistance / pullThreshold) * 180)}deg)`
                }}
              />
              <span className="text-slate-300">Puxe para atualizar</span>
            </>
          )}

          {status === 'ready' && (
            <>
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="text-cyan-300 font-bold">Solte para atualizar</span>
            </>
          )}

          {status === 'refreshing' && (
            <>
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-blue-200">Atualizando dados...</span>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300 font-bold">Atualizado!</span>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo com Deslocamento Elástico Sutil */}
      <div
        style={{
          transform: pullDistance > 0 && status !== 'refreshing' && status !== 'success'
            ? `translateY(${pullDistance * 0.28}px)`
            : status === 'refreshing'
            ? 'translateY(24px)'
            : 'translateY(0px)',
          transition: isPullingRef.current ? 'none' : 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
        className="min-h-full"
      >
        {children}
      </div>
    </div>
  );
};
