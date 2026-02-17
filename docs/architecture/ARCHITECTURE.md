# PlanTrip MVP - Architecture Blueprint

**Version:** 2.0
**Date:** 2026-02-17
**Team:** Database Architect, Frontend Engineer, Technical Lead

---

> **Schema v2:** The data model has been redesigned to support ordered stops, transport between cities, and activities. See [`data-schema-v2-final.md`](./data-schema-v2-final.md) for the complete schema. The original v1 schema is preserved in [`data-schema.md`](./data-schema.md) for reference.

---

## Executive Summary

PlanTrip is a client-side travel planning app built with React + Vite. This blueprint defines the complete technical architecture for Trip management with ordered itineraries (stops, movements, activities) stored in the browser, designed to scale to a full backend.

**Core Principles:**
- MVP-first: ship with localStorage, migrate to API later
- Backend-ready: repository pattern enables zero-refactor migration
- Scalable schema: Trip → TripStop → Movement/Activity (normalized, minimalist)
- Map-first UX: Mapbox map with interactive itinerary sidebar

---

## 1. Data Schema

### Entity Relationship Diagram

```
Country (1) ──< (N) City (N) ──< (N) TrainRoute (N) >── (N) City
   │                 │
  (1)               (N)
   │                 │
  (N)               (1)
 Trip ───────────> TripSegment
```

### MVP Entity: Trip

```typescript
interface Trip {
  id: string                    // UUID v4 (crypto.randomUUID())
  name: string                  // "Summer in Paris" (1-200 chars)
  countryCode: string           // FK → Country.code (e.g. "FR")
  startDate: string | null      // ISO 8601 "YYYY-MM-DD"
  endDate: string | null        // ISO 8601, must be >= startDate
  status: 'planning' | 'booked' | 'completed' | 'cancelled'
  notes: string                 // Free text, max 10,000 chars
  createdAt: string             // ISO 8601 timestamp, immutable
  updatedAt: string             // ISO 8601 timestamp, auto-updated
}
```

### Reference Entity: Country (static, no CRUD)

```typescript
interface Country {
  code: string      // ISO 3166-1 alpha-2, serves as primary key
  name: string
  colors: string[]  // Flag colors for CountryShape component
}
```

### Future Entities

| Entity | Key Fields | Relationships |
|--------|-----------|---------------|
| **City** | id, name, countryCode, lat/lng, timezone, isCapital | belongs to Country |
| **TrainRoute** | id, originCityId, destinationCityId, operator, durationMinutes, frequency | connects two Cities |
| **TripSegment** | id, tripId, originCityId, destinationCityId, trainRouteId, sequenceOrder | belongs to Trip, references TrainRoute |

Full schema definitions: [`data-schema.md`](./data-schema.md)

---

## 2. Storage Strategy

### MVP: localStorage

| Criteria | Decision |
|----------|----------|
| **Storage engine** | localStorage (sufficient for <200 trips, ~5-10MB) |
| **Key format** | `plantrip_trips`, `plantrip_storage_version` |
| **ID generation** | `crypto.randomUUID()` (browser-native UUID v4) |
| **Serialization** | JSON.stringify/parse |
| **Migration trigger** | Move to IndexedDB if >200 trips cause perf issues |

### Repository Pattern (Abstraction Layer)

```
React Components → Custom Hooks → Zustand Store → Repository → Storage Adapter
```

The repository interface is the contract. Implementations are swappable:

```javascript
// src/data/repositories/tripRepository.js
export const tripRepository = {
  getAll()           // → Promise<Trip[]>
  getById(id)        // → Promise<Trip | null>
  create(data)       // → Promise<Trip>
  update(id, data)   // → Promise<Trip>
  delete(id)         // → Promise<void>
}
```

**MVP adapter:** `localStorageAdapter` — reads/writes JSON to localStorage
**Future adapter:** `apiAdapter` — calls REST API via fetch
**Switch:** Set `VITE_USE_API=true` in environment, zero component changes

Full implementation: [`data-schema.md` §Storage Abstraction Layer](./data-schema.md)

---

## 3. State Management: Zustand

### Why Zustand

| Option | Bundle | Boilerplate | Scalability | Verdict |
|--------|--------|-------------|-------------|---------|
| Context + useReducer | 0KB | High | Poor (re-render issues) | Too much boilerplate |
| **Zustand** | **~1.2KB** | **Minimal** | **Excellent** | **Selected** |
| Redux Toolkit | ~11KB | Medium | Excellent | Overkill for MVP |

