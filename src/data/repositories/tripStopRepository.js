import { apiAdapter } from '../adapters/apiAdapter'

export const tripStopRepository = {
  async getByTripId(tripId) {
    return apiAdapter.get(`/trips/${tripId}/stops`)
  },

  async create(tripId, data) {
    return apiAdapter.post(`/trips/${tripId}/stops`, {
      name: data.name,
      lng: data.lng,
      lat: data.lat,
      notes: data.notes || '',
    })
  },

  async update(stopId, updates) {
    return apiAdapter.put(`/stops/${stopId}`, updates)
  },

  async deleteWithCascade(tripId, stopId) {
    await apiAdapter.del(`/stops/${stopId}`)
    // Backend handles cascade + renumbering; return updated stops
    return this.getByTripId(tripId)
  },

  async reorder(tripId, fromIndex, toIndex) {
    return apiAdapter.put(`/trips/${tripId}/stops/reorder`, {
      fromIndex,
      toIndex,
    })
  },

  async deleteByTripId(tripId) {
    // No-op: cascade handled by backend when trip is deleted
  },
}
