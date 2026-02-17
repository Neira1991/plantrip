# Frontend Architecture - PlanTrip MVP

## Executive Summary

This document outlines the frontend architecture for PlanTrip, a client-side trip planning application built with React + Vite. The architecture prioritizes **MVP simplicity** while ensuring **future scalability** to backend integration and additional features (Cities, TrainRoutes).

### Key Decisions
- **State Management**: Zustand (lightweight, minimal boilerplate, dev-friendly)
- **Data Layer**: Repository pattern with adapters for easy backend migration
- **Folder Structure**: Feature-based organization with clear separation of concerns
- **Code Splitting**: Route-based lazy loading for future sections

---

## 1. State Management Strategy

### Choice: Zustand

**Rationale:**
- **MVP Simplicity**: No context wrappers, no reducer boilerplate, minimal setup
- **Scalability**: Built-in middleware support (persist, devtools, immer)
- **Performance**: Selective re-renders without React Context overhead
- **Developer Experience**: Simple API, TypeScript-friendly, minimal learning curve
- **Bundle Size**: ~1.2KB vs Context+useReducer (built-in) vs Zustand vs Redux Toolkit (~11KB)

**Why not Context + useReducer?**
- Boilerplate overhead for multiple stores (Trips, Cities, TrainRoutes)
- Context re-render issues at scale
- No built-in persistence or middleware

**Why not Redux Toolkit?**
- Overkill for client-side MVP
- Larger bundle size
- More boilerplate despite RTK improvements

### Zustand Store Architecture

```javascript
// src/stores/tripStore.js
import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import { tripRepository } from '../data/repositories/tripRepository'

export const useTripStore = create(
  devtools(
    persist(
      (set, get) => ({
        // State
        trips: [],
        currentTrip: null,
        isLoading: false,
        error: null,

        // Actions
        loadTrips: async () => {
          set({ isLoading: true, error: null })
          try {
            const trips = await tripRepository.getAll()
            set({ trips, isLoading: false })
          } catch (error) {
            set({ error: error.message, isLoading: false })
          }
        },

        getTrip: async (id) => {
          set({ isLoading: true, error: null })
          try {
            const trip = await tripRepository.getById(id)
            set({ currentTrip: trip, isLoading: false })
            return trip
          } catch (error) {
            set({ error: error.message, isLoading: false })
            throw error
          }
        },

        createTrip: async (tripData) => {
          set({ isLoading: true, error: null })
          try {
            const newTrip = await tripRepository.create(tripData)
            set((state) => ({
              trips: [...state.trips, newTrip],
              currentTrip: newTrip,
              isLoading: false
            }))
            return newTrip
          } catch (error) {
            set({ error: error.message, isLoading: false })
            throw error
          }
        },

        updateTrip: async (id, updates) => {
          set({ isLoading: true, error: null })
          try {
            const updated = await tripRepository.update(id, updates)
            set((state) => ({
              trips: state.trips.map(t => t.id === id ? updated : t),
              currentTrip: state.currentTrip?.id === id ? updated : state.currentTrip,
              isLoading: false
            }))
            return updated
          } catch (error) {
            set({ error: error.message, isLoading: false })
            throw error
          }
        },

        deleteTrip: async (id) => {
          set({ isLoading: true, error: null })
          try {
            await tripRepository.delete(id)
            set((state) => ({
              trips: state.trips.filter(t => t.id !== id),
              currentTrip: state.currentTrip?.id === id ? null : state.currentTrip,
              isLoading: false
            }))
          } catch (error) {
            set({ error: error.message, isLoading: false })
            throw error
          }
        },

        clearError: () => set({ error: null })
      }),
      {
        name: 'trip-storage',
        partialize: (state) => ({ trips: state.trips }) // Only persist trips
      }
    ),
    { name: 'TripStore' }
  )
)
```

**Future stores** follow the same pattern:
- `src/stores/cityStore.js` - Cities within countries
- `src/stores/trainRouteStore.js` - Train routes between cities
- `src/stores/uiStore.js` - UI state (theme, modals, etc.)

---

## 2. Folder Structure

### Proposed Structure

