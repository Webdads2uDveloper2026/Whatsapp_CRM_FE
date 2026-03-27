import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      tenant: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/login', { email, password })
          localStorage.setItem('access_token',  data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          set({
            tenant:       { id: data.tenant_id, businessName: data.business_name,
                            status: data.status, wabaConnected: data.waba_connected },
            accessToken:  data.access_token,
            refreshToken: data.refresh_token,
            isLoading:    false,
          })
          return { success: true, status: data.status }
        } catch (e) {
          set({ isLoading: false })
          throw e
        }
      },

      logout: () => {
        localStorage.clear()
        set({ tenant: null, accessToken: null, refreshToken: null })
        window.location.href = '/login'
      },

      fetchMe: async () => {
        try {
          const { data } = await api.get('/auth/me')
          set({ tenant: { id: data.tenant_id, businessName: data.business_name,
                          status: data.status, wabaConnected: data.waba_connected,
                          phoneNumber: data.phone_number, wabaId: data.waba_id } })
        } catch {}
      },
    }),
    { name: 'crm-auth', partialize: s => ({ tenant: s.tenant, accessToken: s.accessToken }) }
  )
)
