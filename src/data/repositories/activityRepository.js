import { apiAdapter } from '../adapters/apiAdapter'

export const activityRepository = {
  async getById(activityId) {
    return apiAdapter.get(`/activities/${activityId}`)
  },

  async refreshPhotos(activityId) {
    return apiAdapter.post(`/activities/${activityId}/photos`)
  },

  async getByStopId(stopId) {
    return apiAdapter.get(`/stops/${stopId}/activities`)
  },

  async getByStopIds(stopIds) {
    const results = await Promise.all(
      stopIds.map(id => apiAdapter.get(`/stops/${id}/activities`))
    )
    return results.flat()
  },

  async create(stopId, data) {
    return apiAdapter.post(`/stops/${stopId}/activities`, {
      title: data.title,
      date: data.date ?? null,
      startTime: data.startTime ?? null,
      durationMinutes: data.durationMinutes ?? null,
      lng: data.lng ?? null,
      lat: data.lat ?? null,
      address: data.address ?? '',
      notes: data.notes ?? '',
    })
  },

  async update(activityId, updates) {
    return apiAdapter.put(`/activities/${activityId}`, updates)
  },

  async delete(activityId) {
    await apiAdapter.del(`/activities/${activityId}`)
  },

  async reorder(stopId, fromIndex, toIndex) {
    // Reorder by fetching, reordering, and updating sort indexes individually
    const activities = await this.getByStopId(stopId)
    if (fromIndex < 0 || fromIndex >= activities.length || toIndex < 0 || toIndex >= activities.length) {
      return activities
    }

    const reordered = [...activities]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    // Update sort_index for each activity that changed position
    const updates = []
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sortIndex !== i) {
        updates.push(apiAdapter.put(`/activities/${reordered[i].id}`, { sortIndex: i }))
      }
    }
    await Promise.all(updates)

    return this.getByStopId(stopId)
  },

  async deleteByStopId() {
    // No-op: cascade handled by backend
  },
}
