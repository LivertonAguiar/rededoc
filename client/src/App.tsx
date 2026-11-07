import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { GlobalOverviewView } from './components/GlobalOverviewView';
import { DashboardView } from './components/DashboardView';
import { PortForwardsView } from './components/PortForwardsView';
import { CredentialsVaultView } from './components/CredentialsVaultView';
import { EquipmentsView } from './components/EquipmentsView';
import { TopologyView } from './components/TopologyView';
import { ServiceOrdersView } from './components/ServiceOrdersView';
import { ClientsView } from './components/ClientsView';
import { AuditHistoryView } from './components/AuditHistoryView';
import { ReportsView } from './components/ReportsView';
import { BackupView } from './components/BackupView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { DomainsView } from './components/DomainsView';
import { LoginView } from './components/LoginView';
import { MobileBottomNav } from './components/MobileBottomNav';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { ClientProfileHeader } from './components/ClientProfileHeader';
import { Client, Equipment, PortForward, Attachment, User } from './types';
import { api } from './services/api';
import { DialogProvider } from './context/DialogContext';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(api.getCurrentUser());
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<string>(() => {
    const raw = window.location.hash.replace('#', '');
    const tab = raw.split('/')[0];
    return tab || localStorage.getItem('rededoc_activeTab') || 'overview';
  });
  const [targetEntityId, setTargetEntityId] = useState<string>(() => {
    const raw = window.location.hash.replace('#', '');
    return raw.split('/')[1] || '';
  });
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    return localStorage.getItem('rededoc_selectedClientId') || '';
  });
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [portForwards, setPortForwards] = useState<PortForward[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Validação da Sessão do Usuário
  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setCurrentUser(null);
      setAuthChecking(false);
      return;
    }

    api.getMe()
      .then(res => {
        setCurrentUser(res.user);
        localStorage.setItem('rededoc_user', JSON.stringify(res.user));
      })
      .catch(() => {
        api.logout();
        setCurrentUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    loadClients();
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
  };

  // Navegação contextual com histórico interno e navegador (#aba/id)
  const navigateToTab = (newTab: string, entityId?: string, pushHistory = true) => {
    const targetTab = newTab === 'ports' ? 'port-forwards' : newTab === 'services' ? 'service-orders' : newTab;
    const fullHash = entityId ? `${targetTab}/${entityId}` : targetTab;
    if (pushHistory) {
      setHistoryStack(prev => [...prev, activeTab]);
      window.history.pushState({ tab: targetTab, entityId }, '', '#' + fullHash);
    }
    setActiveTab(targetTab);
    setTargetEntityId(entityId || '');
    localStorage.setItem('rededoc_activeTab', targetTab);
    setIsMobileMenuOpen(false);
  };

  const handleGoBack = () => {
    if (historyStack.length > 0) {
      const prev = historyStack[historyStack.length - 1];
      setHistoryStack(prevStack => prevStack.slice(0, -1));
      setActiveTab(prev);
      setTargetEntityId('');
      localStorage.setItem('rededoc_activeTab', prev);
      window.history.replaceState({ tab: prev }, '', '#' + prev);
    } else if (activeTab !== 'overview') {
      setActiveTab('overview');
      setTargetEntityId('');
      localStorage.setItem('rededoc_activeTab', 'overview');
      window.history.replaceState({ tab: 'overview' }, '', '#overview');
    } else {
      window.history.back();
    }
  };

  useEffect(() => {
    // Sincroniza com o botão Voltar do navegador e mudanças de hash
    const handlePopState = (e?: PopStateEvent) => {
      const raw = (e?.state && e.state.tab) || window.location.hash.replace('#', '') || localStorage.getItem('rededoc_activeTab') || 'overview';
      const [nextTab, nextId] = raw.split('/');
      const cleanTab = nextTab === 'ports' ? 'port-forwards' : nextTab === 'services' ? 'service-orders' : nextTab;
      setActiveTab(cleanTab || 'overview');
      setTargetEntityId(nextId || (e?.state && e.state.entityId) || '');
      localStorage.setItem('rededoc_activeTab', cleanTab || 'overview');
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', () => handlePopState());
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', () => handlePopState());
    };
  }, []);

  // Carrega clientes iniciais
  const loadClients = async () => {
    try {
      const data = await api.getClients();
      setClients(data);
      if (data.length > 0) {
        const savedClientId = localStorage.getItem('rededoc_selectedClientId');
        const targetClient = data.find(c => c.id === savedClientId) ||
          data.find(c => c.name.toLowerCase().includes('aurora')) ||
          data[0];

        if (targetClient) {
          setSelectedClientId(targetClient.id);
          localStorage.setItem('rededoc_selectedClientId', targetClient.id);
          if (targetClient.locations && targetClient.locations.length > 0) {
            setSelectedLocationId(targetClient.locations[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  };

  // Carrega dados da infraestrutura do cliente selecionado
  const loadClientData = async () => {
    if (!selectedClientId) return;
    setLoading(true);
    try {
      const [eqs, ports, atts] = await Promise.all([
        api.getEquipments(selectedClientId),
        api.getPortForwards(selectedClientId),
        api.getAttachments(selectedClientId)
      ]);
      setEquipments(eqs);
      setPortForwards(ports);
      setAttachments(atts);
    } catch (err) {
      console.error('Erro ao carregar dados do cliente:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    loadClientData();
  }, [selectedClientId]);

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];
  const selectedLocation = selectedClient?.locations?.find(l => l.id === selectedLocationId) || selectedClient?.locations?.[0];

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    localStorage.setItem('rededoc_selectedClientId', clientId);
    const cli = clients.find(c => c.id === clientId);
    if (cli?.locations && cli.locations.length > 0) {
      setSelectedLocationId(cli.locations[0].id);
    } else {
      setSelectedLocationId('');
    }
  };

  const handleNavigateToItem = (type: string, id: string) => {
    if (type === 'equipment') {
      navigateToTab('equipments');
    } else if (type === 'port') {
      navigateToTab('port-forwards');
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#070D1B] flex items-center justify-center text-slate-400 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Verificando sessão segura...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <LoginView onLoginSuccess={handleLoginSuccess} />
        <PwaInstallPrompt />
      </>
    );
  }

  return (
    <DialogProvider>
      <div className="flex min-h-screen bg-[#0B132B] text-slate-100">
        {/* Barra de Navegação Lateral (Desktop fixa + Mobile gaveta) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => navigateToTab(tab)}
          selectedClientName={selectedClient?.name}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Conteúdo Principal */}
        <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
          <Header
            activeTab={activeTab}
            onOpenOverview={() => navigateToTab('overview')}
            onGoBack={handleGoBack}
            canGoBack={historyStack.length > 0 || activeTab !== 'overview'}
            onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
            clients={clients}
            selectedClientId={selectedClientId}
            onSelectClient={(cId) => {
              handleSelectClient(cId);
              navigateToTab('client-network');
            }}
            selectedLocationId={selectedLocationId}
            onSelectLocation={setSelectedLocationId}
            onOpenEquipments={() => navigateToTab('equipments')}
            onOpenPortForwards={() => navigateToTab('port-forwards')}
            onOpenReport={() => navigateToTab('reports')}
            onNavigateToItem={handleNavigateToItem}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {activeTab === 'overview' ? (
              <GlobalOverviewView
                onSelectClientAndOpenNetwork={(clientId) => {
                  handleSelectClient(clientId);
                  navigateToTab('client-network');
                }}
                onOpenClients={() => navigateToTab('clients')}
                onOpenServiceOrders={() => navigateToTab('service-orders')}
                onOpenEquipments={() => navigateToTab('equipments')}
              />
            ) : activeTab === 'procedures' ? (
              <KnowledgeBaseView
                client={selectedClient}
                clients={clients}
                targetArticleId={targetEntityId}
                onNavigateToTab={navigateToTab}
              />
            ) : activeTab === 'domains' ? (
              <DomainsView
                client={selectedClient}
                clients={clients}
                targetDomainId={targetEntityId}
                onNavigateToTab={navigateToTab}
              />
            ) : activeTab === 'clients' ? (
              <ClientsView
                clients={clients}
                onRefresh={loadClients}
                onSelectClient={(cId) => {
                  handleSelectClient(cId);
                  navigateToTab('client-network');
                }}
              />
            ) : activeTab === 'backup' ? (
              <BackupView
                onRefresh={() => {
                  loadClients();
                  loadClientData();
                }}
              />
            ) : loading && !selectedClient ? (
              <div className="text-center py-20 text-slate-400 text-sm">
                Carregando infraestrutura de rede...
              </div>
            ) : selectedClient ? (
              <>
                {[
                  'client-network',
                  'dashboard',
                  'equipments',
                  'topology',
                  'port-forwards',
                  'credentials',
                  'domains',
                  'service-orders',
                  'audit-history',
                  'reports'
                ].includes(activeTab) && (
                  <ClientProfileHeader
                    client={selectedClient}
                    activeTab={activeTab === 'dashboard' ? 'client-network' : activeTab}
                    onSelectTab={(tab) => navigateToTab(tab)}
                    equipments={equipments}
                    portForwards={portForwards}
                    onOpenReport={() => navigateToTab('reports')}
                  />
                )}

                {(activeTab === 'client-network' || activeTab === 'dashboard') && (
                  <DashboardView
                    client={selectedClient}
                    location={selectedLocation}
                    equipments={equipments}
                    portForwards={portForwards}
                    attachments={attachments}
                    onRefresh={loadClientData}
                    onOpenReport={() => navigateToTab('reports')}
                    onOpenVault={() => navigateToTab('credentials')}
                    onSelectEquipment={() => navigateToTab('equipments')}
                    onOpenTopology={() => navigateToTab('topology')}
                  />
                )}
                {activeTab === 'clients' && (
                  <ClientsView
                    clients={clients}
                    onRefresh={loadClients}
                    onSelectClient={(cId) => {
                      handleSelectClient(cId);
                      navigateToTab('client-network');
                    }}
                  />
                )}
                {activeTab === 'equipments' && (
                  <EquipmentsView
                    client={selectedClient}
                    equipments={equipments}
                    onRefresh={loadClientData}
                    onOpenVault={() => navigateToTab('credentials')}
                    targetEquipmentId={targetEntityId}
                    onNavigateToTab={navigateToTab}
                  />
                )}
                {activeTab === 'topology' && (
                  <TopologyView
                    client={selectedClient}
                    equipments={equipments}
                    portForwards={portForwards}
                    onRefresh={loadClientData}
                  />
                )}
                {activeTab === 'port-forwards' && (
                  <PortForwardsView
                    client={selectedClient}
                    equipments={equipments}
                    portForwards={portForwards}
                    onRefresh={loadClientData}
                    targetPortForwardId={targetEntityId}
                    onNavigateToTab={navigateToTab}
                  />
                )}
                {activeTab === 'credentials' && (
                  <CredentialsVaultView
                    client={selectedClient}
                    equipments={equipments}
                    onRefresh={loadClientData}
                    targetCredentialId={targetEntityId}
                    onNavigateToTab={navigateToTab}
                  />
                )}
                {activeTab === 'service-orders' && (
                  <ServiceOrdersView
                    client={selectedClient}
                    equipments={equipments}
                    onRefresh={loadClientData}
                    targetOrderId={targetEntityId}
                    onNavigateToTab={navigateToTab}
                  />
                )}
                {activeTab === 'audit-history' && (
                  <AuditHistoryView client={selectedClient} />
                )}
                {activeTab === 'reports' && (
                  <ReportsView client={selectedClient} onBack={handleGoBack} />
                )}
                {activeTab === 'backup' && (
                  <BackupView
                    onRefresh={() => {
                      loadClients();
                      loadClientData();
                    }}
                  />
                )}
              </>
            ) : (
              <div className="text-center py-20 text-slate-400">
                Nenhum cliente cadastrado. Cadastre um cliente para começar.
              </div>
            )}
          </main>
        </div>

        {/* Barra de Navegação Inferior para Celular */}
        <MobileBottomNav
          activeTab={activeTab}
          onSelectTab={(tab) => navigateToTab(tab)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          hasSelectedClient={Boolean(selectedClient)}
        />

        {/* Prompt PWA para Instalação no Celular */}
        <PwaInstallPrompt />
      </div>
    </DialogProvider>
  );
}

export default App;
