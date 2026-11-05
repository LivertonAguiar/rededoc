import React from 'react';
import {
  LayoutDashboard,
  Network,
  Server,
  KeyRound,
  Menu
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenMobileMenu: () => void;
  hasSelectedClient: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenMobileMenu,
  hasSelectedClient
}) => {
  const navItems = [
    {
      id: 'overview',
      label: 'Início',
      icon: LayoutDashboard,
      requiresClient: false
    },
    {
      id: 'client-network',
      label: 'Rede',
      icon: Network,
      requiresClient: true
    },
    {
      id: 'equipments',
      label: 'Equip.',
      icon: Server,
      requiresClient: true
    },
    {
      id: 'credentials',
      label: 'Cofre',
      icon: KeyRound,
      requiresClient: true
    }
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070D1B]/95 backdrop-blur-lg border-t border-[#1D3054] px-2 py-1 safe-bottom shadow-2xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isDisabled = item.requiresClient && !hasSelectedClient;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (!isDisabled) {
                  onSelectTab(item.id);
                } else {
                  onSelectTab('overview');
                }
              }}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all relative ${
                isActive
                  ? 'text-blue-400 font-bold'
                  : isDisabled
                  ? 'text-slate-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm shadow-blue-400"></span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </button>
          );
        })}

        {/* Botão de Menu Completo / Mais */}
        <button
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-slate-400 hover:text-slate-200 transition-all"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-1 tracking-tight">Mais</span>
        </button>
      </div>
    </nav>
  );
};
