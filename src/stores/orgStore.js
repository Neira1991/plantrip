import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function toSnake(str) {
  return str.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)
}

function camelizeKeys(obj) {
  if (Array.isArray(obj)) return obj.map(camelizeKeys)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toCamel(k), camelizeKeys(v)])
    )
  }
  return obj
}

function snakifyKeys(obj) {
  if (Array.isArray(obj)) return obj.map(snakifyKeys)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toSnake(k), snakifyKeys(v)])
    )
  }
  return obj
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const config = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  }

  const response = await fetch(url, config)

  if (response.status === 204) {
    return null
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${response.status}`)
  }

  return response.json()
}

export const useOrgStore = create(
  devtools(
    (set, get) => ({
      organization: null,
      members: [],
      invites: [],
      orgTrips: [],
      stats: null,
      isLoading: false,
      error: null,

      loadOrganization: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await request('/org')
          set({
            organization: camelizeKeys(data),
            isLoading: false
          })
        } catch (error) {
          set({ error: error.message, isLoading: false })
        }
      },

      createOrganization: async (name) => {
        set({ isLoading: true, error: null })
        try {
          const data = await request('/org', {
            method: 'POST',
            body: JSON.stringify({ name }),
          })
          set({
            organization: camelizeKeys(data),
            isLoading: false
          })
          return camelizeKeys(data)
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      updateOrganization: async (updates) => {
        set({ isLoading: true, error: null })
        try {
          const data = await request('/org', {
            method: 'PUT',
            body: JSON.stringify(snakifyKeys(updates)),
          })
          set({
            organization: camelizeKeys(data),
            isLoading: false
          })
          return camelizeKeys(data)
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      deleteOrganization: async () => {
        set({ isLoading: true, error: null })
        try {
          await request('/org', { method: 'DELETE' })
          set({
            organization: null,
            members: [],
            invites: [],
            orgTrips: [],
            stats: null,
            isLoading: false
          })
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      loadMembers: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await request('/org/members')
          set({
            members: camelizeKeys(data),
            isLoading: false
          })
        } catch (error) {
          set({ error: error.message, isLoading: false })
        }
      },

      inviteMember: async (email, role) => {
        set({ isLoading: true, error: null })
        try {
          const data = await request('/org/invites', {
            method: 'POST',
            body: JSON.stringify({ email, role }),
          })
          const invite = camelizeKeys(data)
          set((state) => ({
            invites: [...state.invites, invite],
            isLoading: false
          }))
          return invite
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      removeMember: async (userId) => {
        set({ isLoading: true, error: null })
        try {
          await request(`/org/members/${userId}`, { method: 'DELETE' })
          set((state) => ({
            members: state.members.filter(m => m.id !== userId),
            isLoading: false
          }))
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      updateMemberRole: async (userId, role) => {
        set({ isLoading: true, error: null })
        try {
          const data = await request(`/org/members/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role }),
          })
          const updated = camelizeKeys(data)
          set((state) => ({
            members: state.members.map(m => m.id === userId ? updated : m),
            isLoading: false
          }))
          return updated
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      revokeInvite: async (inviteId) => {
        set({ isLoading: true, error: null })
        try {
          await request(`/org/invites/${inviteId}`, { method: 'DELETE' })
          set((state) => ({
            invites: state.invites.filter(i => i.id !== inviteId),
            isLoading: false
          }))
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      loadOrgTrips: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await request('/org/trips')
          set({
            orgTrips: camelizeKeys(data),
            isLoading: false
          })
        } catch (error) {
          set({ error: error.message, isLoading: false })
        }
      },

      loadStats: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await request('/org/stats')
          set({
            stats: camelizeKeys(data),
            isLoading: false
          })
        } catch (error) {
          set({ error: error.message, isLoading: false })
        }
      },

      loadInvites: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await request('/org/invites')
          set({
            invites: camelizeKeys(data),
            isLoading: false
          })
        } catch (error) {
          set({ error: error.message, isLoading: false })
        }
      },

      leaveOrganization: async () => {
        const { organization } = get()
        if (!organization) return

        set({ isLoading: true, error: null })
        try {
          await request('/org/leave', { method: 'DELETE' })
          set({
            organization: null,
            members: [],
            invites: [],
            orgTrips: [],
            stats: null,
            isLoading: false
          })
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'OrgStore' }
  )
)