### Store Architecture

```javascript
// src/stores/tripStore.js
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { tripRepository } from '../data/repositories/tripRepository'

export const useTripStore = create(
  devtools((set) => ({
    trips: [],
    isLoading: false,
    error: null,

    loadTrips: async () => {
      set({ isLoading: true, error: null })
      const trips = await tripRepository.getAll()
      set({ trips, isLoading: false })
    },

    createTrip: async (data) => { /* ... */ },
    updateTrip: async (id, data) => { /* ... */ },
    deleteTrip: async (id) => { /* ... */ },
  }), { name: 'TripStore' })
)
```

### Custom Hooks (component API)

```javascript
// src/hooks/useTrips.js — list operations
export function useTrips() {
  const { trips, isLoading, error, loadTrips, createTrip, deleteTrip } = useTripStore()
  useEffect(() => { loadTrips() }, [])
  return { trips, isLoading, error, createTrip, deleteTrip }
}

// src/hooks/useTrip.js — single trip operations
export function useTrip(id) {
  const { getTrip, updateTrip } = useTripStore()
  // ...
}
```

Full store code: [`frontend-architecture.md` §Zustand Store](./frontend-architecture.md)

---

## 4. Folder Structure

```
src/
├── components/                    # Shared/reusable components
│   ├── common/                   # Generic UI (Button, Input, Toast)
│   ├── CountryAutocomplete/      # Existing - country search
│   ├── CountryShape/             # Existing - flag silhouette
│   ├── TripsTrigger.jsx          # 🗺️ emoji button (top-right)
│   └── TripsPanel/               # Slide-in panel + all trip UI
│       ├── TripsPanel.jsx        # Panel container (open/close)
│       ├── TripsPanel.css
│       ├── TripsList.jsx         # Trip list view
│       ├── TripCard.jsx          # Individual trip card
│       ├── TripForm.jsx          # Create/edit form
│       ├── EmptyState.jsx        # No trips yet
│       ├── DeleteConfirm.jsx     # Inline delete confirmation
│       └── Toast.jsx             # Success/error notifications
│
├── data/                          # Data layer
│   ├── adapters/                 # Storage backends
│   │   ├── localStorageAdapter.js  # MVP
│   │   └── apiAdapter.js          # Future
│   ├── repositories/             # Data access (repository pattern)
│   │   └── tripRepository.js
│   ├── schemas/                  # Validation
│   │   └── tripSchema.js
│   └── static/                   # Reference data
│       └── countries.js          # Existing country list
│
├── hooks/                         # Custom React hooks
│   ├── useTrips.js
│   └── useTrip.js
│
├── stores/                        # Zustand stores
│   └── tripStore.js
│
├── utils/                         # Helpers
│   ├── dateUtils.js
│   └── constants.js
│
├── App.jsx                        # Root (home + panel integration)
├── App.css
├── main.jsx
└── index.css
```

### Key Principles

1. **Feature-based**: Trip UI lives together in `TripsPanel/`
2. **Data separated from presentation**: `data/` is independent of `components/`
3. **Scalable**: Adding Cities later = new `data/repositories/cityRepository.js` + `stores/cityStore.js` + `hooks/useCities.js` + `components/CitiesPanel/` — no restructuring
4. **No routing needed for MVP**: Panel is a slide-in overlay, not a separate page

Full details: [`frontend-architecture.md` §Folder Structure](./frontend-architecture.md)

---

## 5. UX/UI Design

### Entry Point: 🗺️ Emoji Icon

- **Position:** Fixed top-right (`top: 24px, right: 32px`)
- **Size:** 32px desktop, 28px mobile
- **States:** 0.75 opacity default → 1.0 on hover with scale(1.1) → purple glow when panel open
- **Keyboard:** Focus-visible outline, toggles panel

### Navigation: Slide-in Side Panel

- **Width:** 420px desktop, 100vw mobile
- **Animation:** 350ms slide from right with cubic-bezier easing + overlay fade
- **Close:** X button, overlay click, Escape key, or emoji toggle
- **Background:** `#0f0f0f` with `border-left: 1px solid #222`

### Views Within Panel

**Trip List:**
- Sticky header: "← My Trips" + "+ New" button
- Trip cards: flag + country + dates + metadata
- Empty state: centered 🗺️ icon + "Create Your First Trip" CTA with purple gradient
- Default sort: newest first

