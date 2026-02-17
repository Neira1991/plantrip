import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { tripStopRepository } from '../data/repositories/tripStopRepository'
import { movementRepository } from '../data/repositories/movementRepository'
import { activityRepository } from '../data/repositories/activityRepository'

export const useItineraryStore = create(
  devtools(
    (set, get) => ({
      stops: [],
      movements: [],
      activities: [],
      isLoading: false,

      loadItinerary: async (tripId) => {
        set({ isLoading: true })
        try {
          const stops = await tripStopRepository.getByTripId(tripId)
          const movements = await movementRepository.getByTripId(tripId)
          const stopIds = stops.map(s => s.id)
          const activities = await activityRepository.getByStopIds(stopIds)
          set({ stops, movements, activities, isLoading: false })
        } catch {
          set({ stops: [], movements: [], activities: [], isLoading: false })
        }
      },

      addStop: async (tripId, stopData) => {
        const stop = await tripStopRepository.create(tripId, stopData)
        set(state => ({ stops: [...state.stops, stop] }))
        return stop
      },

      updateStop: async (stopId, updates) => {
        const updated = await tripStopRepository.update(stopId, updates)
        set(state => ({
          stops: state.stops.map(s => s.id === stopId ? updated : s),
        }))
        return updated
      },

      removeStop: async (tripId, stopId) => {
        const newStops = await tripStopRepository.deleteWithCascade(tripId, stopId)
        const movements = await movementRepository.getByTripId(tripId)
        const stopIds = newStops.map(s => s.id)
        const activities = await activityRepository.getByStopIds(stopIds)
        set({ stops: newStops, movements, activities })
      },

      reorderStop: async (tripId, fromIndex, toIndex) => {
        const newStops = await tripStopRepository.reorder(tripId, fromIndex, toIndex)
        set({ stops: newStops, movements: [] })
        return { movementsCleared: true }
      },

      addMovement: async (tripId, fromStopId, toStopId, data) => {
        const movement = await movementRepository.upsert(tripId, fromStopId, toStopId, data)
        set(state => {
          const exists = state.movements.find(m => m.id === movement.id)
          if (exists) {
            return { movements: state.movements.map(m => m.id === movement.id ? movement : m) }
          }
          return { movements: [...state.movements, movement] }
        })
        return movement
      },

      updateMovement: async (movementId, updates) => {
        const updated = await movementRepository.update(movementId, updates)
        set(state => ({
          movements: state.movements.map(m => m.id === movementId ? updated : m),
        }))
        return updated
      },

      removeMovement: async (movementId) => {
        await movementRepository.delete(movementId)
        set(state => ({
          movements: state.movements.filter(m => m.id !== movementId),
        }))
      },

      addActivity: async (stopId, activityData) => {
        const activity = await activityRepository.create(stopId, activityData)
        set(state => ({ activities: [...state.activities, activity] }))
        return activity
      },

      updateActivity: async (activityId, updates) => {
        const updated = await activityRepository.update(activityId, updates)
        set(state => ({
          activities: state.activities.map(a => a.id === activityId ? updated : a),
        }))
        return updated
      },

      removeActivity: async (stopId, activityId) => {
        await activityRepository.delete(activityId)
        const remaining = await activityRepository.getByStopId(stopId)
        set(state => ({
          activities: [
            ...state.activities.filter(a => a.tripStopId !== stopId),
            ...remaining,
          ],
        }))
      },

      reorderActivity: async (stopId, fromIndex, toIndex) => {
        const renumbered = await activityRepository.reorder(stopId, fromIndex, toIndex)
        set(state => ({
          activities: [
            ...state.activities.filter(a => a.tripStopId !== stopId),
            ...renumbered,
          ],
        }))
      },
    }),
    { name: 'ItineraryStore' }
  )
)
