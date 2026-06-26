// apps/web/src/services/api.ts
// Cliente HTTP central com interceptors de autenticação e refresh token

import axios, { AxiosInstance } from 'axios'
import { useAuthStore } from '@/store/authStore'

const BASE_URL = import.meta.env.VITE_API_URL || '/v1'

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Interceptor: injeta o access token em toda requisição
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = []

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

// Interceptor: renova token automaticamente se receber 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    const { refreshToken, setAccessToken, logout } = useAuthStore.getState()
    if (!refreshToken) {
      logout()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
      const newToken = data.data.accessToken
      setAccessToken(newToken)
      processQueue(null, newToken)
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      logout()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

// ── Services por domínio ───────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data.data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }),
  me: () => api.get('/auth/me').then((r) => r.data.data),
}

export const dashboardApi = {
  getOrg: (orgId: string, cycleId?: string) =>
    api.get(`/dashboard/org/${orgId}`, { params: { cycleId } }).then((r) => r.data.data),
  getPortfolio: () =>
    api.get('/dashboard/portfolio').then((r) => r.data.data),
}

export const requirementsApi = {
  list: (cycleId: string) =>
    api.get(`/cycles/${cycleId}/responses`).then((r) => r.data.data),
  get: (cycleId: string, reqId: number) =>
    api.get(`/cycles/${cycleId}/responses/${reqId}`).then((r) => r.data.data),
  update: (cycleId: string, reqId: number, data: any) =>
    api.put(`/cycles/${cycleId}/responses/${reqId}`, data).then((r) => r.data.data),
  submit: (cycleId: string, reqId: number) =>
    api.post(`/cycles/${cycleId}/responses/${reqId}/submit`).then((r) => r.data.data),
  assess: (cycleId: string, reqId: number, data: any) =>
    api.post(`/cycles/${cycleId}/responses/${reqId}/assess`, data).then((r) => r.data.data),
  requestRevision: (cycleId: string, reqId: number, reason: string) =>
    api.post(`/cycles/${cycleId}/responses/${reqId}/request-revision`, { reason }).then((r) => r.data.data),
}

export const organizationsApi = {
  list: (params?: any) => api.get('/organizations', { params }).then((r) => r.data),
  get: (id: string) => api.get(`/organizations/${id}`).then((r) => r.data.data),
  create: (data: any) => api.post('/organizations', data).then((r) => r.data.data),
  update: (id: string, data: any) => api.patch(`/organizations/${id}`, data).then((r) => r.data.data),
}

export const cyclesApi = {
  list: (orgId: string) => api.get(`/organizations/${orgId}/cycles`).then((r) => r.data.data),
  get: (id: string) => api.get(`/cycles/${id}`).then((r) => r.data.data),
}

export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data.data),
}

export const actionPlanApi = {
  list: (orgId: string, params?: any) =>
    api.get(`/action-plan/organizations/${orgId}/action-items`, { params }).then((r) => r.data.data),
  create: (orgId: string, data: any) =>
    api.post(`/action-plan/organizations/${orgId}/action-items`, data).then((r) => r.data.data),
  update: (id: string, data: any) =>
    api.patch(`/action-plan/action-items/${id}`, data).then((r) => r.data.data),
}
