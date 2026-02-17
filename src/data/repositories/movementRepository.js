import { localStorageAdapter } from '../adapters/localStorageAdapter'

const STORAGE_KEY = 'plantrip_movements'

export const movementRepository = {
  async getByTripId(tripId) {
    const all = await localStorageAdapter.getAll(STORAGE_KEY)
    return all.filter(m => m.tripId === tripId)
  },

  async upsert(tripId, fromStopId, toStopId, data) {
    const all = await localStorageAdapter.getAll(STORAGE_KEY)
    const existing = all.find(
      m => m.fromStopId === fromStopId && m.toStopId === toStopId
    )

    if (existing) {
      return localStorageAdapter.update(STORAGE_KEY, existing.id, {
        type: data.type,
        durationMinutes: data.durationMinutes ?? null,
        departureTime: data.departureTime ?? null,
        arrivalTime: data.arrivalTime ?? null,
        carrier: data.carrier ?? '',
        bookingRef: data.bookingRef ?? '',
        notes: data.notes ?? '',
      })
    }

    return localStorageAdapter.create(STORAGE_KEY, {
      tripId,
      fromStopId,
      toStopId,
      type: data.type,
      durationMinutes: data.durationMinutes ?? null,
      departureTime: data.departureTime ?? null,
      arrivalTime: data.arrivalTime ?? null,
      carrier: data.carrier ?? '',
      bookingRef: data.bookingRef ?? '',
      notes: data.notes ?? '',
    })
  },

  async update(movementId, updates) {
    return localStorageAdapter.update(STORAGE_KEY, movementId, updates)
  },

  async delete(movementId) {
    return localStorageAdapter.delete(STORAGE_KEY, movementId)
  },

  async deleteByTripId(tripId) {
    const all = await localStorageAdapter.getAll(STORAGE_KEY)
    const filtered = all.filter(m => m.tripId !== tripId)
    await localStorageAdapter.replaceAll(STORAGE_KEY, filtered)
  },

  async deleteByStopId(stopId) {
    const all = await localStorageAdapter.getAll(STORAGE_KEY)
    const filtered = all.filter(
      m => m.fromStopId !== stopId && m.toStopId !== stopId
    )
    await localStorageAdapter.replaceAll(STORAGE_KEY, filtered)
  },
}
