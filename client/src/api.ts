const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T = any> {
  data: T;
  error?: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // Auth
  login(username: string, password: string): Promise<{ token: string; user: import('./types').User }> {
    return this.request('POST', '/auth/login', { username, password });
  }

  logout(): Promise<any> {
    return this.request('POST', '/auth/logout');
  }

  me(): Promise<import('./types').User> {
    return this.request('GET', '/auth/me');
  }

  // Dashboard
  getDashboard(): Promise<import('./types').DashboardStats> {
    return this.request('GET', '/dashboard/dashboard');
  }

  getCalendar(month?: number, year?: number): Promise<import('./types').Job[]> {
    const params = month && year ? `?month=${month}&year=${year}` : '';
    return this.request('GET', `/dashboard/calendar${params}`);
  }

  getReconciliation(): Promise<{ sentInvoices: import('./types').Job[]; recentlyPaid: import('./types').Job[] }> {
    return this.request('GET', '/dashboard/reconciliation');
  }

  getSubbieInvoices(): Promise<{ subbieInvoices: any; pendingSubbieInvoices: import('./types').Job[] }> {
    return this.request('GET', '/dashboard/subbie-invoices');
  }

  // Jobs
  getJobs(params?: { status?: string; site_id?: string; service_id?: string }): Promise<import('./types').Job[]> {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request('GET', `/jobs${query}`);
  }

  getJob(id: string): Promise<import('./types').Job> {
    return this.request('GET', `/jobs/${id}`);
  }

  createJob(data: { site_id: string; service_id: string; notes?: string }): Promise<import('./types').Job> {
    return this.request('POST', '/jobs', data);
  }

  updateJob(id: string, data: any): Promise<import('./types').Job> {
    return this.request('PUT', `/jobs/${id}`, data);
  }

  deleteJob(id: string): Promise<any> {
    return this.request('DELETE', `/jobs/${id}`);
  }

  // Master data
  getEntities(): Promise<import('./types').BusinessEntity[]> { return this.request('GET', '/entities'); }
  createEntity(data: any): Promise<import('./types').BusinessEntity> { return this.request('POST', '/entities', data); }
  updateEntity(id: string, data: any): Promise<any> { return this.request('PUT', `/entities/${id}`, data); }
  deleteEntity(id: string): Promise<any> { return this.request('DELETE', `/entities/${id}`); }

  getSites(): Promise<import('./types').Site[]> { return this.request('GET', '/sites'); }
  createSite(data: any): Promise<import('./types').Site> { return this.request('POST', '/sites', data); }
  updateSite(id: string, data: any): Promise<any> { return this.request('PUT', `/sites/${id}`, data); }
  deleteSite(id: string): Promise<any> { return this.request('DELETE', `/sites/${id}`); }

  getServices(): Promise<import('./types').Service[]> { return this.request('GET', '/services'); }
  createService(data: any): Promise<import('./types').Service> { return this.request('POST', '/services', data); }
  updateService(id: string, data: any): Promise<any> { return this.request('PUT', `/services/${id}`, data); }
  deleteService(id: string): Promise<any> { return this.request('DELETE', `/services/${id}`); }

  getSubcontractors(): Promise<import('./types').Subcontractor[]> { return this.request('GET', '/subcontractors'); }
  createSubcontractor(data: any): Promise<import('./types').Subcontractor> { return this.request('POST', '/subcontractors', data); }
  updateSubcontractor(id: string, data: any): Promise<any> { return this.request('PUT', `/subcontractors/${id}`, data); }
  deleteSubcontractor(id: string): Promise<any> { return this.request('DELETE', `/subcontractors/${id}`); }

  getContactMatrix(): Promise<import('./types').ContactMatrix[]> { return this.request('GET', '/contact-matrix'); }
  updateContactMatrix(id: string, data: any): Promise<any> { return this.request('PUT', `/contact-matrix/${id}`, data); }

  getRateOverrides(): Promise<any[]> { return this.request('GET', '/rate-overrides'); }
  createRateOverride(data: any): Promise<any> { return this.request('POST', '/rate-overrides', data); }
  deleteRateOverride(id: string): Promise<any> { return this.request('DELETE', `/rate-overrides/${id}`); }

  getRateAudit(): Promise<any[]> { return this.request('GET', '/rate-audit'); }

  // Users
  getUsers(): Promise<import('./types').User[]> { return this.request('GET', '/auth/users'); }
  createUser(data: any): Promise<import('./types').User> { return this.request('POST', '/auth/users', data); }
  updateUser(id: string, data: any): Promise<any> { return this.request('PUT', `/auth/users/${id}`, data); }
  deleteUser(id: string): Promise<any> { return this.request('DELETE', `/auth/users/${id}`); }

  // Multi-service quotes
  getQuotes(): Promise<import('./types').Quote[]> { return this.request('GET', '/quotes'); }
  getQuote(id: string): Promise<import('./types').Quote> { return this.request('GET', `/quotes/${id}`); }
  createQuote(data: { business_entity_id: string; lines: { site_id: string; service_id: string }[]; invoice_mode: 'split' | 'combined'; notes?: string }): Promise<import('./types').Quote> {
    return this.request('POST', '/quotes', data);
  }
  updateQuote(id: string, data: any): Promise<import('./types').Quote> { return this.request('PUT', `/quotes/${id}`, data); }
  deleteQuote(id: string): Promise<any> { return this.request('DELETE', `/quotes/${id}`); }
  addQuoteLine(id: string, data: { site_id: string; service_id: string }): Promise<import('./types').Quote> {
    return this.request('POST', `/quotes/${id}/lines`, data);
  }
  removeQuoteLine(id: string, lineId: string): Promise<import('./types').Quote> {
    return this.request('DELETE', `/quotes/${id}/lines/${lineId}`);
  }
  acceptQuote(id: string, client_po_number?: string): Promise<{ success: boolean; invoice_mode: string; jobs_created: number; job_ids: string[] }> {
    return this.request('POST', `/quotes/${id}/accept`, { client_po_number });
  }

  // Recurring maintenance plans
  getRecurringPlans(): Promise<import('./types').RecurringPlan[]> { return this.request('GET', '/recurring'); }
  createRecurringPlan(data: any): Promise<import('./types').RecurringPlan> { return this.request('POST', '/recurring', data); }
  updateRecurringPlan(id: string, data: any): Promise<import('./types').RecurringPlan> { return this.request('PUT', `/recurring/${id}`, data); }
  deleteRecurringPlan(id: string): Promise<any> { return this.request('DELETE', `/recurring/${id}`); }
  getDueWork(period: string): Promise<import('./types').DueWork> {
    return this.request('GET', `/recurring/due?period=${encodeURIComponent(period)}`);
  }
  generatePlan(period: string, invoice_mode: 'split' | 'combined' = 'split'): Promise<{ period: string; quotes_created: number; lines_scheduled: number; quotes: any[]; message?: string }> {
    return this.request('POST', '/recurring/generate', { period, invoice_mode });
  }
}

export const api = new ApiClient();
export default api;
