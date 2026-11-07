import {
  User, Client, Location, Equipment, PortForward, Credential,
  CredentialAuditLog, ServiceOrder, TopologyData, Attachment,
  AuditHistory, DashboardStats, TechnicalReportData, EquipmentCatalogItem,
  RelatedItem, EntityLink, AvailableLinkTarget, Article, ArticleVersion,
  ExpirationItem, NotificationSetting, NotificationLog, Domain,
  FavoriteItem, GroupedSearchResults, DashboardOverviewData,
  Subnet, SubnetUsageReport, SubnetSuggestion, ClientIpConflictsReport,
  SystemUser, PortalOverview, PortalEquipment, PortalServiceOrder, PortalArticle
} from '../types';

const API_BASE = '/api';

// Cache em memória para navegação rápida e sem telas de carregamento repetitivas
const apiCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60000; // 1 minuto de retenção para leituras

export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    apiCache.clear();
  } else {
    for (const key of apiCache.keys()) {
      if (key.includes(prefix)) {
        apiCache.delete(key);
      }
    }
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  const token = localStorage.getItem('rededoc_token');
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  // Em operações de escrita/mutação, invalida o cache automaticamente
  if (method !== 'GET') {
    invalidateApiCache();
  } else {
    const cached = apiCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
  }

  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options?.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Se não for rota de login e a sessão expirar, limpa token
      if (!url.includes('/auth/login')) {
        localStorage.removeItem('rededoc_token');
        localStorage.removeItem('rededoc_user');
      }
    }
    const errorData = await res.json().catch(() => ({ error: 'Erro de comunicação com o servidor' }));
    throw new Error(errorData.error || `Erro HTTP ${res.status}`);
  }

  const data = await res.json();
  if (method === 'GET') {
    apiCache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return data;
}

