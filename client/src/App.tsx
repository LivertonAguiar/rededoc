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
import { Client, Equipment, PortForward, Attachment } from './types';
import { api } from './services/api';
import { DialogProvider } from './context/DialogContext';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [portForwards, setPortForwards] = useState<PortForward[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Navegação contextual com histórico interno e navegador (popstate)
  const navigateToTab = (newTab: string, pushHistory = true) => {
    if (newTab === activeTab) return;
    if (pushHistory) {
      setHistoryStack(prev => [...prev, activeTab]);
      window.history.pushState({ tab: newTab }, '', '#' + newTab);
    }
    setActiveTab(newTab);
    setIsMobileMenuOpen(false);
  };

  const handleGoBack = () => {
    if (historyStack.length > 0) {
      const prev = historyStack[historyStack.length - 1];
      setHistoryStack(prevStack => prevStack.slice(0, -1));
      setActiveTab(prev);
      window.history.replaceState({ tab: prev }, '', '#' + prev);
    } else if (activeTab !== 'overview') {
      setActiveTab('overview');
      window.history.replaceState({ tab: 'overview' }, '', '#overview');
    } else {
      window.history.back();
    }
  };

  useEffect(() => {
    // Sincroniza com o botão Voltar nativo do navegador
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.tab) {
        setActiveTab(e.state.tab);
      } else {
        const hash = window.location.hash.replace('#', '');
        setActiveTab(hash || 'overview');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Carrega clientes iniciais
  const loadClients = async () => {
    try {
      const data = await api.getClients();
      setClients(data);
      if (data.length > 0 && !selectedClientId) {
        // Seleciona Condomínio Aurora se existir ou o primeiro
        const aurora = data.find(c => c.name.toLowerCase().includes('aurora')) || data[0];
        setSelectedClientId(aurora.id);
        if (aurora.locations && aurora.locations.length > 0) {
          setSelectedLocationId(aurora.locations[0].id);
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
        />

        {/* Conteúdo Principal */}
        <div className="flex-1 flex flex-col min-w-0">
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
            ) : loading && !selectedClient ? (
              <div className="text-center py-20 text-slate-400 text-sm">
                Carregando infraestrutura de rede...
              </div>
            ) : selectedClient ? (
              <>
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
                  />
                )}
                {activeTab === 'credentials' && (
                  <CredentialsVaultView
                    client={selectedClient}
                    equipments={equipments}
                    onRefresh={loadClientData}
                  />
                )}
                {activeTab === 'service-orders' && (
                  <ServiceOrdersView
                    client={selectedClient}
                    equipments={equipments}
                    onRefresh={loadClientData}
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
      </div>
    </DialogProvider>
  );
}

export default App;
