import { apiAdapter } from '../adapters/apiAdapter'
import { validateTrip } from '../schemas/tripSchema'
import { countries } from '../static/countries'

export const tripRepository = {
  async getAll() {
    return apiAdapter.get('/trips')
  },

  async getById(id) {
    return apiAdapter.get(`/trips/${id}`)
  },

  async findByCountry(countryCode) {
    const trips = await apiAdapter.get('/trips')
    return trips.find(t => t.countryCode === countryCode) || null
  },

  async create(data) {
    const country = countries.find(c => c.code === data.countryCode)
    const tripData = {
      name: data.name || `${country?.name || ''} Trip`,
      countryCode: data.countryCode,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      status: data.status || 'planning',
      notes: data.notes || '',
    }

    const validation = validateTrip(tripData)
    if (!validation.valid) {
      throw new Error(validation.errors[0])
    }

    return apiAdapter.post('/trips', tripData)
  },

  async update(id, updates) {
    return apiAdapter.put(`/trips/${id}`, updates)
  },

  async delete(id) {
    await apiAdapter.del(`/trips/${id}`)
  },
}
