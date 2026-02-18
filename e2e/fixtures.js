import { test as base, expect } from '@playwright/test'

const API_URL = 'http://localhost:3000/api'
const TEST_SECRET = 'plantrip-test-secret'

/**
 * API helper for direct backend calls during test setup/teardown.
 */
class ApiHelper {
  constructor() {
    this.baseUrl = API_URL
    this.accessToken = null
    this.refreshToken = null
  }

  async request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (this.accessToken) {
      opts.headers['Cookie'] = `access_token=${this.accessToken}`
    }
    // Test endpoints require the shared secret header
    if (path.startsWith('/test/')) {
      opts.headers['X-Test-Secret'] = TEST_SECRET
    }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${this.baseUrl}${path}`, opts)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`)
    }
    if (res.status === 204) return null
    return res.json()
  }

  // ── Auth ──
  async createTestUser() {
    const data = await this.request('POST', '/test/create-test-user')
    this.accessToken = data.access_token
    this.refreshToken = data.refresh_token
    return data
  }

  async setupAuth(page) {
    const user = await this.createTestUser()
    await page.context().addCookies([
      {
        name: 'access_token',
        value: user.access_token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
      {
        name: 'refresh_token',
        value: user.refresh_token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    return user
  }

  // ── Reset ──
  async reset() {
    // Reset doesn't require auth (test endpoint)
    const savedToken = this.accessToken
    this.accessToken = null
    await this.request('POST', '/test/reset')
    this.accessToken = savedToken
  }

  // ── Trips ──
  async createTrip(data) {
    return this.request('POST', '/trips', {
      name: data.name || 'Test Trip',
      country_code: data.countryCode || data.country_code || 'FR',
      start_date: data.startDate || data.start_date || '2026-06-01',
      status: data.status || 'planning',
      notes: data.notes || '',
    })
  }

  async getTrips() {
    return this.request('GET', '/trips')
  }

  async getTrip(id) {
    return this.request('GET', `/trips/${id}`)
  }

  async deleteTrip(id) {
    return this.request('DELETE', `/trips/${id}`)
  }

  // ── Stops ──
  async createStop(tripId, data) {
    return this.request('POST', `/trips/${tripId}/stops`, {
      name: data.name || 'Test City',
      lng: data.lng || 2.3522,
      lat: data.lat || 48.8566,
      nights: data.nights || 1,
    })
  }

  async updateStop(stopId, data) {
    return this.request('PUT', `/stops/${stopId}`, data)
  }

  async getStops(tripId) {
    return this.request('GET', `/trips/${tripId}/stops`)
  }

  async deleteStop(stopId) {
    return this.request('DELETE', `/stops/${stopId}`)
  }

  // ── Activities ──
  async createActivity(stopId, data) {
    return this.request('POST', `/stops/${stopId}/activities`, {
      title: data.title || 'Test Activity',
      lng: data.lng ?? null,
      lat: data.lat ?? null,
      address: data.address ?? '',
    })
  }

  async getActivities(stopId) {
    return this.request('GET', `/stops/${stopId}/activities`)
  }

  async deleteActivity(activityId) {
    return this.request('DELETE', `/activities/${activityId}`)
  }

  // ── Movements ──
  async createMovement(tripId, data) {
    return this.request('POST', `/trips/${tripId}/movements`, {
      from_stop_id: data.fromStopId || data.from_stop_id,
      to_stop_id: data.toStopId || data.to_stop_id,
      type: data.type || 'train',
      carrier: data.carrier || '',
      duration_minutes: data.durationMinutes || data.duration_minutes || null,
    })
  }

  async getMovements(tripId) {
    return this.request('GET', `/trips/${tripId}/movements`)
  }

  async deleteMovement(movementId) {
    return this.request('DELETE', `/movements/${movementId}`)
  }
}

/**
 * Extended test fixture with API helper and Mapbox mock.
 */
export const test = base.extend({
  api: async ({}, use) => {
    const api = new ApiHelper()
    await use(api)
  },

  /** Intercept Mapbox Geocoding API with mock responses */
  mockMapbox: async ({ page }, use) => {
    const mockCities = {
      default: {
        type: 'FeatureCollection',
        features: [
          {
            id: 'place.1',
            type: 'Feature',
            text: 'Paris',
            place_name: 'Paris, France',
            center: [2.3522, 48.8566],
            geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
          },
          {
            id: 'place.2',
            type: 'Feature',
            text: 'Lyon',
            place_name: 'Lyon, France',
            center: [4.8357, 45.7640],
            geometry: { type: 'Point', coordinates: [4.8357, 45.7640] },
          },
          {
            id: 'place.3',
            type: 'Feature',
            text: 'Marseille',
            place_name: 'Marseille, France',
            center: [5.3698, 43.2965],
            geometry: { type: 'Point', coordinates: [5.3698, 43.2965] },
          },
        ],
      },
    }

    await page.route('**/api.mapbox.com/geocoding/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCities.default),
      })
    })

    await use(mockCities)
  },

})

export { expect }
