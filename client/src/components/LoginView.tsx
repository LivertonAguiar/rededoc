import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
  Server
} from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';
import { ItfyLogo } from './ItfyLogo';

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.login({ email: email.trim(), password });
      localStorage.setItem('rededoc_token', res.token);
      localStorage.setItem('rededoc_user', JSON.stringify(res.user));
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setErrorMessage(err.message || 'Credenciais inválidas. Verifique os dados digitados.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('tecnico@rededoc.com');
    setPassword('admin123');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#070D1B] flex flex-col justify-center items-center p-4 relative overflow-hidden text-slate-100">
      {/* Luzes de fundo decorativas */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Cabeçalho da Aplicação com Logotipo Oficial ITFY */}
        <div className="text-center space-y-2">
          <ItfyLogo variant="vertical" size={54} />
        </div>

        {/* Card de Login */}
        <div className="bg-[#0F1B2D]/95 border border-[#1D3054] rounded-2xl p-7 shadow-2xl backdrop-blur-md space-y-5">
          <div className="border-b border-[#1D3054] pb-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-400" />
              <span>Acesso ao Sistema</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Informe suas credenciais de técnico ou administrador
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">E-mail Profissional</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ex: tecnico@rededoc.com"
                  className="w-full bg-[#132238] border border-[#24375A] rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs transition"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">Senha de Acesso</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#132238] border border-[#24375A] rounded-xl pl-9 pr-10 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs transition font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no ITFY</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Dica de preenchimento rápido para o usuário */}
          <div className="pt-2 border-t border-[#1D3054]">
            <button
              type="button"
              onClick={handleFillDemo}
              className="w-full p-2.5 rounded-xl bg-[#132238]/70 hover:bg-[#182B47] border border-[#1D3054] text-[11px] text-slate-300 flex items-center justify-between transition-all group"
            >
              <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Credenciais Padrão</span>
              </span>
              <span className="font-mono text-slate-400 group-hover:text-blue-300 text-[10px]">
                tecnico@rededoc.com / admin123
              </span>
            </button>
          </div>
        </div>

        {/* Rodapé Seguro */}
        <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Sessão assinada por JWT com Cofre de Senhas AES-256-GCM</span>
        </div>
      </div>
    </div>
  );
};
