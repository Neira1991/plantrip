import { localStorageAdapter } from '../adapters/localStorageAdapter'

const STORAGE_KEY = 'plantrip_activities'

export const activityRepository = {
  async getByStopId(stopId) {
    const all = await localStorageAdapter.getAll(STORAGE_KEY)
    return all
      .filter(a => a.tripStopId === stopId)
      .sort((a, b) => a.sortIndex - b.sortIndex)
  },

  async getByStopIds(stopIds) {
    const idSet = new Set(stopIds)
    const all = await localStorageAdapter.getAll(STORAGE_KEY)
    return all
      .filter(a => idSet.has(a.tripStopId))
      .sort((a, b) => a.sortIndex - b.sortIndex)
  },

  async create(stopId, data) {
    const existing = await this.getByStopId(stopId)
    const nextIndex = existing.length > 0
      ? Math.max(...existing.map(a => a.sortIndex)) + 1
      : 0

    return localStorageAdapter.create(STORAGE_KEY, {
      tripStopId: stopId,
      sortIndex: nextIndex,
      title: data.title,
      date: data.date ?? null,
      startTime: data.startTime ?? null,
      durationMinutes: data.durationMinutes ?? null,
      notes: data.notes ?? '',
    })
  },

  async update(activityId, updates) {
    return localStorageAdapter.update(STORAGE_KEY, activityId, updates)
  },

  async delete(activityId) {
    // Get the activity to find its stop
    const activity = await localStorageAdapter.getById(STORAGE_KEY, activityId)
    if (!activity) return

    await localStorageAdapter.delete(STORAGE_KEY, activityId)

    // Renumber remaining activities in the stop
    const remaining = await this.getByStopId(activity.tripStopId)
    if (remaining.length > 0) {
      const all = await localStorageAdapter.getAll(STORAGE_KEY)
      const otherActivities = all.filter(a => a.tripStopId !== activity.tripStopId)
      const renumbered = remaining.map((a, i) => ({ ...a, sortIndex: i }))
      await localStorageAdapter.replaceAll(STORAGE_KEY, [...otherActivities, ...renumbered])
    }
  },

  async reorder(stopId, fromIndex, toIndex) {
    const activities = await this.getByStopId(stopId)
    if (fromIndex < 0 || fromIndex >= activities.length || toIndex < 0 || toIndex >= activities.length) {
      return activities
    }

    const reordered = [...activities]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    const renumbered = reordered.map((a, i) => ({
      ...a,
      sortIndex: i,
      updatedAt: new Date().toISOString(),
    }))

    const all = await localStorageAdapter.getAll(STORAGE_KEY)
    const otherActivities = all.filter(a => a.tripStopId !== stopId)
    await localStorageAdapter.replaceAll(STORAGE_KEY, [...otherActivities, ...renumbered])

    return renumbered
  },

  async deleteByStopId(stopId) {
    const all = await localStorageAdapter.getAll(STORAGE_KEY)
    const filtered = all.filter(a => a.tripStopId !== stopId)
    await localStorageAdapter.replaceAll(STORAGE_KEY, filtered)
  },
}