**Trip Form (Create/Edit):**
- Country field (required) — reuses `CountryAutocomplete`, pre-fills from main page selection
- Trip name (optional, auto-generates as "{Country} Trip")
- Date range (optional, start/end)
- Notes (optional, textarea)
- Sticky footer: Cancel + Save (purple gradient button)
- Validation: inline error states with red border

**Delete:** Inline confirmation (not modal) — "Delete trip" expands to "Are you sure?" with Cancel/Confirm

### Country Integration

When user selects a country on the main page, then opens the panel to create a trip, the country field is pre-filled automatically.

### Accessibility

- Focus trap when panel is open
- ARIA roles: `dialog`, `aria-modal`, `aria-expanded`
- Keyboard: Tab navigation, Escape to close, arrow keys in list
- WCAG AA contrast ratios verified
- Screen reader announcements for state changes

Full specs with CSS: [`ux-ui-design.md`](./ux-ui-design.md)

---

## 6. Technical Tradeoff Analysis

### Decision 1: localStorage vs IndexedDB

| | localStorage | IndexedDB |
|---|---|---|
| **Chosen for MVP** | Yes | No |
| **Reason** | Simpler API, 5min setup, sufficient for <200 trips | Complex async API, overkill for MVP |
| **Risk** | 5-10MB limit, linear scan queries | None (not using it) |
| **Mitigation** | Repository pattern makes swap trivial when needed |

### Decision 2: Zustand vs Context+useReducer

| | Zustand | Context+useReducer |
|---|---|---|
| **Chosen** | Yes | No |
| **Reason** | Minimal boilerplate, selective re-renders, persist middleware | Re-render issues, verbose for multiple stores |
| **Risk** | External dependency (~1.2KB) | None (built-in) |
| **Mitigation** | Tiny bundle, massive DX improvement, widely adopted |

### Decision 3: Slide-in Panel vs Modal vs Full Page

| | Slide-in Panel | Modal | Full Page |
|---|---|---|---|
| **Chosen** | Yes | No | No |
| **Reason** | Non-blocking, preserves context, mobile-friendly | Blocks entire UI, feels intrusive | Loses main page context, heavy |
| **Risk** | Limited width (420px) | N/A | N/A |
| **Mitigation** | Full-width on mobile, sufficient for forms |

### Decision 4: Single countryCode vs countries Array

| | Single countryCode | countries[] Array |
|---|---|---|
| **Chosen** | Yes | No |
| **Reason** | Simpler schema, maps to relational FK, one trip = one destination country | More flexible but complex |
| **Risk** | Multi-country trips need multiple Trip records | N/A |
| **Mitigation** | Future TripSegments connect trips to multiple cities across countries |

### Decision 5: JavaScript (MVP) vs TypeScript

| | JavaScript | TypeScript |
|---|---|---|
| **Chosen for MVP** | Yes | No |
| **Reason** | Faster iteration, current codebase is JS, lower barrier | Type safety, better refactoring |
| **Mitigation** | Type definitions documented in schema; incremental TS adoption possible later via `jsconfig.json` → `tsconfig.json` |

---

## 7. Migration Strategy: Adding a Backend

### Phase 1: Current MVP (Client-Side Only)
```
Browser → Zustand Store → Repository → localStorage
```

### Phase 2: Add REST API Backend
```
Browser → Zustand Store → Repository → API Adapter → Backend Server → PostgreSQL
```

**Steps:**
1. Build backend with REST endpoints matching repository interface
2. Create `apiAdapter.js` implementing same interface as `localStorageAdapter.js`
3. Set `VITE_USE_API=true`
4. Add auth headers to API adapter
5. Optional: One-time migration script to sync localStorage data → API

**Zero frontend changes needed** — components, hooks, and stores remain identical.

### Phase 3: Cities & TrainRoutes Expansion

**Steps (per entity):**
1. Create `cityRepository.js` (same pattern as `tripRepository.js`)
2. Create `cityStore.js` (same pattern as `tripStore.js`)
3. Create `useCities.js` hook
4. Create `CitiesPanel/` components
5. Add to App.jsx

**No restructuring required** — the architecture supports linear feature addition.

### REST API Endpoints (Future)

