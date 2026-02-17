import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { tripRepository } from '../data/repositories/tripRepository'

export const useTripStore = create(
  devtools(
    (set) => ({
      trips: [],
      isLoading: false,
      error: null,

      loadTrips: async () => {
        set({ isLoading: true, error: null })
        try {
          const trips = await tripRepository.getAll()
          set({ trips, isLoading: false })
        } catch (error) {
          set({ error: error.message, isLoading: false })
        }
      },

      createTrip: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const newTrip = await tripRepository.create(data)
          set((state) => ({
            trips: [newTrip, ...state.trips],
            isLoading: false,
          }))
          return newTrip
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      updateTrip: async (id, updates) => {
        set({ isLoading: true, error: null })
        try {
          const updated = await tripRepository.update(id, updates)
          set((state) => ({
            trips: state.trips.map(t => t.id === id ? updated : t),
            isLoading: false,
          }))
          return updated
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      deleteTrip: async (id) => {
        set({ isLoading: true, error: null })
        try {
          await tripRepository.delete(id)
          set((state) => ({
            trips: state.trips.filter(t => t.id !== id),
            isLoading: false,
          }))
        } catch (error) {
          set({ error: error.message, isLoading: false })
          throw error
        }
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'TripStore' }
  )
)
