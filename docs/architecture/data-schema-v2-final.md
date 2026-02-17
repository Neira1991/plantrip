# PlanTrip Data Schema v2 — Final Blueprint

**Version:** 2.0 (Final)
**Date:** 2026-02-17
**Authors:** Database Architect, Frontend Engineer, Technical Lead
**Status:** Approved

---

## Summary

This is the unified, approved architecture for extending PlanTrip's data model. It replaces the embedded `cities[]` array on Trip with three normalized entities that support ordered itineraries, transport between cities, and activities at each stop.

**What changes:**
- Trip no longer has a `cities` array
- Three new entities: **TripStop**, **Movement**, **Activity**
- Three new localStorage keys, repositories, and a new Zustand store
- MapboxMap evolves to show numbered markers + route lines

**What stays the same:**
- Trip entity (minus `cities`)
- Repository pattern + localStorage adapter
- Existing tripStore / useTrips hook
- Country as static reference data

---

## Entity Relationship Diagram

```
Trip (1) ──< (N) TripStop (ordered by sortIndex)
                    │
                    ├──< (N) Activity (ordered by sortIndex)
                    │
                    ├── (1) ──< Movement.fromStopId
                    └── (1) ──< Movement.toStopId

Movement connects two consecutive TripStops within the same Trip.
Each stop can have 0..N activities.
Each pair of consecutive stops can have 0..1 movements.
```

---

## Entities

### Trip (modified)

Remove the `cities` array. Everything else unchanged.

```javascript
{
  id: string,              // UUID v4
  name: string,            // 1-200 chars
  countryCode: string,     // FK → Country.code
  startDate: string | null,
  endDate: string | null,
  status: 'planning' | 'booked' | 'completed' | 'cancelled',
  notes: string,
  createdAt: string,       // ISO 8601
  updatedAt: string,
  // REMOVED: cities: []
}
```

---

### TripStop (new)

A city the user plans to visit, ordered within the trip's itinerary.

```javascript
{
  id: string,              // UUID v4
  tripId: string,          // FK → Trip.id
  sortIndex: number,       // 0, 1, 2, ... (order within trip)
  name: string,            // City name from Mapbox Geocoding
  lng: number,             // Longitude
  lat: number,             // Latitude
  notes: string,           // Default ""
  createdAt: string,
  updatedAt: string,
}
```

