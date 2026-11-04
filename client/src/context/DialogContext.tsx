import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X, ShieldAlert } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

interface AlertOptions {
  title: string;
  message: string;
  type?: 'info' | 'error' | 'success' | 'warning';
  buttonText?: string;
}

interface DialogContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  confirm: (options: ConfirmOptions) => void;
  showAlert: (options: AlertOptions | string) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmOptions | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [alertModal, setAlertModal] = useState<AlertOptions | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const confirm = (options: ConfirmOptions) => {
    setConfirmModal(options);
  };

  const showAlert = (options: AlertOptions | string) => {
    if (typeof options === 'string') {
      setAlertModal({
        title: 'Aviso do Sistema',
        message: options,
        type: 'info'
      });
    } else {
      setAlertModal(options);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    setIsConfirming(true);
    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } catch (err: any) {
      showToast('Erro ao executar ação: ' + (err.message || 'Falha desconhecida'), 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelConfirm = () => {
    if (confirmModal?.onCancel) confirmModal.onCancel();
    setConfirmModal(null);
  };

  // Fecha modais de diálogo ao pressionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmModal) handleCancelConfirm();
        if (alertModal) setAlertModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmModal, alertModal]);

  return (
    <DialogContext.Provider value={{ showToast, confirm, showAlert }}>
      {children}

      {/* Container de Toasts Flutuantes */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map(toast => {
          let bg = 'bg-[#132238] border-blue-500/40 text-blue-200';
          let Icon = Info;
          if (toast.type === 'success') {
            bg = 'bg-[#0f291e] border-emerald-500/50 text-emerald-200';
            Icon = CheckCircle2;
          } else if (toast.type === 'error') {
            bg = 'bg-[#2d1217] border-rose-500/50 text-rose-200';
            Icon = AlertCircle;
          } else if (toast.type === 'warning') {
            bg = 'bg-[#2d220f] border-amber-500/50 text-amber-200';
            Icon = AlertTriangle;
          }

          return (
            <div
              key={toast.id}
              className={`p-3.5 rounded-xl border shadow-2xl flex items-start gap-3 pointer-events-auto transition-all animate-fadeIn ${bg}`}
            >
              <Icon className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs font-medium leading-relaxed">{toast.message}</div>
              <button
                type="button"
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-slate-400 hover:text-white p-0.5 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal Interno de Confirmação (Substitui confirm() nativo do navegador) */}
      {confirmModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelConfirm();
          }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[90] animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                confirmModal.danger
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {confirmModal.danger ? <ShieldAlert className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{confirmModal.title}</h3>
                <p className="text-xs text-slate-400">Confirmação de Ação</p>
              </div>
              <button
                type="button"
                onClick={handleCancelConfirm}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1A2C49] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#0C1525] border border-[#1E3150] rounded-xl text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {confirmModal.message}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isConfirming}
                onClick={handleCancelConfirm}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-[#16253E] hover:bg-[#1E3150] transition"
              >
                {confirmModal.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                disabled={isConfirming}
                onClick={handleConfirmAction}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition flex items-center gap-1.5 ${
                  confirmModal.danger
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                }`}
              >
                {isConfirming ? (
                  <span>Processando...</span>
                ) : (
                  <span>{confirmModal.confirmText || 'Confirmar'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Interno de Alerta (Substitui alert() nativo do navegador) */}
      {alertModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAlertModal(null);
          }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[90] animate-fadeIn"
        >
          <div className="bg-[#101C31] border border-[#24375A] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
                <Info className="w-5 h-5 text-blue-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{alertModal.title}</h3>
                <p className="text-xs text-slate-400">Mensagem do Sistema</p>
              </div>
              <button
                type="button"
                onClick={() => setAlertModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1A2C49] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#0C1525] border border-[#1E3150] rounded-xl text-xs text-slate-300 leading-relaxed whitespace-pre-line">
              {alertModal.message}
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setAlertModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20 transition"
              >
                {alertModal.buttonText || 'Entendido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog deve ser utilizado dentro de um DialogProvider');
  }
  return context;
};

