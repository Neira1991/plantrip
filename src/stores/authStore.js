import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { apiAdapter } from '../data/adapters/apiAdapter'

export const useAuthStore = create(
  devtools(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      checkAuth: async () => {
        try {
          const user = await apiAdapter.getMe()
          set({ user, isAuthenticated: true, isLoading: false, error: null })
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false, error: null })
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const user = await apiAdapter.login(email, password)
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      register: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const user = await apiAdapter.register(email, password)
          set({ user, isAuthenticated: true, isLoading: false })
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      logout: async () => {
        try {
          await apiAdapter.logout()
        } catch {
          // Ignore logout errors
        }
        set({ user: null, isAuthenticated: false, isLoading: false, error: null })
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'AuthStore' }
  )
)