```
Trips:
  GET    /api/trips              List (with filters)
  GET    /api/trips/:id          Get one
  POST   /api/trips              Create
  PATCH  /api/trips/:id          Update
  DELETE /api/trips/:id          Delete

Cities (future):
  GET    /api/cities             List by country
  GET    /api/cities/:id/routes  Train routes from city

Train Routes (future):
  GET    /api/routes             List
  GET    /api/routes/search      Find routes between cities
```

### Database Migration (localStorage → PostgreSQL)

```sql
-- Future PostgreSQL schema
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  country_code CHAR(2) NOT NULL REFERENCES countries(code),
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'planning',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trips_country ON trips(country_code);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_dates ON trips(country_code, start_date);
```

---

## 8. Data Flow Diagram

```
┌──────────────────────────────────────────────────────┐
│                      UI LAYER                         │
│                                                       │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │ 🗺️ Trigger│   │ TripsList │   │    TripForm      │ │
│  └────┬─────┘   └────┬─────┘   └────────┬─────────┘ │
│       │               │                  │            │
│       └───────┬───────┴──────────────────┘            │
│               │                                       │
│       ┌───────▼───────┐                              │
│       │  Custom Hooks  │  useTrips() / useTrip()     │
│       └───────┬───────┘                              │
└───────────────┼──────────────────────────────────────┘
                │
        ┌───────▼───────┐
        │ Zustand Store  │  tripStore.js
        └───────┬───────┘
                │
        ┌───────▼───────┐
        │  Repository    │  tripRepository.js
        └───────┬───────┘
                │
        ┌───────▼───────┐
        │ Storage Adapter│  localStorageAdapter.js (MVP)
        └───────┬───────┘  apiAdapter.js (future)
                │
        ┌───────▼───────┐
        │  localStorage  │  (MVP)
        │  REST API      │  (future)
        └───────────────┘
```

---

## 9. Implementation Checklist

### MVP Sprint

- [ ] Install dependencies: `zustand`, `uuid` (or use `crypto.randomUUID`)
- [ ] Create `src/data/adapters/localStorageAdapter.js`
- [ ] Create `src/data/repositories/tripRepository.js`
- [ ] Create `src/data/schemas/tripSchema.js`
- [ ] Move `countries.js` to `src/data/static/countries.js`
- [ ] Create `src/stores/tripStore.js`
- [ ] Create `src/hooks/useTrips.js` and `src/hooks/useTrip.js`
- [ ] Create `src/components/TripsTrigger.jsx` (🗺️ emoji button)
- [ ] Create `src/components/TripsPanel/TripsPanel.jsx` (slide-in panel)
- [ ] Create `src/components/TripsPanel/TripsList.jsx`
- [ ] Create `src/components/TripsPanel/TripCard.jsx`
- [ ] Create `src/components/TripsPanel/TripForm.jsx`
- [ ] Create `src/components/TripsPanel/EmptyState.jsx`
- [ ] Create `src/components/TripsPanel/DeleteConfirm.jsx`
- [ ] Create `src/components/TripsPanel/Toast.jsx`
- [ ] Integrate panel into `App.jsx`
- [ ] Wire country pre-fill from main page to trip form
- [ ] Add keyboard navigation and accessibility
- [ ] Test full CRUD flow

### Post-MVP

- [ ] Add `apiAdapter.js` for backend migration
- [ ] Add Cities feature (repository + store + hooks + UI)
- [ ] Add TrainRoutes feature
- [ ] Add TripSegments feature
- [ ] TypeScript migration (incremental)

---

## 10. Dependencies

### New (to install)

| Package | Version | Size | Purpose |
|---------|---------|------|---------|
| `zustand` | ^4.5 | ~1.2KB | State management |

### Existing

| Package | Purpose |
|---------|---------|
| `react` | UI framework |
| `react-dom` | DOM rendering |
| `vite` | Build tool |

**Note:** No `react-router-dom` needed for MVP. The panel is an overlay, not a routed page. Router can be added later when Cities/TrainRoutes sections warrant full pages.

**Note:** No `uuid` package needed. Using browser-native `crypto.randomUUID()` (supported in all modern browsers).

---

## Detailed Specifications

- **Data Schema & Storage:** [`data-schema.md`](./data-schema.md)
- **Frontend Architecture:** [`frontend-architecture.md`](./frontend-architecture.md)
- **UX/UI Design:** [`ux-ui-design.md`](./ux-ui-design.md)