**Design decisions:**
- City data (name, lng, lat) stored inline — no separate City table. Cities come from Mapbox Geocoding and are trip-specific. A global city catalog adds joins for zero benefit now.
- `sortIndex` is a contiguous integer. See [Ordering Strategy](#ordering-strategy).

**Validation:**
- `tripId`: required, must reference existing Trip
- `sortIndex`: required, integer >= 0, unique per trip `(tripId, sortIndex)`
- `name`: required, 1-200 chars
- `lng`: -180 to 180
- `lat`: -90 to 90

---

### Movement (new)

Transport between two consecutive stops. "How do I get from stop A to stop B?"

```javascript
{
  id: string,              // UUID v4
  tripId: string,          // FK → Trip.id (denormalized)
  fromStopId: string,      // FK → TripStop.id
  toStopId: string,        // FK → TripStop.id
  type: string,            // 'train' | 'car' | 'plane' | 'bus' | 'ferry' | 'other'
  durationMinutes: number | null,
  departureTime: string | null,   // ISO 8601 datetime
  arrivalTime: string | null,     // ISO 8601 datetime
  carrier: string,         // e.g. "SNCF", "" if unknown
  bookingRef: string,      // "" if none
  notes: string,           // Default ""
  createdAt: string,
  updatedAt: string,
}
```

**Design decisions:**
- `tripId` is denormalized (derivable from fromStopId → TripStop.tripId). Included because localStorage filtering by tripId is constant.
- One movement per pair of consecutive stops. Edit, don't duplicate.
- Movements are optional. Stops can exist without transport planned.

**Validation:**
- `fromStopId` !== `toStopId`
- `type`: required, one of enum values
- `durationMinutes`: null or positive integer
- If both `departureTime` and `arrivalTime` set, arrival >= departure

---

### Activity (new)

Something the user plans to do at a stop.

```javascript
{
  id: string,              // UUID v4
  tripStopId: string,      // FK → TripStop.id
  sortIndex: number,       // Order within stop (0, 1, 2, ...)
  title: string,           // "Visit the Louvre" (1-200 chars)
  date: string | null,     // ISO 8601 date (YYYY-MM-DD)
  startTime: string | null,// "HH:MM"
  durationMinutes: number | null,
  notes: string,           // Default ""
  createdAt: string,
  updatedAt: string,
}
```

**Design decisions:**
- Activities belong to a TripStop, not directly to a Trip. "Visit the Louvre" is attached to the "Paris" stop.
- No `tripId` on Activity — queried through TripStop. The two-step filter (load stops → filter activities by stopIds) is simple enough for localStorage. Can add `tripId` later if API performance demands it.
- `date` and `startTime` are separate fields so users can add activities without committing to a specific time.

---

## Ordering Strategy

### Approach: Integer `sortIndex`

Both TripStops (within a trip) and Activities (within a stop) use `sortIndex` starting at 0.

| Approach | Insert | Reorder | Read | Verdict |
|----------|--------|---------|------|---------|
| **Integer sortIndex** | O(n) renumber | O(n) renumber | Sort by index | **Selected** |
| Linked list (nextId) | O(1) | O(1) pointer swap | O(n) traversal | Rejected |
| Fractional index | O(1) | O(1) | Sort by float | Rejected |

**Why integer wins:** Simplest to implement, trivial at N < 20, clean SQL `ORDER BY`, no precision bugs. Renumbering 20 items is instant.

**Reorder algorithm:**
```javascript
function reorder(items, fromIndex, toIndex) {
  const reordered = [...items]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)
  return reordered.map((item, i) => ({ ...item, sortIndex: i }))
}
```

### Reorder + Movements Policy

**Decision: Delete affected movements on reorder.**

When stops are reordered, movements that no longer connect consecutive stops become invalid. The app will:
1. Delete all movements for the trip on reorder
2. Show a brief toast: "Transport segments cleared — please re-add them for the new order"

This is the simplest correct approach. Attempting to reassign movements to new adjacent pairs adds complexity for little gain (the user may have reordered *because* the transport changed).

---

## localStorage Storage Layout

Each entity gets its own key. This matches the existing `plantrip_trips` pattern.

```
plantrip_storage_version  →  "2.0"
plantrip_trips            →  [Trip, ...]
plantrip_trip_stops       →  [TripStop, ...]
plantrip_movements        →  [Movement, ...]
plantrip_activities       →  [Activity, ...]
```

**Loading a trip's itinerary:**
```javascript
const stops = allStops
  .filter(s => s.tripId === tripId)
  .sort((a, b) => a.sortIndex - b.sortIndex)

const movements = allMovements
  .filter(m => m.tripId === tripId)

const stopIds = new Set(stops.map(s => s.id))
const activities = allActivities
  .filter(a => stopIds.has(a.tripStopId))
  .sort((a, b) => a.sortIndex - b.sortIndex)
```

---

## Repository Layer

### New repositories

```
src/data/repositories/
  tripRepository.js          (existing — remove cities handling)
  tripStopRepository.js      (new)
  movementRepository.js      (new)
  activityRepository.js      (new)
```

### tripStopRepository

```javascript
{
  getByTripId(tripId)                     // → TripStop[] sorted by sortIndex
  create(tripId, { name, lng, lat })      // Auto-assigns next sortIndex
  update(stopId, updates)                 // Update notes, name, etc.
  deleteWithCascade(tripId, stopId)       // Delete stop + its activities + movements, renumber remaining
  reorder(tripId, fromIndex, toIndex)     // Renumber all stops, delete all movements, return new stops
}
```

### movementRepository

```javascript
{
  getByTripId(tripId)                                // → Movement[]
  upsert(tripId, fromStopId, toStopId, data)         // Create or update
  delete(movementId)
  deleteByTripId(tripId)                             // Clear all movements (used by reorder)
}
```

### activityRepository

```javascript
{
  getByTripId(tripId)                     // → Activity[] (via stop IDs)
  getByStopId(stopId)                     // → Activity[] sorted by sortIndex
  create(stopId, { title, ... })          // Auto-assigns next sortIndex
  update(activityId, updates)
  delete(activityId)                      // Renumber remaining in stop
  reorder(stopId, fromIndex, toIndex)     // Renumber activities within stop
  deleteByStopId(stopId)                  // Cascade from stop delete
}
```

### Cascade Delete Rules

| When deleted | Also delete |
|-------------|-------------|
| Trip | All TripStops (which cascades to their movements + activities) |
| TripStop | Movements referencing it + all Activities for it |
| Movement | Nothing (leaf entity) |
| Activity | Nothing (leaf entity) |

The `deleteWithCascade` method handles this atomically: read all, modify, write all in one pass.

---

## Zustand Store

### New: itineraryStore (separate from tripStore)

```javascript
// src/stores/itineraryStore.js
{
  stops: [],            // TripStop[] for current trip
  movements: [],        // Movement[] for current trip
  activities: [],       // Activity[] for current trip
  isLoading: false,

  loadItinerary(tripId),
  addStop(tripId, stopData),
  updateStop(stopId, updates),
  removeStop(tripId, stopId),
  reorderStop(tripId, fromIndex, toIndex),
  addMovement(tripId, fromStopId, toStopId, data),
  updateMovement(movementId, updates),
  removeMovement(movementId),
  addActivity(stopId, activityData),
  updateActivity(activityId, updates),
  removeActivity(stopId, activityId),
  reorderActivity(stopId, fromIndex, toIndex),
}
```

**Why separate from tripStore:**
- Trip list page only needs `trips[]` — never loads itinerary data
- Itinerary is only relevant on TripDetail
- Keeps stores focused and avoids unnecessary re-renders

### Hook: useItinerary(tripId)

```javascript
function useItinerary(tripId) {
  // Selects from itineraryStore
  // Auto-loads on mount via useEffect
  // Returns: stops, movements, activities, and all action methods
}
```

### Derived data (for rendering)

```javascript
function getItinerarySequence(stops, movements, activities) {
  const movementByFromStop = Object.fromEntries(
    movements.map(m => [m.fromStopId, m])
  )
  const activitiesByStop = Object.groupBy(
    activities.toSorted((a, b) => a.sortIndex - b.sortIndex),
    a => a.tripStopId
  )
  return stops
    .toSorted((a, b) => a.sortIndex - b.sortIndex)
    .map(stop => ({
      stop,
      activities: activitiesByStop[stop.id] || [],
      movementToNext: movementByFromStop[stop.id] || null,
    }))
}
```

---

## Migration from v1 to v2

Run on app startup before any data access:

```javascript
function migrateV1toV2() {
  const version = localStorage.getItem('plantrip_storage_version')
  if (version !== '1.0') return

  const trips = JSON.parse(localStorage.getItem('plantrip_trips') || '[]')
  const stops = []

  for (const trip of trips) {
    const cities = trip.cities || []
    for (let i = 0; i < cities.length; i++) {
      stops.push({
        id: crypto.randomUUID(),
        tripId: trip.id,
        sortIndex: i,
        name: cities[i].name,
        lng: cities[i].lng,
        lat: cities[i].lat,
        notes: '',
        createdAt: trip.updatedAt,
        updatedAt: trip.updatedAt,
      })
    }
    delete trip.cities
  }

  localStorage.setItem('plantrip_trips', JSON.stringify(trips))
  localStorage.setItem('plantrip_trip_stops', JSON.stringify(stops))
  localStorage.setItem('plantrip_movements', JSON.stringify([]))
  localStorage.setItem('plantrip_activities', JSON.stringify([]))
  localStorage.setItem('plantrip_storage_version', '2.0')
}
```

Non-destructive: existing city data maps 1:1 to TripStop fields.

---

## Map Visualization Changes

### From markers-only to itinerary map

| Feature | v1 (current) | v2 (new) |
|---------|-------------|----------|
| Markers | Purple dots | Numbered markers (1, 2, 3...) |
| Connections | None | Lines between consecutive stops |
| Line style | N/A | Varies by transport type |
| Popups | City name | Stop name + movement details |

### MapboxMap interface change

```jsx
// v1
<MapboxMap countryName={country.name} cities={cities} />

// v2
<MapboxMap
  countryName={country.name}
  stops={orderedStops}
  movements={movements}
  selectedStopId={selectedStopId}
  onStopClick={(stopId) => ...}
/>
```

Route lines use Mapbox GL `addSource` + `addLayer` with GeoJSON LineString. Line style by `movement.type`:
- Solid for ground (train, car, bus)
- Dashed for air (plane)
- Dotted for water (ferry)

---

## UI Changes Summary

### TripDetail header stays compact

The header keeps its current compact layout: `[←] Trip Name | status | dates | [📍 itinerary] | [✏️ edit]`

The 📍 button opens an **itinerary sidebar** (replacing the simple cities dropdown) that shows the ordered stop list with movements and activities.

### New itinerary sidebar structure

```
Itinerary (3 stops)
  1. Paris                    [↕] [✕]
     - Visit Louvre
     - Eiffel Tower
     + Add activity
        │
        ▼  Train (SNCF, 2h15)  [edit]
        │
  2. Lyon                     [↕] [✕]
     + Add activity
        │
        ▼  ── no transport ──  [+ add]
        │
  3. Marseille                [↕] [✕]
     + Add activity

  [+ Add stop]
```

### Reordering: up/down buttons for MVP

Start with simple up/down arrow buttons on each stop. Drag-and-drop (`@dnd-kit/sortable`) can be added later as a UX enhancement.

---

## Files to Create/Modify

### New files

| File | Purpose |
|------|---------|
| `src/stores/itineraryStore.js` | Zustand store for stops, movements, activities |
| `src/hooks/useItinerary.js` | Hook for TripDetail page |
| `src/data/repositories/tripStopRepository.js` | TripStop CRUD + reorder |
| `src/data/repositories/movementRepository.js` | Movement CRUD |
| `src/data/repositories/activityRepository.js` | Activity CRUD + reorder |
| `src/components/ItineraryPanel.jsx` | Ordered stop list sidebar |
| `src/components/StopCard.jsx` | Single stop with activities |
| `src/components/MovementEditor.jsx` | Transport type/details editor |
| `src/components/ActivityItem.jsx` | Single activity item |

### Modified files

| File | Changes |
|------|---------|
| `src/pages/TripDetail.jsx` | Replace cities dropdown with itinerary panel; pass stops to map |
| `src/components/MapboxMap.jsx` | Add route lines, numbered markers, stop click handler |
| `src/components/CityAutocomplete.jsx` | `onSelect` creates TripStop instead of city object |
| `src/stores/tripStore.js` | Remove cities from trip operations |
| `src/data/repositories/tripRepository.js` | Remove cities from create/update |
| `src/main.jsx` | Call `migrateV1toV2()` on startup |

---

## Future PostgreSQL Schema

```sql
CREATE TABLE trip_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sort_index INTEGER NOT NULL,
  name VARCHAR(200) NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trip_id, sort_index)
);

CREATE TABLE movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  from_stop_id UUID NOT NULL REFERENCES trip_stops(id),
  to_stop_id UUID NOT NULL REFERENCES trip_stops(id),
  type VARCHAR(20) NOT NULL,
  duration_minutes INTEGER,
  departure_time TIMESTAMPTZ,
  arrival_time TIMESTAMPTZ,
  carrier VARCHAR(200) DEFAULT '',
  booking_ref VARCHAR(200) DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (from_stop_id, to_stop_id),
  CHECK (from_stop_id != to_stop_id)
);

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_stop_id UUID NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
  sort_index INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  date DATE,
  start_time TIME,
  duration_minutes INTEGER,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trip_stop_id, sort_index)
);
```

---

## Trade-offs Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Ordering | Integer `sortIndex` | Simplest, works at N < 20, SQL-friendly |
| City data | Inline on TripStop | No global city catalog needed; Mapbox data is trip-specific |
| Movement on reorder | Delete all movements | Simplest correct behavior; user likely reordered because transport changed |
| `tripId` on Movement | Denormalized | Common query pattern (all movements for a trip) |
| `tripId` on Activity | Not included | Queried via TripStop; avoids extra denormalization for now |
| Separate store | itineraryStore | Keep tripStore simple; itinerary only loaded on detail page |
| Reorder UX (MVP) | Up/down buttons | Simpler than drag-and-drop; add @dnd-kit later |
| Activities scope | Ship with stops + movements | Full activity CRUD included from the start |

---

## Resolved Open Questions

1. **Reorder + movements:** Delete all movements on reorder, show toast notification.
2. **Itinerary panel layout:** Slide-out sidebar from the right (similar to existing TripsPanel), triggered by 📍 button.
3. **Activities scope:** Include from the start — the entity is simple and the UI nests naturally under stops.
4. **Drag-and-drop:** Start with up/down buttons for MVP. Add `@dnd-kit/sortable` as a future enhancement.
