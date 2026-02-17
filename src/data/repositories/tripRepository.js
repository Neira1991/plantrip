import { localStorageAdapter } from '../adapters/localStorageAdapter'
import { validateTrip } from '../schemas/tripSchema'
import { countries } from '../static/countries'

const STORAGE_KEY = 'plantrip_trips'

export const tripRepository = {
  async getAll() {
    const trips = await localStorageAdapter.getAll(STORAGE_KEY)
    return trips.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  },

  async getById(id) {
    return localStorageAdapter.getById(STORAGE_KEY, id)
  },

  async findByCountry(countryCode) {
    const trips = await localStorageAdapter.getAll(STORAGE_KEY)
    return trips.find(t => t.countryCode === countryCode) || null
  },

  async create(data) {
    const existing = await this.findByCountry(data.countryCode)
    if (existing) {
      throw new Error('A trip for this country already exists')
    }

    const country = countries.find(c => c.code === data.countryCode)
    const tripData = {
      name: data.name || `${country?.name || ''} Trip`,
      countryCode: data.countryCode,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      status: data.status || 'planning',
      notes: data.notes || '',
      cities: data.cities || [],
    }

    const validation = validateTrip(tripData)
    if (!validation.valid) {
      throw new Error(validation.errors[0])
    }

    return localStorageAdapter.create(STORAGE_KEY, tripData)
  },

  async update(id, updates) {
    return localStorageAdapter.update(STORAGE_KEY, id, updates)
  },

  async delete(id) {
    return localStorageAdapter.delete(STORAGE_KEY, id)
  },
}
