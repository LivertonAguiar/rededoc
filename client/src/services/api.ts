import {
  Client, Location, Equipment, PortForward, Credential,
  CredentialAuditLog, ServiceOrder, TopologyData, Attachment,
  AuditHistory, DashboardStats, TechnicalReportData, EquipmentCatalogItem
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Erro de comunicação com o servidor' }));
    throw new Error(errorData.error || `Erro HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Dashboard & Busca Rápida
  getDashboardStats: (clientId?: string) =>
    fetchJson<DashboardStats>(`/dashboard/stats${clientId ? `?clientId=${clientId}` : ''}`),

  quickSearch: (q: string) =>
    fetchJson<{ clients: Client[]; equipments: Equipment[]; ports: PortForward[]; service_orders: ServiceOrder[] }>(`/dashboard/quick-search?q=${encodeURIComponent(q)}`),

  // Clientes
  getClients: () => fetchJson<Client[]>('/clients'),
  getClient: (id: string) => fetchJson<Client>(`/clients/${id}`),
  createClient: (data: Partial<Client>) => fetchJson<Client>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: string, data: Partial<Client>) => fetchJson<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id: string) => fetchJson<{ message: string }>(`/clients/${id}`, { method: 'DELETE' }),

  // Locais
  getLocations: (clientId?: string) => fetchJson<Location[]>(`/locations${clientId ? `?clientId=${clientId}` : ''}`),
  createLocation: (data: Partial<Location>) => fetchJson<Location>('/locations', { method: 'POST', body: JSON.stringify(data) }),
  updateLocation: (id: string, data: Partial<Location>) => fetchJson<Location>(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLocation: (id: string) => fetchJson<{ message: string }>(`/locations/${id}`, { method: 'DELETE' }),

  // Equipamentos
  getEquipments: (clientId?: string, locationId?: string, category?: string, q?: string) => {
    const params = new URLSearchParams();
    if (clientId) params.append('clientId', clientId);
    if (locationId) params.append('locationId', locationId);
    if (category) params.append('category', category);
    if (q) params.append('q', q);
    return fetchJson<Equipment[]>(`/equipments?${params.toString()}`);
  },
  getEquipment: (id: string) => fetchJson<Equipment>(`/equipments/${id}`),
  createEquipment: (data: Partial<Equipment>) => fetchJson<Equipment>('/equipments', { method: 'POST', body: JSON.stringify(data) }),
  updateEquipment: (id: string, data: Partial<Equipment>) => fetchJson<Equipment>(`/equipments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEquipment: (id: string) => fetchJson<{ message: string }>(`/equipments/${id}`, { method: 'DELETE' }),

  // Redirecionamento de Portas (NAT)
  getPortForwards: (clientId?: string, locationId?: string, equipmentId?: string) => {
    const params = new URLSearchParams();
    if (clientId) params.append('clientId', clientId);
    if (locationId) params.append('locationId', locationId);
    if (equipmentId) params.append('equipmentId', equipmentId);
    return fetchJson<PortForward[]>(`/port-forwards?${params.toString()}`);
  },
  createPortForward: (data: Partial<PortForward>) =>
    fetchJson<PortForward>('/port-forwards', { method: 'POST', body: JSON.stringify(data) }),
  updatePortForward: (id: string, data: Partial<PortForward>) =>
    fetchJson<PortForward>(`/port-forwards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updatePortStatus: (id: string, status: 'funcionando' | 'nao_testada' | 'com_falha') =>
    fetchJson<PortForward>(`/port-forwards/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deletePortForward: (id: string) =>
    fetchJson<{ message: string }>(`/port-forwards/${id}`, { method: 'DELETE' }),

  // Cofre de Credenciais (AES-256-GCM)
  getCredentials: (clientId?: string, equipmentId?: string) => {
    const params = new URLSearchParams();
    if (clientId) params.append('clientId', clientId);
    if (equipmentId) params.append('equipmentId', equipmentId);
    return fetchJson<Credential[]>(`/credentials?${params.toString()}`);
  },
  createCredential: (data: any) =>
    fetchJson<Credential>('/credentials', { method: 'POST', body: JSON.stringify(data) }),
  updateCredential: (id: string, data: any) =>
    fetchJson<Credential>(`/credentials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  revealCredential: (id: string) =>
    fetchJson<{ id: string; name: string; username: string; password: string; revealed_at: string }>(`/credentials/${id}/reveal`, { method: 'POST' }),
  getCredentialAudit: (id: string) =>
    fetchJson<CredentialAuditLog[]>(`/credentials/${id}/audit`),
  deleteCredential: (id: string) =>
    fetchJson<{ message: string }>(`/credentials/${id}`, { method: 'DELETE' }),

  // Atendimentos Técnicos
  getServiceOrders: (clientId?: string, locationId?: string, status?: string) => {
    const params = new URLSearchParams();
    if (clientId) params.append('clientId', clientId);
    if (locationId) params.append('locationId', locationId);
    if (status) params.append('status', status);
    return fetchJson<ServiceOrder[]>(`/service-orders?${params.toString()}`);
  },
  getServiceOrder: (id: string) => fetchJson<ServiceOrder>(`/service-orders/${id}`),
  createServiceOrder: (data: Partial<ServiceOrder>) =>
    fetchJson<ServiceOrder>('/service-orders', { method: 'POST', body: JSON.stringify(data) }),
  updateServiceOrder: (id: string, data: Partial<ServiceOrder>) =>
    fetchJson<ServiceOrder>(`/service-orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteServiceOrder: (id: string) =>
    fetchJson<{ message: string }>(`/service-orders/${id}`, { method: 'DELETE' }),

  // Topologia
  getTopology: (clientId: string, locationId?: string) =>
    fetchJson<TopologyData>(`/topology?clientId=${clientId}${locationId ? `&locationId=${locationId}` : ''}`),
  saveTopology: (data: Partial<TopologyData>) =>
    fetchJson<{ message: string }>('/topology', { method: 'POST', body: JSON.stringify(data) }),

  // Histórico de Alterações / Auditoria
  getAuditHistory: (clientId?: string, equipmentId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (clientId) params.append('clientId', clientId);
    if (equipmentId) params.append('equipmentId', equipmentId);
    if (limit) params.append('limit', String(limit));
    return fetchJson<AuditHistory[]>(`/audit-history?${params.toString()}`);
  },

  // Anexos
  getAttachments: (
    clientIdOrFilter?: string | { clientId?: string; locationId?: string; equipmentId?: string; serviceOrderId?: string },
    locationId?: string,
    equipmentId?: string,
    serviceOrderId?: string
  ) => {
    const params = new URLSearchParams();
    if (typeof clientIdOrFilter === 'object' && clientIdOrFilter !== null) {
      if (clientIdOrFilter.clientId) params.append('clientId', clientIdOrFilter.clientId);
      if (clientIdOrFilter.locationId) params.append('locationId', clientIdOrFilter.locationId);
      if (clientIdOrFilter.equipmentId) params.append('equipmentId', clientIdOrFilter.equipmentId);
      if (clientIdOrFilter.serviceOrderId) params.append('serviceOrderId', clientIdOrFilter.serviceOrderId);
    } else {
      if (clientIdOrFilter) params.append('clientId', clientIdOrFilter);
      if (locationId) params.append('locationId', locationId);
      if (equipmentId) params.append('equipmentId', equipmentId);
      if (serviceOrderId) params.append('serviceOrderId', serviceOrderId);
    }
    const q = params.toString();
    return fetchJson<Attachment[]>(`/attachments${q ? `?${q}` : ''}`);
  },
  deleteAttachment: (id: string) => fetchJson<{ message: string }>(`/attachments/${id}`, { method: 'DELETE' }),

  // Relatório Técnico
  getTechnicalReport: (clientId: string, locationId?: string, includePasswords?: boolean) => {
    const params = new URLSearchParams();
    if (locationId) params.append('locationId', locationId);
    if (includePasswords) params.append('includePasswords', 'true');
    return fetchJson<TechnicalReportData>(`/reports/client/${clientId}?${params.toString()}`);
  },

  // Backup & Restore
  exportBackupUrl: () => `${API_BASE}/backup/export`,
  importBackup: (backupJson: any) =>
    fetchJson<{ message: string }>('/backup/import', { method: 'POST', body: JSON.stringify(backupJson) }),

  // Catálogo de Equipamentos
  getEquipmentCatalog: (category?: string, query?: string) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (query) params.append('q', query);
    return fetchJson<EquipmentCatalogItem[]>(`/equipment-catalog?${params.toString()}`);
  },
  getEquipmentCatalogItem: (id: string) => fetchJson<EquipmentCatalogItem>(`/equipment-catalog/${id}`),
  createEquipmentCatalogItem: (data: Partial<EquipmentCatalogItem>) =>
    fetchJson<EquipmentCatalogItem>('/equipment-catalog', { method: 'POST', body: JSON.stringify(data) }),
  updateEquipmentCatalogItem: (id: string, data: Partial<EquipmentCatalogItem>) =>
    fetchJson<EquipmentCatalogItem>(`/equipment-catalog/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEquipmentCatalogItem: (id: string) =>
    fetchJson<{ message: string }>(`/equipment-catalog/${id}`, { method: 'DELETE' }),

  // Imagens & Busca Inteligente na Web
  searchImages: (query: string) =>
    fetchJson<{ query: string; count: number; results: Array<{ title: string; url: string; thumbnail: string; source: string }> }>(
      `/images/search?q=${encodeURIComponent(query)}`
    ),
  fetchAndSaveImage: (data: { imageUrl: string; fallbackUrl?: string; equipmentId?: string; serviceOrderId?: string; clientId?: string }) =>
    fetchJson<{ success: boolean; localUrl: string; message: string }>('/images/fetch-and-save', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  uploadImageFile: async (file: File, extraData?: { equipmentId?: string; serviceOrderId?: string; clientId?: string }) => {
    const formData = new FormData();
    formData.append('photo', file);
    if (extraData?.equipmentId) formData.append('equipmentId', extraData.equipmentId);
    if (extraData?.serviceOrderId) formData.append('serviceOrderId', extraData.serviceOrderId);
    if (extraData?.clientId) formData.append('clientId', extraData.clientId);

    const res = await fetch(`${API_BASE}/images/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro no envio da foto' }));
      throw new Error(err.error || 'Erro no envio da foto');
    }
    return res.json() as Promise<{ success: boolean; localUrl: string }>;
  },
  removeImageBackground: (imageUrl: string, equipmentId?: string) =>
    fetchJson<{ success: boolean; localUrl: string; message: string }>('/images/remove-background', {
      method: 'POST',
      body: JSON.stringify({ imageUrl, equipmentId })
    })
};