```
src/
├── assets/                    # Static assets (images, fonts)
│   └── icons/
│
├── components/                # Shared/reusable components
│   ├── common/               # Generic UI components
│   │   ├── Button/
│   │   │   ├── Button.jsx
│   │   │   ├── Button.css
│   │   │   └── index.js
│   │   ├── Card/
│   │   ├── Input/
│   │   └── Modal/
│   │
│   ├── CountryAutocomplete/  # Domain-specific reusable components
│   │   ├── CountryAutocomplete.jsx
│   │   ├── CountryAutocomplete.css
│   │   └── index.js
│   │
│   └── CountryShape/
│       ├── CountryShape.jsx
│       ├── CountryShape.css
│       └── index.js
│
├── data/                      # Data layer (repositories, adapters, static data)
│   ├── adapters/             # Storage adapters for backend migration
│   │   ├── localStorageAdapter.js
│   │   ├── indexedDBAdapter.js
│   │   └── apiAdapter.js     # Future backend adapter
│   │
│   ├── repositories/         # Data access layer (repository pattern)
│   │   ├── tripRepository.js
│   │   ├── cityRepository.js  # Future
│   │   └── trainRouteRepository.js  # Future
│   │
│   ├── schemas/              # Data validation schemas
│   │   ├── tripSchema.js
│   │   └── validators.js
│   │
│   └── static/               # Static reference data
│       └── countries.js
│
├── hooks/                     # Custom React hooks
│   ├── useTrips.js           # Trip CRUD operations
│   ├── useTrip.js            # Single trip operations
│   ├── useCities.js          # Future
│   ├── useTrainRoutes.js     # Future
│   └── useDebounce.js        # Utility hooks
│
├── stores/                    # Zustand stores
│   ├── tripStore.js
│   ├── cityStore.js          # Future
│   ├── trainRouteStore.js    # Future
│   └── uiStore.js
│
├── types/                     # TypeScript types (if migrating to TS)
│   ├── trip.ts
│   ├── city.ts
│   └── trainRoute.ts
│
├── utils/                     # Utility functions
│   ├── dateUtils.js
│   ├── formatters.js
│   ├── validators.js
│   └── constants.js
│
├── views/                     # Page-level components (routes)
│   ├── Home/
│   │   ├── Home.jsx
│   │   ├── Home.css
│   │   └── index.js
│   │
│   ├── Trips/
│   │   ├── TripList/
│   │   │   ├── TripList.jsx
│   │   │   ├── TripList.css
│   │   │   ├── components/  # View-specific components
│   │   │   │   ├── TripCard.jsx
│   │   │   │   └── TripFilters.jsx
│   │   │   └── index.js
│   │   │
│   │   ├── TripDetail/
│   │   │   ├── TripDetail.jsx
│   │   │   ├── TripDetail.css
│   │   │   ├── components/
│   │   │   │   ├── TripHeader.jsx
│   │   │   │   ├── CountrySection.jsx
│   │   │   │   └── TripTimeline.jsx
│   │   │   └── index.js
│   │   │
│   │   └── TripForm/
│   │       ├── TripForm.jsx
│   │       ├── TripForm.css
│   │       └── index.js
│   │
│   ├── Cities/               # Future: Cities management
│   │   └── (similar structure)
│   │
│   └── TrainRoutes/          # Future: Train routes
│       └── (similar structure)
│
├── App.jsx                    # Root component
├── App.css
├── main.jsx                   # Entry point
└── index.css                  # Global styles
```

### Folder Structure Principles

1. **Feature-Based Organization**: Views are organized by feature (Trips, Cities, TrainRoutes)
2. **Colocation**: Components, styles, and related files live together
3. **Clear Boundaries**: Data layer (`data/`) separated from presentation (`components/`, `views/`)
4. **Scalability**: Easy to add new features without restructuring
5. **Index Files**: Simplify imports (`import { Button } from '@/components/common/Button'`)

---

## 3. CRUD Implementation Patterns

### Pattern: Custom Hooks + Zustand Store + Repository

```javascript
// src/hooks/useTrips.js
import { useTripStore } from '../stores/tripStore'
import { useEffect } from 'react'

export function useTrips() {
  const { trips, isLoading, error, loadTrips, createTrip, deleteTrip, clearError } = useTripStore()

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  return {
    trips,
    isLoading,
    error,
    createTrip,
    deleteTrip,
    clearError
  }
}

// src/hooks/useTrip.js
export function useTrip(id) {
  const { currentTrip, isLoading, error, getTrip, updateTrip, clearError } = useTripStore()

  useEffect(() => {
    if (id) {
      getTrip(id)
    }
  }, [id, getTrip])

  return {
    trip: currentTrip,
    isLoading,
    error,
    updateTrip,
    clearError
  }
}
```

