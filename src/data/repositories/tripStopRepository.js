import { localStorageAdapter } from '../adapters/localStorageAdapter'

const STOPS_KEY = 'plantrip_trip_stops'
const MOVEMENTS_KEY = 'plantrip_movements'
const ACTIVITIES_KEY = 'plantrip_activities'

export const tripStopRepository = {
  async getByTripId(tripId) {
    const all = await localStorageAdapter.getAll(STOPS_KEY)
    return all
      .filter(s => s.tripId === tripId)
      .sort((a, b) => a.sortIndex - b.sortIndex)
  },

  async create(tripId, data) {
    const existing = await this.getByTripId(tripId)
    const nextIndex = existing.length > 0
      ? Math.max(...existing.map(s => s.sortIndex)) + 1
      : 0

    return localStorageAdapter.create(STOPS_KEY, {
      tripId,
      sortIndex: nextIndex,
      name: data.name,
      lng: data.lng,
      lat: data.lat,
      notes: data.notes || '',
    })
  },

  async update(stopId, updates) {
    return localStorageAdapter.update(STOPS_KEY, stopId, updates)
  },

  async deleteWithCascade(tripId, stopId) {
    // Delete all activities for this stop
    const allActivities = await localStorageAdapter.getAll(ACTIVITIES_KEY)
    const filteredActivities = allActivities.filter(a => a.tripStopId !== stopId)
    await localStorageAdapter.replaceAll(ACTIVITIES_KEY, filteredActivities)

    // Delete all movements referencing this stop
    const allMovements = await localStorageAdapter.getAll(MOVEMENTS_KEY)
    const filteredMovements = allMovements.filter(
      m => m.fromStopId !== stopId && m.toStopId !== stopId
    )
    await localStorageAdapter.replaceAll(MOVEMENTS_KEY, filteredMovements)

    // Delete the stop itself
    await localStorageAdapter.delete(STOPS_KEY, stopId)

    // Renumber remaining stops
    const remaining = await this.getByTripId(tripId)
    const renumbered = remaining.map((stop, i) => ({ ...stop, sortIndex: i }))
    const allStops = await localStorageAdapter.getAll(STOPS_KEY)
    const otherStops = allStops.filter(s => s.tripId !== tripId)
    await localStorageAdapter.replaceAll(STOPS_KEY, [...otherStops, ...renumbered])

    return renumbered
  },

  async reorder(tripId, fromIndex, toIndex) {
    const stops = await this.getByTripId(tripId)
    if (fromIndex < 0 || fromIndex >= stops.length || toIndex < 0 || toIndex >= stops.length) {
      return stops
    }

    const reordered = [...stops]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    const renumbered = reordered.map((stop, i) => ({
      ...stop,
      sortIndex: i,
      updatedAt: new Date().toISOString(),
    }))

    // Replace stops in storage
    const allStops = await localStorageAdapter.getAll(STOPS_KEY)
    const otherStops = allStops.filter(s => s.tripId !== tripId)
    await localStorageAdapter.replaceAll(STOPS_KEY, [...otherStops, ...renumbered])

    // Delete all movements for this trip (they're now invalid)
    const allMovements = await localStorageAdapter.getAll(MOVEMENTS_KEY)
    const filteredMovements = allMovements.filter(m => m.tripId !== tripId)
    await localStorageAdapter.replaceAll(MOVEMENTS_KEY, filteredMovements)

    return renumbered
  },

  async deleteByTripId(tripId) {
    const allStops = await localStorageAdapter.getAll(STOPS_KEY)
    const filtered = allStops.filter(s => s.tripId !== tripId)
    await localStorageAdapter.replaceAll(STOPS_KEY, filtered)
  },
}
