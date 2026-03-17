import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/api/v1`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (typeof window !== 'undefined') {
          const tokens = this.getTokens();
          if (tokens?.accessToken && config.headers) {
            config.headers.Authorization = `Bearer ${tokens.accessToken}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                return this.client(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const tokens = this.getTokens();
            if (tokens?.refreshToken) {
              const { data } = await axios.post<ApiResponse<{ tokens: Tokens }>>(
                `${API_BASE_URL}/api/v1/auth/refresh-token`,
                { refreshToken: tokens.refreshToken }
              );

              if (data.success && data.data?.tokens) {
                this.setTokens(data.data.tokens);
                this.processQueue(null, data.data.tokens.accessToken);
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${data.data.tokens.accessToken}`;
                }
                return this.client(originalRequest);
              }
            }
          } catch (refreshError) {
            this.processQueue(refreshError, null);
            if (typeof window !== 'undefined') {
              this.clearTokens();
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: unknown, token: string | null): void {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else {
        prom.resolve(token);
      }
    });
    this.failedQueue = [];
  }

  getTokens(): Tokens | null {
    if (typeof window === 'undefined') return null;
    try {
      const tokens = localStorage.getItem('isp_tokens');
      return tokens ? JSON.parse(tokens) : null;
    } catch {
      return null;
    }
  }

  setTokens(tokens: Tokens): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('isp_tokens', JSON.stringify(tokens));
    }
  }

  clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isp_tokens');
      localStorage.removeItem('isp_user');
    }
  }

  getUser(): Record<string, unknown> | null {
    if (typeof window === 'undefined') return null;
    try {
      const user = localStorage.getItem('isp_user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }

  setUser(user: Record<string, unknown>): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('isp_user', JSON.stringify(user));
    }
  }

  // Auth
  async login(email: string, password: string) {
    const { data } = await this.client.post<ApiResponse<{ user: Record<string, unknown>; tokens: Tokens }>>('/auth/login', { email, password });
    return data;
  }

  async register(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    [key: string]: unknown;
  }) {
    const { data } = await this.client.post<ApiResponse<{ user: Record<string, unknown>; tokens: Tokens }>>('/auth/register', payload);
    return data;
  }

  async getProfile() {
    const { data } = await this.client.get<ApiResponse<{ user: Record<string, unknown> }>>('/auth/profile');
    return data;
  }

  async updateProfile(payload: Record<string, unknown>) {
    const { data } = await this.client.put<ApiResponse<{ user: Record<string, unknown> }>>('/auth/profile', payload);
    return data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const { data } = await this.client.post<ApiResponse>('/auth/change-password', { currentPassword, newPassword });
    return data;
  }

  async logout() {
    const { data } = await this.client.post<ApiResponse>('/auth/logout');
    return data;
  }

  async forgotPassword(email: string) {
    const { data } = await this.client.post<ApiResponse>('/auth/forgot-password', { email });
    return data;
  }

  async resetPassword(token: string, password: string) {
    const { data } = await this.client.post<ApiResponse>('/auth/reset-password', { token, password });
    return data;
  }

  // Plans
  async getPlans(params?: { type?: string; dataType?: string }) {
    const { data } = await this.client.get<ApiResponse<{ plans: Record<string, unknown>[] }>>('/plans', { params });
    return data;
  }

  async getPlan(id: string) {
    const { data } = await this.client.get<ApiResponse<{ plan: Record<string, unknown> }>>(`/plans/${id}`);
    return data;
  }

  async createPlan(payload: Record<string, unknown>) {
    const { data } = await this.client.post<ApiResponse<{ plan: Record<string, unknown> }>>('/plans', payload);
    return data;
  }

  async updatePlan(id: string, payload: Record<string, unknown>) {
    const { data } = await this.client.put<ApiResponse<{ plan: Record<string, unknown> }>>(`/plans/${id}`, payload);
    return data;
  }

  async deletePlan(id: string) {
    const { data } = await this.client.delete<ApiResponse>(`/plans/${id}`);
    return data;
  }

  // Subscriptions
  async getSubscriptions() {
    const { data } = await this.client.get<ApiResponse<{ subscriptions: Record<string, unknown>[] }>>('/subscriptions');
    return data;
  }

  async getSubscription(id: string) {
    const { data } = await this.client.get<ApiResponse<{ subscription: Record<string, unknown> }>>(`/subscriptions/${id}`);
    return data;
  }

  async createSubscription(payload: { planId: string; paymentMethod?: string }) {
    const { data } = await this.client.post<ApiResponse<{ subscription: Record<string, unknown> }>>('/subscriptions', payload);
    return data;
  }

  async cancelSubscription(subscriptionId: string, reason?: string) {
    const { data } = await this.client.post<ApiResponse>('/subscriptions/cancel', { subscriptionId, reason });
    return data;
  }

  async renewSubscription(subscriptionId: string, paymentMethod?: string) {
    const { data } = await this.client.post<ApiResponse<{ subscription: Record<string, unknown> }>>('/subscriptions/renew', { subscriptionId, paymentMethod });
    return data;
  }

  // Invoices
  async getInvoices(params?: { status?: string; page?: number; limit?: number }) {
    const { data } = await this.client.get<ApiResponse<{ invoices: Record<string, unknown>[]; meta: Record<string, unknown> }>>('/invoices', { params });
    return data;
  }

  async getInvoice(id: string) {
    const { data } = await this.client.get<ApiResponse<{ invoice: Record<string, unknown> }>>(`/invoices/${id}`);
    return data;
  }

  // Admin invoices
  async getAllInvoices(params?: Record<string, unknown>) {
    const { data } = await this.client.get<ApiResponse<{ invoices: Record<string, unknown>[]; meta: Record<string, unknown> }>>('/invoices/admin/all', { params });
    return data;
  }

  async getInvoiceStats() {
    const { data } = await this.client.get<ApiResponse<Record<string, unknown>>>('/invoices/admin/stats');
    return data;
  }

  async generateInvoices() {
    const { data } = await this.client.post<ApiResponse>('/invoices/admin/generate');
    return data;
  }

  // Payments
  async getPaymentHistory(params?: { status?: string; method?: string; page?: number; limit?: number }) {
    const { data } = await this.client.get<ApiResponse<{ payments: Record<string, unknown>[]; meta: Record<string, unknown> }>>('/payments/history', { params });
    return data;
  }

  async getPayment(id: string) {
    const { data } = await this.client.get<ApiResponse<{ payment: Record<string, unknown> }>>(`/payments/${id}`);
    return data;
  }

  async initiateMpesaPayment(payload: { phoneNumber?: string; amount: number; accountReference?: string; transactionDesc?: string }) {
    const { data } = await this.client.post<ApiResponse<{ paymentId: string; checkoutRequestId: string; customerMessage: string }>>('/payments/mpesa/initiate', payload);
    return data;
  }

  async checkMpesaStatus(paymentId: string) {
    const { data } = await this.client.get<ApiResponse<{ payment: Record<string, unknown> }>>(`/payments/mpesa/status/${paymentId}`);
    return data;
  }

  async initiateAirtelPayment(payload: { phoneNumber?: string; amount: number; description?: string }) {
    const { data } = await this.client.post<ApiResponse<{ paymentId: string; reference: string }>>('/payments/airtel/initiate', payload);
    return data;
  }

  // Admin payments
  async getAllPayments(params?: Record<string, unknown>) {
    const { data } = await this.client.get<ApiResponse<{ payments: Record<string, unknown>[]; meta: Record<string, unknown> }>>('/payments', { params });
    return data;
  }

  async getPaymentStats(params?: { startDate?: string; endDate?: string }) {
    const { data } = await this.client.get<ApiResponse<Record<string, unknown>>>('/payments/stats', { params });
    return data;
  }

  // Usage
  async getUsageSummary() {
    const { data } = await this.client.get<ApiResponse<Record<string, unknown>>>('/usage/summary');
    return data;
  }

  async getRealtimeUsage() {
    const { data } = await this.client.get<ApiResponse<Record<string, unknown>>>('/usage/realtime');
    return data;
  }

  async getUsageHistory(params?: { page?: number; limit?: number; startDate?: string; endDate?: string }) {
    const { data } = await this.client.get<ApiResponse<{ records: Record<string, unknown>[]; meta: Record<string, unknown> }>>('/usage/history', { params });
    return data;
  }

  // Customers (Admin)
  async getCustomers(params?: { page?: number; limit?: number; status?: string; search?: string }) {
    const { data } = await this.client.get<ApiResponse<{ customers: Record<string, unknown>[]; meta: Record<string, unknown> }>>('/customers', { params });
    return data;
  }

  async getCustomer(id: string) {
    const { data } = await this.client.get<ApiResponse<{ customer: Record<string, unknown> }>>(`/customers/${id}`);
    return data;
  }

  async createCustomer(payload: Record<string, unknown>) {
    const { data } = await this.client.post<ApiResponse<{ customer: Record<string, unknown> }>>('/customers', payload);
    return data;
  }

  async updateCustomer(id: string, payload: Record<string, unknown>) {
    const { data } = await this.client.put<ApiResponse>(`/customers/${id}`, payload);
    return data;
  }

  async deleteCustomer(id: string) {
    const { data } = await this.client.delete<ApiResponse>(`/customers/${id}`);
    return data;
  }

  async getCustomerStats() {
    const { data } = await this.client.get<ApiResponse<Record<string, unknown>>>('/customers/stats');
    return data;
  }

  async getCustomerBillingSummary(id: string) {
    const { data } = await this.client.get<ApiResponse<Record<string, unknown>>>(`/customers/${id}/billing-summary`);
    return data;
  }

  // Notifications
  async getNotifications(params?: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const { data } = await this.client.get<ApiResponse<{ notifications: Record<string, unknown>[]; meta: Record<string, unknown> }>>('/auth/notifications', { params });
    return data;
  }

  async markNotificationRead(id: string) {
    const { data } = await this.client.put<ApiResponse>(`/auth/notifications/${id}/read`);
    return data;
  }

  async markAllNotificationsRead() {
    const { data } = await this.client.put<ApiResponse>('/auth/notifications/read-all');
    return data;
  }

  // Admin subscriptions
  async getAllSubscriptions(params?: Record<string, unknown>) {
    const { data } = await this.client.get<ApiResponse<{ subscriptions: Record<string, unknown>[]; meta: Record<string, unknown> }>>('/subscriptions/admin/all', { params });
    return data;
  }

  // RADIUS (Admin)
  async getRadiusSessions(params?: { status?: string; page?: number; limit?: number }) {
    const { data } = await this.client.get<ApiResponse<{ sessions: Record<string, unknown>[]; meta: Record<string, unknown> }>>('/radius/sessions', { params });
    return data;
  }

  async getRadiusSessionStats() {
    const { data } = await this.client.get<ApiResponse<Record<string, unknown>>>('/radius/sessions/stats');
    return data;
  }

  async getRadiusEvents(params?: { limit?: number }) {
    const { data } = await this.client.get<ApiResponse<{ events: Record<string, unknown>[] }>>('/radius/sessions/events', { params });
    return data;
  }

  async getHealthDetailed() {
    const { data } = await this.client.get<ApiResponse<Record<string, unknown>>>('/health');
    return data;
  }
}

export const api = new ApiClient();
export default api;