### Usage in Components

```javascript
// src/views/Trips/TripList/TripList.jsx
import { useTrips } from '../../../hooks/useTrips'
import TripCard from './components/TripCard'

export default function TripList() {
  const { trips, isLoading, error, deleteTrip } = useTrips()

  if (isLoading) return <div>Loading trips...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="trip-list">
      {trips.map(trip => (
        <TripCard key={trip.id} trip={trip} onDelete={deleteTrip} />
      ))}
    </div>
  )
}

// src/views/Trips/TripDetail/TripDetail.jsx
import { useTrip } from '../../../hooks/useTrip'
import { useParams } from 'react-router-dom'

export default function TripDetail() {
  const { id } = useParams()
  const { trip, isLoading, updateTrip } = useTrip(id)

  const handleAddCountry = async (country) => {
    await updateTrip(id, {
      countries: [...trip.countries, country]
    })
  }

  if (isLoading) return <div>Loading trip...</div>

  return (
    <div className="trip-detail">
      <h1>{trip.name}</h1>
      {/* ... */}
    </div>
  )
}
```

---

## 4. Data Layer: Repository Pattern

### Storage Abstraction for Backend Migration

```javascript
// src/data/adapters/localStorageAdapter.js
export const localStorageAdapter = {
  async getAll(key) {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  },

  async getById(key, id) {
    const items = await this.getAll(key)
    return items.find(item => item.id === id)
  },

  async create(key, item) {
    const items = await this.getAll(key)
    const newItem = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    items.push(newItem)
    localStorage.setItem(key, JSON.stringify(items))
    return newItem
  },

  async update(key, id, updates) {
    const items = await this.getAll(key)
    const index = items.findIndex(item => item.id === id)
    if (index === -1) throw new Error(`Item with id ${id} not found`)

    const updated = { ...items[index], ...updates, updatedAt: new Date().toISOString() }
    items[index] = updated
    localStorage.setItem(key, JSON.stringify(items))
    return updated
  },

  async delete(key, id) {
    const items = await this.getAll(key)
    const filtered = items.filter(item => item.id !== id)
    localStorage.setItem(key, JSON.stringify(filtered))
  }
}

// src/data/adapters/apiAdapter.js (Future)
export const apiAdapter = {
  async getAll(endpoint) {
    const response = await fetch(`/api/${endpoint}`)
    if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`)
    return response.json()
  },

  async getById(endpoint, id) {
    const response = await fetch(`/api/${endpoint}/${id}`)
    if (!response.ok) throw new Error(`Failed to fetch ${endpoint}/${id}`)
    return response.json()
  },

  async create(endpoint, data) {
    const response = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(`Failed to create ${endpoint}`)
    return response.json()
  },

  async update(endpoint, id, data) {
    const response = await fetch(`/api/${endpoint}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error(`Failed to update ${endpoint}/${id}`)
    return response.json()
  },

  async delete(endpoint, id) {
    const response = await fetch(`/api/${endpoint}/${id}`, { method: 'DELETE' })
    if (!response.ok) throw new Error(`Failed to delete ${endpoint}/${id}`)
  }
}

// src/data/adapters/index.js
import { localStorageAdapter } from './localStorageAdapter'
import { apiAdapter } from './apiAdapter'

// Environment-based adapter selection
const USE_API = import.meta.env.VITE_USE_API === 'true'

export const storageAdapter = USE_API ? apiAdapter : localStorageAdapter
```

### Repository Layer

```javascript
// src/data/repositories/tripRepository.js
import { storageAdapter } from '../adapters'
import { validateTrip } from '../schemas/tripSchema'

const STORAGE_KEY = 'trips'
const API_ENDPOINT = 'trips'

export const tripRepository = {
  async getAll() {
    // localStorage uses key, API uses endpoint
    const key = storageAdapter === localStorageAdapter ? STORAGE_KEY : API_ENDPOINT
    return storageAdapter.getAll(key)
  },

  async getById(id) {
    const key = storageAdapter === localStorageAdapter ? STORAGE_KEY : API_ENDPOINT
    return storageAdapter.getById(key, id)
  },

  async create(tripData) {
    validateTrip(tripData) // Validate before persisting
    const key = storageAdapter === localStorageAdapter ? STORAGE_KEY : API_ENDPOINT
    return storageAdapter.create(key, tripData)
  },

  async update(id, updates) {
    const key = storageAdapter === localStorageAdapter ? STORAGE_KEY : API_ENDPOINT
    return storageAdapter.update(key, id, updates)
  },

  async delete(id) {
    const key = storageAdapter === localStorageAdapter ? STORAGE_KEY : API_ENDPOINT
    return storageAdapter.delete(key, id)
  }
}

// Future: src/data/repositories/cityRepository.js
// Future: src/data/repositories/trainRouteRepository.js
```

### Backend Migration Strategy

**To migrate from localStorage to backend:**

1. Set environment variable: `VITE_USE_API=true`
2. Implement backend API matching the adapter interface
3. No changes needed to stores, hooks, or components
4. Optional: Add migration script to sync localStorage → API

---

## 5. Code Splitting & Lazy Loading

### Route-Based Code Splitting

```javascript
// src/App.jsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Eager-load critical routes
import Home from './views/Home'

// Lazy-load feature routes
const TripList = lazy(() => import('./views/Trips/TripList'))
const TripDetail = lazy(() => import('./views/Trips/TripDetail'))
const TripForm = lazy(() => import('./views/Trips/TripForm'))

// Future lazy routes
const CityList = lazy(() => import('./views/Cities/CityList'))
const TrainRoutes = lazy(() => import('./views/TrainRoutes/TrainRouteList'))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="loading-screen">Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />

          {/* Trips Section */}
          <Route path="/trips" element={<TripList />} />
          <Route path="/trips/new" element={<TripForm />} />
          <Route path="/trips/:id" element={<TripDetail />} />
          <Route path="/trips/:id/edit" element={<TripForm />} />

          {/* Future: Cities Section */}
          <Route path="/trips/:tripId/cities" element={<CityList />} />

          {/* Future: Train Routes Section */}
          <Route path="/trips/:tripId/train-routes" element={<TrainRoutes />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
```

### Component-Level Code Splitting (Optional)

```javascript
// For heavy components (e.g., map visualizations)
const MapVisualization = lazy(() => import('./components/MapVisualization'))

<Suspense fallback={<MapPlaceholder />}>
  <MapVisualization trip={trip} />
</Suspense>
```

---

## 6. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         VIEW LAYER                              │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐      │
│  │   TripList     │  │  TripDetail  │  │   TripForm     │      │
│  └────────┬───────┘  └──────┬───────┘  └───────┬────────┘      │
│           │                 │                   │               │
│           └─────────────────┼───────────────────┘               │
│                             │                                   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   CUSTOM HOOKS     │
                    │   useTrips()       │
                    │   useTrip(id)      │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   ZUSTAND STORE    │
                    │   tripStore.js     │
                    │ ┌────────────────┐ │
                    │ │ State: trips   │ │
                    │ │ Actions: CRUD  │ │
                    │ └────────┬───────┘ │
                    └──────────┼─────────┘
                               │
                    ┌──────────▼──────────┐
                    │   REPOSITORY        │
                    │   tripRepository.js │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
        ┌───────▼──────┐  ┌───▼────────┐  ┌──▼─────────┐
        │ localStorage │  │ IndexedDB  │  │ API (Future)│
        │   Adapter    │  │  Adapter   │  │  Adapter    │
        └──────────────┘  └────────────┘  └────────────┘
```

---

## 7. Type Definitions (Future TypeScript Migration)

```typescript
// src/types/trip.ts
export interface Trip {
  id: string
  name: string
  description?: string
  startDate?: string
  endDate?: string
  countries: Country[]
  cities?: City[]  // Future
  trainRoutes?: TrainRoute[]  // Future
  createdAt: string
  updatedAt?: string
}

export interface Country {
  code: string
  name: string
  colors: string[]
  visitedCities?: City[]  // Future
  daysPlanned?: number
}

// src/types/city.ts (Future)
export interface City {
  id: string
  name: string
  countryCode: string
  tripId: string
  coordinates?: { lat: number; lng: number }
  daysPlanned?: number
}

// src/types/trainRoute.ts (Future)
export interface TrainRoute {
  id: string
  tripId: string
  fromCityId: string
  toCityId: string
  departureTime?: string
  arrivalTime?: string
  operator?: string
  price?: number
  bookingUrl?: string
}
```

---

## 8. Migration Plan: Adding Cities & TrainRoutes

### Step 1: Add City Store & Repository
```javascript
// 1. Create src/stores/cityStore.js (same pattern as tripStore)
// 2. Create src/data/repositories/cityRepository.js
// 3. Create src/hooks/useCities.js and src/hooks/useCity.js
```

### Step 2: Create City Views
```javascript
// 1. Create src/views/Cities/CityList/
// 2. Create src/views/Cities/CityForm/
// 3. Add routes to App.jsx (already lazy-loaded)
```

### Step 3: Integrate Cities into Trips
```javascript
// Update TripDetail to show cities
// Update tripStore to support nested city operations
```

### Step 4: Repeat for TrainRoutes
```javascript
// Same pattern: store → repository → hooks → views
```

**Key Point**: No restructuring needed. The folder structure and patterns support linear feature addition.

---

## 9. Performance Optimization Strategies

### Current (MVP)
- Route-based code splitting
- Zustand selective re-renders
- Debounced search in CountryAutocomplete

### Future Optimizations
- **Virtualization**: For long lists of trips/cities (react-window)
- **Memoization**: useMemo for expensive computations, React.memo for components
- **IndexedDB**: Migrate from localStorage for larger datasets
- **Service Worker**: Offline support and caching
- **Optimistic Updates**: Immediate UI updates before API confirmation

---

## 10. Testing Strategy

### Unit Tests
- **Repositories**: Test CRUD operations with mock adapters
- **Stores**: Test state mutations and actions
- **Hooks**: Test with @testing-library/react-hooks
- **Utils**: Pure function testing

### Integration Tests
- **Views**: Test component + hooks + store interactions
- **User Flows**: Trip creation → Add countries → Edit → Delete

### E2E Tests (Future)
- Playwright/Cypress for critical user journeys

---

## 11. Developer Experience

### Tooling Recommendations
```json
// package.json additions
{
  "dependencies": {
    "zustand": "^4.5.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@testing-library/react": "^14.2.0",
    "@testing-library/react-hooks": "^8.0.1",
    "vitest": "^1.2.0"
  }
}
```

### Path Aliases (vite.config.js)
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@views': path.resolve(__dirname, './src/views'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@data': path.resolve(__dirname, './src/data'),
      '@utils': path.resolve(__dirname, './src/utils')
    }
  }
})
```

### Import Examples
```javascript
// Before
import { useTrips } from '../../../hooks/useTrips'

// After
import { useTrips } from '@hooks/useTrips'
```

---

## 12. Summary & Trade-offs

### Wins
✅ **Simple MVP implementation** - Zustand requires minimal setup
✅ **Backend-ready** - Repository pattern enables zero-refactor migration
✅ **Scalable structure** - Linear feature addition (Cities, TrainRoutes)
✅ **Performance-optimized** - Code splitting, selective re-renders
✅ **Developer-friendly** - Clean patterns, clear boundaries

### Trade-offs
⚖️ **Zustand vs Context** - Adds dependency but saves boilerplate long-term
⚖️ **Repository pattern** - Slight abstraction overhead for MVP (worth it for migration)
⚖️ **Folder structure depth** - More folders but clearer organization at scale

### Future Considerations
- **TypeScript migration** - Types defined, incremental adoption possible
- **State persistence** - Zustand persist middleware handles localStorage/IndexedDB
- **Optimistic updates** - Easily added to store actions
- **Real-time sync** - Zustand subscriptions support WebSocket integration

---

## Appendix: Example File Implementations

### A. Complete Trip Store
```javascript
// src/stores/tripStore.js
import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import { tripRepository } from '../data/repositories/tripRepository'

export const useTripStore = create(
  devtools(
    persist(
      (set, get) => ({
        trips: [],
        currentTrip: null,
        isLoading: false,
        error: null,

        loadTrips: async () => {
          set({ isLoading: true, error: null })
          try {
            const trips = await tripRepository.getAll()
            set({ trips, isLoading: false })
          } catch (error) {
            set({ error: error.message, isLoading: false })
          }
        },

        getTrip: async (id) => {
          set({ isLoading: true, error: null })
          try {
            const trip = await tripRepository.getById(id)
            set({ currentTrip: trip, isLoading: false })
            return trip
          } catch (error) {
            set({ error: error.message, isLoading: false })
            throw error
          }
        },

        createTrip: async (tripData) => {
          set({ isLoading: true, error: null })
          try {
            const newTrip = await tripRepository.create(tripData)
            set((state) => ({
              trips: [...state.trips, newTrip],
              currentTrip: newTrip,
              isLoading: false
            }))
            return newTrip
          } catch (error) {
            set({ error: error.message, isLoading: false })
            throw error
          }
        },

        updateTrip: async (id, updates) => {
          set({ isLoading: true, error: null })
          try {
            const updated = await tripRepository.update(id, updates)
            set((state) => ({
              trips: state.trips.map(t => t.id === id ? updated : t),
              currentTrip: state.currentTrip?.id === id ? updated : state.currentTrip,
              isLoading: false
            }))
            return updated
          } catch (error) {
            set({ error: error.message, isLoading: false })
            throw error
          }
        },

        deleteTrip: async (id) => {
          set({ isLoading: true, error: null })
          try {
            await tripRepository.delete(id)
            set((state) => ({
              trips: state.trips.filter(t => t.id !== id),
              currentTrip: state.currentTrip?.id === id ? null : state.currentTrip,
              isLoading: false
            }))
          } catch (error) {
            set({ error: error.message, isLoading: false })
            throw error
          }
        },

        addCountryToTrip: async (tripId, country) => {
          const trip = get().trips.find(t => t.id === tripId)
          if (!trip) throw new Error('Trip not found')

          const updatedCountries = [...(trip.countries || []), country]
          return get().updateTrip(tripId, { countries: updatedCountries })
        },

        removeCountryFromTrip: async (tripId, countryCode) => {
          const trip = get().trips.find(t => t.id === tripId)
          if (!trip) throw new Error('Trip not found')

          const updatedCountries = trip.countries.filter(c => c.code !== countryCode)
          return get().updateTrip(tripId, { countries: updatedCountries })
        },

        clearError: () => set({ error: null })
      }),
      {
        name: 'trip-storage',
        partialize: (state) => ({ trips: state.trips })
      }
    ),
    { name: 'TripStore' }
  )
)
```

### B. Complete Trip Repository
```javascript
// src/data/repositories/tripRepository.js
import { storageAdapter } from '../adapters'
import { validateTrip } from '../schemas/tripSchema'

const STORAGE_KEY = 'trips'
const API_ENDPOINT = 'trips'

const getKey = () => {
  return storageAdapter.name === 'localStorage' ? STORAGE_KEY : API_ENDPOINT
}

export const tripRepository = {
  async getAll() {
    return storageAdapter.getAll(getKey())
  },

  async getById(id) {
    return storageAdapter.getById(getKey(), id)
  },

  async create(tripData) {
    const validation = validateTrip(tripData)
    if (!validation.valid) {
      throw new Error(`Invalid trip data: ${validation.errors.join(', ')}`)
    }
    return storageAdapter.create(getKey(), tripData)
  },

  async update(id, updates) {
    return storageAdapter.update(getKey(), id, updates)
  },

  async delete(id) {
    return storageAdapter.delete(getKey(), id)
  },

  async search(query) {
    const trips = await this.getAll()
    const lowerQuery = query.toLowerCase()
    return trips.filter(trip =>
      trip.name.toLowerCase().includes(lowerQuery) ||
      trip.description?.toLowerCase().includes(lowerQuery) ||
      trip.countries.some(c => c.name.toLowerCase().includes(lowerQuery))
    )
  }
}
```

### C. Trip Schema Validator
```javascript
// src/data/schemas/tripSchema.js
export function validateTrip(trip) {
  const errors = []

  if (!trip.name || typeof trip.name !== 'string' || trip.name.trim().length === 0) {
    errors.push('Trip name is required')
  }

  if (trip.name && trip.name.length > 100) {
    errors.push('Trip name must be less than 100 characters')
  }

  if (trip.startDate && trip.endDate) {
    const start = new Date(trip.startDate)
    const end = new Date(trip.endDate)
    if (start > end) {
      errors.push('Start date must be before end date')
    }
  }

  if (trip.countries && !Array.isArray(trip.countries)) {
    errors.push('Countries must be an array')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
```

---

**Document Version**: 1.0
**Last Updated**: 2026-02-17
**Author**: Frontend Engineer
**Status**: Ready for Implementation
