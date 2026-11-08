import React from 'react';

interface ItfyLogoProps {
  variant?: 'icon' | 'horizontal' | 'vertical';
  size?: number;
  className?: string;
  showSubtitle?: boolean;
}

export const ItfyLogo: React.FC<ItfyLogoProps> = ({
  variant = 'horizontal',
  size = 36,
  className = '',
  showSubtitle = true
}) => {
  const iconSize = variant === 'vertical' ? size * 1.5 : size;

  const IconSvg = (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-[0_4px_12px_rgba(6,182,212,0.35)] select-none"
    >
      <defs>
        <linearGradient id="itfyHexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0E1E38" />
          <stop offset="100%" stopColor="#08101E" />
        </linearGradient>
        <linearGradient id="itfyBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="itfyGlowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>

      {/* Escudo Hexagonal Tecnológico */}
      <polygon
        points="64,8 116,36 116,92 64,120 12,92 12,36"
        fill="url(#itfyHexGrad)"
        stroke="url(#itfyBorderGrad)"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* Grid e Linhas de Conexão de Rede Internas */}
      <line x1="64" y1="24" x2="64" y2="48" stroke="#1E3A8A" strokeWidth="2" strokeDasharray="3 3" />
      <line x1="32" y1="64" x2="52" y2="64" stroke="#1E3A8A" strokeWidth="2" strokeDasharray="3 3" />
      <line x1="76" y1="64" x2="96" y2="64" stroke="#1E3A8A" strokeWidth="2" strokeDasharray="3 3" />
      <line x1="64" y1="80" x2="64" y2="104" stroke="#1E3A8A" strokeWidth="2" strokeDasharray="3 3" />

      {/* Rack / Switch Central com Glifo ITFY */}
      {/* Topo do "T" e Rack Central */}
      <rect x="36" y="34" width="56" height="12" rx="4" fill="#172A4A" stroke="url(#itfyGlowGrad)" strokeWidth="2" />
      <circle cx="44" cy="40" r="2.5" fill="#10B981" className="animate-pulse" />
      <circle cx="52" cy="40" r="2.5" fill="#38BDF8" />
      <circle cx="84" cy="40" r="2.5" fill="#F59E0B" />

      {/* Coluna Central do "T" e "I" */}
      <rect x="58" y="46" width="12" height="36" rx="3" fill="#1E3558" stroke="url(#itfyGlowGrad)" strokeWidth="1.8" />

      {/* Base do Roteador / Switch Inferior com Portas */}
      <rect x="40" y="82" width="48" height="12" rx="4" fill="#172A4A" stroke="url(#itfyGlowGrad)" strokeWidth="2" />
      <circle cx="48" cy="88" r="2.5" fill="#10B981" />
      <circle cx="56" cy="88" r="2.5" fill="#10B981" />
      <circle cx="72" cy="88" r="2.5" fill="#38BDF8" />
      <circle cx="80" cy="88" r="2.5" fill="#38BDF8" />

      {/* Nós de Conexão Satélite com Fibra Óptica */}
      <path d="M 64 46 L 28 58" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 64 46 L 100 58" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 28 58 L 40 88" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 3" />
      <path d="M 100 58 L 88 88" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 3" />

      {/* Nós de borda luminosos */}
      <circle cx="28" cy="58" r="4.5" fill="#06B6D4" />
      <circle cx="28" cy="58" r="2" fill="#FFFFFF" />
      <circle cx="100" cy="58" r="4.5" fill="#3B82F6" />
      <circle cx="100" cy="58" r="2" fill="#FFFFFF" />
      <circle cx="64" cy="64" r="3.5" fill="#10B981" />
    </svg>
  );

  if (variant === 'icon') {
    return <div className={`inline-flex items-center justify-center ${className}`}>{IconSvg}</div>;
  }

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center gap-2 ${className}`}>
        {IconSvg}
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-1">
            <span>IT</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">FY</span>
          </h1>
          {showSubtitle && (
            <p className="text-[11px] font-medium text-slate-400 tracking-wide mt-0.5">
              Sistema de Documentação e Gestão de Redes
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {IconSvg}
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1 font-black text-white text-base tracking-tight">
          <span>IT</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">FY</span>
        </div>
        {showSubtitle && (
          <span className="text-[9px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">
            Network Doc
          </span>
        )}
      </div>
    </div>
  );
};

