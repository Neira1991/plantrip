const STORAGE_VERSION_KEY = 'plantrip_storage_version'
const STORAGE_VERSION = '1.0'

function initStorage(key) {
  const version = localStorage.getItem(STORAGE_VERSION_KEY)
  if (!version) {
    localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION)
    localStorage.setItem(key, JSON.stringify([]))
  }
}

export const localStorageAdapter = {
  async getAll(key) {
    initStorage(key)
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  },

  async getById(key, id) {
    const items = await this.getAll(key)
    return items.find(item => item.id === id) || null
  },

  async create(key, item) {
    const items = await this.getAll(key)
    const now = new Date().toISOString()
    const newItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    items.push(newItem)
    localStorage.setItem(key, JSON.stringify(items))
    return newItem
  },

  async update(key, id, updates) {
    const items = await this.getAll(key)
    const index = items.findIndex(item => item.id === id)
    if (index === -1) throw new Error(`Item with id ${id} not found`)

    const updated = {
      ...items[index],
      ...updates,
      id: items[index].id,
      createdAt: items[index].createdAt,
      updatedAt: new Date().toISOString(),
    }
    items[index] = updated
    localStorage.setItem(key, JSON.stringify(items))
    return updated
  },

  async delete(key, id) {
    const items = await this.getAll(key)
    const filtered = items.filter(item => item.id !== id)
    localStorage.setItem(key, JSON.stringify(filtered))
  },
}
