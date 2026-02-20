import { apiAdapter } from '../adapters/apiAdapter'

export const movementRepository = {
  async getByTripId(tripId) {
    return apiAdapter.get(`/trips/${tripId}/movements`)
  },

  async upsert(tripId, fromStopId, toStopId, data) {
    return apiAdapter.post(`/trips/${tripId}/movements`, {
      fromStopId,
      toStopId,
      type: data.type,
      durationMinutes: data.durationMinutes ?? null,
      departureTime: data.departureTime ?? null,
      arrivalTime: data.arrivalTime ?? null,
      carrier: data.carrier ?? '',
      bookingRef: data.bookingRef ?? '',
      notes: data.notes ?? '',
      price: data.price ?? null,
    })
  },

  async update(movementId, updates) {
    return apiAdapter.put(`/movements/${movementId}`, updates)
  },

  async delete(movementId) {
    await apiAdapter.del(`/movements/${movementId}`)
  },

  async deleteByTripId() {
    // No-op: cascade handled by backend
  },

  async deleteByStopId() {
    // No-op: cascade handled by backend
  },
}
