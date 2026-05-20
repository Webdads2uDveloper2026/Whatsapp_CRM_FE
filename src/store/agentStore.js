import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import agentApi from '../services/agentApi'

export const useAgentStore = create(
  persist(
    (set, get) => ({
      agent: null,
      isLoading: false,

      loginAgent: async (email, password, tenant_id) => {
        set({ isLoading: true })
        try {
          const { data } = await agentApi.post('/agents/login', {
            email: email.trim().toLowerCase(),
            password,
            tenant_id: tenant_id?.trim() || undefined,
          })
          localStorage.setItem('agent_access_token',  data.access_token)
          localStorage.setItem('agent_refresh_token', data.refresh_token)
          const agent = {
            id:              data.agent_id,
            name:            data.name,
            email:           data.email,
            role:            data.role,
            permissions:     data.permissions || [],
            avatar_initials: data.avatar_initials || data.name?.[0]?.toUpperCase() || 'A',
            tenant_id:       data.tenant_id || tenant_id,
          }
          set({ agent, isLoading: false })
          return { success: true, role: data.role }
        } catch (e) {
          set({ isLoading: false })
          throw e
        }
      },

      logoutAgent: () => {
        localStorage.removeItem('agent_access_token')
        localStorage.removeItem('agent_refresh_token')
        set({ agent: null })
        window.location.href = '/agent-login'
      },

      fetchAgentMe: async () => {
        try {
          const { data } = await agentApi.get('/agents/me')
          set({
            agent: {
              id:              data.id,
              name:            data.name,
              email:           data.email,
              role:            data.role,
              permissions:     data.permissions || [],
              avatar_initials: data.avatar_initials,
              tenant_id:       data.tenant_id,
            }
          })
        } catch {}
      },

      hasPermission: (permission) => {
        const { agent } = get()
        if (!agent) return false
        return agent.permissions.includes(permission)
      },

      isSuperAdmin: () => {
        const { agent } = get()
        return agent?.role === 'superadmin'
      },

      isManagerOrAbove: () => {
        const { agent } = get()
        return ['superadmin', 'manager'].includes(agent?.role)
      },
    }),
    {
      name: 'crm-agent',
      partialize: s => ({ agent: s.agent }),
    }
  )
)
