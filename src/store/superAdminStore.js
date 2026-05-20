import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import superAdminApi from '../services/superAdminApi'

export const useSuperAdminStore = create(
  persist(
    (set) => ({
      superAdmin: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { data } = await superAdminApi.post('/super-admin/login', { email, password })
          localStorage.setItem('sa_access_token',  data.access_token)
          localStorage.setItem('sa_refresh_token', data.refresh_token)
          set({ superAdmin: { name: data.name, email: data.email }, isLoading: false })
          return { success: true }
        } catch (e) {
          set({ isLoading: false })
          throw e
        }
      },

      logout: () => {
        localStorage.removeItem('sa_access_token')
        localStorage.removeItem('sa_refresh_token')
        set({ superAdmin: null })
        window.location.href = '/super-admin/login'
      },

      fetchMe: async () => {
        try {
          const { data } = await superAdminApi.get('/super-admin/me')
          set({ superAdmin: { name: data.name, email: data.email } })
        } catch {}
      },
    }),
    { name: 'crm-super-admin', partialize: s => ({ superAdmin: s.superAdmin }) }
  )
)
