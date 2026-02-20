import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { apiAdapter } from '../data/adapters/apiAdapter'

async function withLoading(set, asyncFn) {
  set({ isLoading: true, error: null })
  try {
    const result = await asyncFn()
    set({ isLoading: false })
    return result
  } catch (error) {
    set({ error: error.message, isLoading: false })
    throw error
  }
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
        await withLoading(set, async () => {
          const data = await apiAdapter.get('/org')
          set({ organization: data })
        }).catch(() => {})
      },

      createOrganization: async (name) => {
        return withLoading(set, async () => {
          const data = await apiAdapter.post('/org', { name })
          set({ organization: data })
          return data
        })
      },

      updateOrganization: async (updates) => {
        return withLoading(set, async () => {
          const data = await apiAdapter.put('/org', updates)
          set({ organization: data })
          return data
        })
      },

      deleteOrganization: async () => {
        return withLoading(set, async () => {
          await apiAdapter.del('/org')
          set({
            organization: null,
            members: [],
            invites: [],
            orgTrips: [],
            stats: null,
          })
        })
      },

      loadMembers: async () => {
        await withLoading(set, async () => {
          const data = await apiAdapter.get('/org/members')
          set({ members: data })
        }).catch(() => {})
      },

      inviteMember: async (email, role) => {
        return withLoading(set, async () => {
          const invite = await apiAdapter.post('/org/invites', { email, role })
          set((state) => ({
            invites: [...state.invites, invite],
          }))
          return invite
        })
      },

      removeMember: async (userId) => {
        return withLoading(set, async () => {
          await apiAdapter.del(`/org/members/${userId}`)
          set((state) => ({
            members: state.members.filter(m => m.id !== userId),
          }))
        })
      },

      updateMemberRole: async (userId, role) => {
        return withLoading(set, async () => {
          const updated = await apiAdapter.put(`/org/members/${userId}/role`, { role })
          set((state) => ({
            members: state.members.map(m => m.id === userId ? updated : m),
          }))
          return updated
        })
      },

      revokeInvite: async (inviteId) => {
        return withLoading(set, async () => {
          await apiAdapter.del(`/org/invites/${inviteId}`)
          set((state) => ({
            invites: state.invites.filter(i => i.id !== inviteId),
          }))
        })
      },

      loadOrgTrips: async () => {
        await withLoading(set, async () => {
          const data = await apiAdapter.get('/org/trips')
          set({ orgTrips: data })
        }).catch(() => {})
      },

      loadStats: async () => {
        await withLoading(set, async () => {
          const data = await apiAdapter.get('/org/stats')
          set({ stats: data })
        }).catch(() => {})
      },

      loadInvites: async () => {
        await withLoading(set, async () => {
          const data = await apiAdapter.get('/org/invites')
          set({ invites: data })
        }).catch(() => {})
      },

      leaveOrganization: async () => {
        const { organization } = get()
        if (!organization) return

        return withLoading(set, async () => {
          await apiAdapter.del('/org/leave')
          set({
            organization: null,
            members: [],
            invites: [],
            orgTrips: [],
            stats: null,
          })
        })
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'OrgStore' }
  )
)