export const api = {
  // Limpeza explícita de cache
  clearCache: () => invalidateApiCache(),
  // Autenticação & Sessão
  login: (credentials: { email: string; password: string }) =>
    fetchJson<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),

  getMe: () => fetchJson<{ user: User }>('/auth/me'),

  logout: () => {
    localStorage.removeItem('rededoc_token');
    localStorage.removeItem('rededoc_user');
  },

  getToken: () => localStorage.getItem('rededoc_token'),

  getCurrentUser: (): User | null => {
    const raw = localStorage.getItem('rededoc_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  // Dashboard & Busca Rápida
  getDashboardStats: (clientId?: string) =>
    fetchJson<DashboardStats>(`/dashboard/stats${clientId ? `?clientId=${clientId}` : ''}`),

  checkWanStatus: (clientId?: string) =>
    fetchJson<{
      currentPublicIp: string | null;
      registeredIp: string | null;
      hasChanged: boolean;
      status: 'ok' | 'mismatch' | 'unregistered' | 'offline';
      message: string;
    }>(`/dashboard/wan-check${clientId ? `?clientId=${clientId}` : ''}`),

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
  pingEquipment: (id: string) =>
    fetchJson<{
      equipment_id: string;
      equipment_name: string;
      ip: string;
      online: boolean;
      latencyMs: number | null;
      method: string;
      lastChecked: string;
    }>(`/equipments/${id}/ping`, { method: 'POST' }),
  pingAllEquipments: (clientId?: string) =>
    fetchJson<Array<{
      equipment_id: string;
      equipment_name: string;
      ip: string;
      online: boolean;
      latencyMs: number | null;
      method: string;
      lastChecked: string;
    }>>('/equipments/ping-all', { method: 'POST', body: JSON.stringify({ clientId }) }),

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
  testPortForward: (id: string) =>
    fetchJson<{ open: boolean; latency_ms: number; message: string; error_code?: string; status: string; rule: PortForward }>(`/port-forwards/${id}/test`, { method: 'POST' }),
  testAllPorts: (clientId?: string) =>
    fetchJson<{ tested: number; results: Array<{ id: string; service_name: string; external_port: number; open: boolean; latency_ms: number; status: string; message: string }> }>('/port-forwards/test-all', { method: 'POST', body: JSON.stringify({ clientId }) }),
  testDirectPort: (host: string, port: number) =>
    fetchJson<{ open: boolean; latency_ms: number; message: string; error_code?: string }>('/port-forwards/test-direct', { method: 'POST', body: JSON.stringify({ host, port }) }),
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
  resetTopology: (clientId: string, locationId?: string) =>
    fetchJson<{ message: string }>(`/topology/reset?clientId=${clientId}${locationId ? `&locationId=${locationId}` : ''}`, { method: 'DELETE' }),

  // Vínculos entre Registros (Itens Relacionados)
  getRelatedItems: (type: string, id: string) =>
    fetchJson<RelatedItem[]>(`/links?type=${type}&id=${id}`),
  createLink: (data: { client_id: string; source_type: string; source_id: string; target_type: string; target_id: string; label?: string }) =>
    fetchJson<EntityLink>('/links', { method: 'POST', body: JSON.stringify(data) }),
  deleteLink: (id: string) =>
    fetchJson<{ message: string }>(`/links/${id}`, { method: 'DELETE' }),
  getAvailableLinkTargets: (clientId: string, excludeType: string, excludeId: string) =>
    fetchJson<AvailableLinkTarget[]>(`/links/available?clientId=${clientId}&excludeType=${excludeType}&excludeId=${excludeId}`),

  // Base de Conhecimento (Procedimentos)
  getArticles: (clientId?: string, tag?: string, q?: string) => {
    const params = new URLSearchParams();
    if (clientId) params.append('clientId', clientId);
    if (tag) params.append('tag', tag);
    if (q) params.append('q', q);
    const qs = params.toString();
    return fetchJson<Article[]>(`/articles${qs ? `?${qs}` : ''}`);
  },
  getArticle: (id: string) => fetchJson<Article>(`/articles/${id}`),
  createArticle: (data: Partial<Article>) =>
    fetchJson<Article>('/articles', { method: 'POST', body: JSON.stringify(data) }),
  updateArticle: (id: string, data: Partial<Article>) =>
    fetchJson<Article>(`/articles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteArticle: (id: string) =>
    fetchJson<{ message: string }>(`/articles/${id}`, { method: 'DELETE' }),
  getArticleVersions: (id: string) =>
    fetchJson<ArticleVersion[]>(`/articles/${id}/versions`),
  restoreArticleVersion: (id: string, version: number) =>
    fetchJson<Article>(`/articles/${id}/restore/${version}`, { method: 'POST' }),

  // Vencimentos e Alertas (Fase 3)
  getExpirations: (clientId?: string, withinDays?: number) => {
    const params = new URLSearchParams();
    if (clientId) params.append('clientId', clientId);
    if (withinDays !== undefined) params.append('withinDays', String(withinDays));
    const qs = params.toString();
    return fetchJson<ExpirationItem[]>(`/expirations${qs ? `?${qs}` : ''}`);
  },
  getNotificationSettings: () => fetchJson<NotificationSetting[]>('/notifications/settings'),
  saveNotificationSetting: (data: Partial<NotificationSetting>) =>
    fetchJson<NotificationSetting>('/notifications/settings', { method: 'POST', body: JSON.stringify(data) }),
  testNotificationWebhook: (target_url: string) =>
    fetchJson<{ success: boolean; message: string; statusCode?: number }>('/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ target_url })
    }),
  dispatchNotificationsNow: () =>
    fetchJson<{ totalDispatched: number; skippedDuplicates: number; errors: number }>('/notifications/dispatch-now', {
      method: 'POST'
    }),
  getNotificationLogs: () => fetchJson<NotificationLog[]>('/notifications/logs'),

  // Domínios, SSL e DNS (Fase 7)
  getDomains: (clientId?: string) => {
    const qs = clientId ? `?clientId=${clientId}` : '';
    return fetchJson<Domain[]>(`/domains${qs}`);
  },
  getDomain: (id: string) => fetchJson<Domain>(`/domains/${id}`),
  createDomain: (data: Partial<Domain>) =>
    fetchJson<Domain>('/domains', { method: 'POST', body: JSON.stringify(data) }),
  updateDomain: (id: string, data: Partial<Domain>) =>
    fetchJson<Domain>(`/domains/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDomain: (id: string) =>
    fetchJson<{ message: string }>(`/domains/${id}`, { method: 'DELETE' }),
  checkDomain: (id: string) =>
    fetchJson<Domain>(`/domains/${id}/check`, { method: 'POST' }),

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
  exportBackupUrl: () => `${API_BASE}/backup/export?token=${localStorage.getItem('rededoc_token') || ''}`,
  exportBackupZipUrl: () => `${API_BASE}/backup/export-zip?token=${localStorage.getItem('rededoc_token') || ''}`,
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

    const token = localStorage.getItem('rededoc_token');
    const res = await fetch(`${API_BASE}/images/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    }),

  // Visão Geral Global (Fase 5)
  getDashboardOverview: () => fetchJson<DashboardOverviewData>('/dashboard/overview'),

  // Busca Global Unificada FTS5 (Fase 5)
  searchGlobal: (query: string, clientId?: string) => {
    let url = `/search?q=${encodeURIComponent(query)}`;
    if (clientId) url += `&clientId=${encodeURIComponent(clientId)}`;
    return fetchJson<GroupedSearchResults>(url);
  },

  // Favoritos do Usuário (Fase 5)
  getFavorites: () => fetchJson<FavoriteItem[]>('/favorites'),
  checkFavorite: (type: string, id: string) =>
    fetchJson<{ isFavorite: boolean }>(`/favorites/check?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`),
  addFavorite: (entityType: string, entityId: string) =>
    fetchJson<{ id: string; isFavorite: boolean }>('/favorites', {
      method: 'POST',
      body: JSON.stringify({ entityType, entityId })
    }),
  removeFavorite: (entityType: string, entityId: string) =>
    fetchJson<{ message: string; isFavorite: boolean }>(`/favorites/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`, {
      method: 'DELETE'
    }),

  // IPAM e Sub-redes (Fase 6)
  getSubnets: (clientId?: string) => {
    let url = '/subnets';
    if (clientId) url += `?clientId=${encodeURIComponent(clientId)}`;
    return fetchJson<Subnet[]>(url);
  },
  getSubnet: (id: string) => fetchJson<Subnet>(`/subnets/${id}`),
  getSubnetUsage: (id: string) => fetchJson<SubnetUsageReport>(`/subnets/${id}/usage`),
  suggestSubnets: (clientId: string) => fetchJson<SubnetSuggestion[]>(`/subnets/suggest?clientId=${encodeURIComponent(clientId)}`),
  detectSubnetConflicts: (clientId: string) => fetchJson<ClientIpConflictsReport>(`/subnets/conflicts?clientId=${encodeURIComponent(clientId)}`),
  createSubnet: (data: Partial<Subnet>) =>
    fetchJson<Subnet>('/subnets', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateSubnet: (id: string, data: Partial<Subnet>) =>
    fetchJson<Subnet>(`/subnets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteSubnet: (id: string) =>
    fetchJson<{ message: string }>(`/subnets/${id}`, {
      method: 'DELETE'
    }),

  // Gestão de Usuários e RBAC (Fase 4)
  getUsers: () => fetchJson<SystemUser[]>('/users'),
  getUser: (id: string) => fetchJson<SystemUser>(`/users/${id}`),
  createUser: (data: any) =>
    fetchJson<SystemUser>('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateUser: (id: string, data: any) =>
    fetchJson<SystemUser>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  resetUserPassword: (id: string, password: string) =>
    fetchJson<{ success: boolean; message: string }>(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password })
    }),
  deleteUser: (id: string) =>
    fetchJson<{ success: boolean; message: string }>(`/users/${id}`, {
      method: 'DELETE'
    }),

  // Portal do Cliente (Fase 4)
  getPortalOverview: () => fetchJson<PortalOverview>('/portal/overview'),
  getPortalEquipments: () => fetchJson<PortalEquipment[]>('/portal/equipments'),
  getPortalServiceOrders: () => fetchJson<PortalServiceOrder[]>('/portal/service-orders'),
  getPortalArticles: () => fetchJson<PortalArticle[]>('/portal/articles')
};
