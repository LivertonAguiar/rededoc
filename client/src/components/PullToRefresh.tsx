import React, { useState, useRef, useCallback } from 'react';
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
  const [status, setStatus] = useState<PullStatus>('idle');
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const isPullingRef = useRef<boolean>(false);
  const isRefreshingRef = useRef<boolean>(false);
  const hasVibratedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);

  // Verifica se o scroll da janela e do container estão no topo absoluto sem forçar reflow pesado
  const isAtTop = useCallback(() => {
    const windowScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const containerScrollTop = containerRef.current ? containerRef.current.scrollTop : 0;
    return windowScrollTop <= 2 && containerScrollTop <= 2;
  }, []);

  // Atualiza a posição do indicador diretamente no DOM para 60/120 FPS sem re-renderizar os filhos
  const updateIndicatorDOM = useCallback((distance: number, show: boolean) => {
    if (!indicatorRef.current) return;
    if (show) {
      indicatorRef.current.style.opacity = '1';
      indicatorRef.current.style.transform = `translate(-50%, ${Math.min(distance, 70)}px) scale(1)`;
    } else {
      indicatorRef.current.style.opacity = '0';
      indicatorRef.current.style.transform = 'translate(-50%, -100%) scale(0.9)';
    }

    if (arrowRef.current) {
      const angle = Math.min(180, (distance / pullThreshold) * 180);
      arrowRef.current.style.transform = `rotate(${angle}deg)`;
    }
  }, [pullThreshold]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshingRef.current) return;

    // Ignora se o toque começou em inputs, seletores ou elementos de modal
    const target = e.target as HTMLElement | null;
    if (target && target.closest('input, textarea, select, button, .modal-backdrop, [role="dialog"]')) {
      isPullingRef.current = false;
      startYRef.current = null;
      return;
    }

    if (isAtTop()) {
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isPullingRef.current = false; // Só ativa após confirmação de gesto vertical
      hasVibratedRef.current = false;
    } else {
      startYRef.current = null;
      startXRef.current = null;
      isPullingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null || startXRef.current === null || isRefreshingRef.current) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startYRef.current;
    const deltaX = currentX - startXRef.current;

    // Se o movimento for mais horizontal do que vertical, não intercepta (rolagem lateral natural)
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return;
    }

    // Limiar inicial para descartar micro-toques acidentais
    if (deltaY > 12 && isAtTop()) {
      isPullingRef.current = true;
      const dampedDistance = Math.min(maxPull, Math.pow(deltaY, 0.82));
      updateIndicatorDOM(dampedDistance, true);

      if (dampedDistance >= pullThreshold) {
        if (status !== 'ready') {
          setStatus('ready');
          if (!hasVibratedRef.current && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(15);
            } catch {}
            hasVibratedRef.current = true;
          }
        }
      } else {
        if (status !== 'pulling') {
          setStatus('pulling');
          hasVibratedRef.current = false;
        }
      }
    } else if (isPullingRef.current && deltaY <= 0) {
      isPullingRef.current = false;
      updateIndicatorDOM(0, false);
      if (status !== 'idle') setStatus('idle');
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current || isRefreshingRef.current) {
      startYRef.current = null;
      startXRef.current = null;
      isPullingRef.current = false;
      return;
    }

    isPullingRef.current = false;
    startYRef.current = null;
    startXRef.current = null;

    if (status === 'ready') {
      isRefreshingRef.current = true;
      setStatus('refreshing');
      updateIndicatorDOM(56, true);

      try {
        await Promise.resolve(onRefresh());
        setStatus('success');
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([10, 30, 10]);
          } catch {}
        }
        setTimeout(() => {
          updateIndicatorDOM(0, false);
          setTimeout(() => {
            setStatus('idle');
            isRefreshingRef.current = false;
          }, 200);
        }, 500);
      } catch (err) {
        console.warn('Erro ao atualizar via pull-to-refresh:', err);
        updateIndicatorDOM(0, false);
        setStatus('idle');
        isRefreshingRef.current = false;
      }
    } else {
      updateIndicatorDOM(0, false);
      setStatus('idle');
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="relative w-full min-h-full"
      style={{ touchAction: 'pan-y' }}
    >
      {/* Indicador Flutuante Superior de Alto Desempenho (controlado via Ref e Transform GPU) */}
      <div
        ref={indicatorRef}
        className="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-150 ease-out opacity-0 will-change-transform"
        style={{ transform: 'translate(-50%, -100%) scale(0.9)' }}
      >
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#0F1B2D]/95 border border-blue-500/40 shadow-xl shadow-black/80 backdrop-blur-md text-xs font-semibold text-slate-100">
          {status === 'pulling' && (
            <>
              <ArrowDown
                ref={arrowRef}
                className="w-4 h-4 text-blue-400 transition-transform duration-75 will-change-transform"
              />
              <span className="text-slate-300">Puxe para atualizar</span>
            </>
          )}

          {status === 'ready' && (
            <>
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
              <span className="text-emerald-300 font-bold">Solte para atualizar</span>
            </>
          )}

          {status === 'refreshing' && (
            <>
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-blue-300">Atualizando infraestrutura...</span>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-300 font-bold">Atualizado com sucesso!</span>
            </>
          )}
        </div>
      </div>

      {/* Conteúdo da Aplicação Protegido contra Re-renders durante o Toque */}
      {children}
    </div>
  );
};
