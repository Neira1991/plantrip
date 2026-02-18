const BASE_URL = import.meta.env.VITE_API_URL || '/api'

let isRefreshing = false
let refreshPromise = null

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const config = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  }

  const response = await fetch(url, config)

  if (response.status === 204) {
    return null
  }

  // On 401, try to refresh the token once (skip for auth endpoints)
  const isAuthEndpoint = path.startsWith('/auth/')
  if (response.status === 401 && !options._isRetry && !isAuthEndpoint) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      return request(path, { ...options, _isRetry: true })
    }
    // Refresh failed — redirect to login
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
      window.location.href = '/login'
    }
    throw new Error('Not authenticated')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${response.status}`)
  }

  return response.json()
}

async function tryRefresh() {
  if (isRefreshing) return refreshPromise

  isRefreshing = true
  refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(res => res.ok)
    .catch(() => false)
    .finally(() => { isRefreshing = false })

  return refreshPromise
}

// Convert snake_case keys from API to camelCase for frontend
function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

// Convert camelCase keys from frontend to snake_case for API
function toSnake(str) {
  return str.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)
}

export function camelizeKeys(obj) {
  if (Array.isArray(obj)) return obj.map(camelizeKeys)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toCamel(k), camelizeKeys(v)])
    )
  }
  return obj
}

export function snakifyKeys(obj) {
  if (Array.isArray(obj)) return obj.map(snakifyKeys)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toSnake(k), snakifyKeys(v)])
    )
  }
  return obj
}

export const apiAdapter = {
  async get(path) {
    const data = await request(path)
    return camelizeKeys(data)
  },

  async post(path, body) {
    const data = await request(path, {
      method: 'POST',
      body: JSON.stringify(snakifyKeys(body)),
    })
    return camelizeKeys(data)
  },

  async put(path, body) {
    const data = await request(path, {
      method: 'PUT',
      body: JSON.stringify(snakifyKeys(body)),
    })
    return camelizeKeys(data)
  },

  async del(path) {
    await request(path, { method: 'DELETE' })
  },

  // Auth methods
  async register(email, password) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    return camelizeKeys(data)
  },

  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    return camelizeKeys(data)
  },

  async logout() {
    await request('/auth/logout', { method: 'POST' })
  },

  async getMe() {
    const data = await request('/auth/me', { _isRetry: false })
    return camelizeKeys(data)
  },
}
