# Frontend Schema v2 Review

**Version:** 1.0
**Date:** 2026-02-17
**Author:** Frontend Engineer
**Reviewing:** `docs/architecture/data-schema-v2.md`

---

## Overall Verdict

The schema is well-designed for frontend consumption. The integer `sortIndex`, inline city data on TripStop, and denormalized `tripId` on Movement all align with how the frontend will actually use this data. A few areas need clarification or adjustment, detailed below.

---

## 1. How TripDetail.jsx Consumes Ordered Stops + Movements

### Current pattern

```jsx
// TripDetail.jsx today
const cities = trip?.cities || []
// Passed directly to MapboxMap and to the cities dropdown
```

### New pattern

The page will no longer get stops from the trip object. It needs a separate load:

```jsx
const { trip } = useTrip(id)
const { stops, movements, reorderStop, addStop, removeStop } = useItinerary(tripId)
const { activities, addActivity, removeActivity } = useActivities(tripId)
```

The `useItinerary` hook returns stops already sorted by `sortIndex`. Movements are keyed by `fromStopId` for O(1) lookup when rendering the sequence.

### Proposed itinerary rendering

The UI naturally becomes a vertical list:

```
[Stop 0: Paris] ---- activities list
    |
    v  Movement: Train (SNCF, 2h15m)
    |
[Stop 1: Lyon] ---- activities list
    |
    v  Movement: Car (3h)
    |
[Stop 2: Marseille] ---- activities list
```

This replaces the current flat "cities dropdown" with a richer itinerary panel.

---

## 2. Zustand Store Shape

### Recommendation: Separate itinerary slice (not merged into tripStore)

The current `tripStore` holds `trips[]` and CRUD actions. The itinerary data (stops, movements, activities) should live in a separate store or a separate slice to avoid bloating the trips list with deeply nested data.

```javascript
// stores/itineraryStore.js
{
  // Keyed by tripId for multi-trip support
  stops: [],           // TripStop[] for the currently loaded trip
  movements: [],       // Movement[] for the currently loaded trip
  activities: [],      // Activity[] for the currently loaded trip
  isLoading: false,
  error: null,

  // Actions
  loadItinerary: async (tripId) => { ... },
  addStop: async (tripId, stopData) => { ... },
  removeStop: async (tripId, stopId) => { ... },
  reorderStop: async (tripId, fromIndex, toIndex) => { ... },
  updateStop: async (tripId, stopId, updates) => { ... },
  addMovement: async (tripId, movementData) => { ... },
  updateMovement: async (tripId, movementId, updates) => { ... },
  removeMovement: async (tripId, movementId) => { ... },
  addActivity: async (stopId, activityData) => { ... },
  updateActivity: async (stopId, activityId, updates) => { ... },
  removeActivity: async (stopId, activityId) => { ... },
  reorderActivity: async (stopId, fromIndex, toIndex) => { ... },
}
```

**Why separate from tripStore:**
- The trip list page only needs `trips[]` -- it should never load all stops/movements/activities
- Itinerary data is only relevant on the TripDetail page
- Keeps the tripStore simple and focused on trip-level CRUD

### Derived data (selectors)

Components will need computed views of the raw data:

```javascript
// Ordered stops with their activities and outgoing movement
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

This is the primary data structure the itinerary UI will render from.

---

## 3. Hooks

### `useItinerary(tripId)`

Primary hook for TripDetail page. Loads stops + movements for a trip.

```javascript
function useItinerary(tripId) {
  const stops = useItineraryStore(s => s.stops)
  const movements = useItineraryStore(s => s.movements)
  const loadItinerary = useItineraryStore(s => s.loadItinerary)
  const addStop = useItineraryStore(s => s.addStop)
  const removeStop = useItineraryStore(s => s.removeStop)
  const reorderStop = useItineraryStore(s => s.reorderStop)
  // ...

  useEffect(() => { loadItinerary(tripId) }, [tripId])

  return { stops, movements, addStop, removeStop, reorderStop, ... }
}
```

### `useActivities(tripId)` or inline in `useItinerary`

Activities can either be:
- (a) Loaded as part of `useItinerary` (simpler, one fetch, recommended for MVP)
- (b) Loaded per-stop on demand (better for trips with many stops + activities)

**Recommendation:** Option (a) for MVP. Load all activities for the trip in one pass since we're reading from localStorage anyway.

---

## 4. Repository Layer Changes

### New repositories needed

```
src/data/repositories/
  tripRepository.js        (existing, remove cities handling)
  tripStopRepository.js    (new)
  movementRepository.js    (new)
  activityRepository.js    (new)
```

Each follows the same pattern as `tripRepository` with the `localStorageAdapter`.

### Key operations

**tripStopRepository:**
- `getByTripId(tripId)` -- returns stops sorted by sortIndex
- `create(tripId, stopData)` -- assigns next sortIndex automatically
- `delete(stopId)` -- also deletes associated movements and activities (cascade)
- `reorder(tripId, fromIndex, toIndex)` -- renumbers all stops

**movementRepository:**
- `getByTripId(tripId)` -- returns all movements for a trip
- `upsertForStops(fromStopId, toStopId, data)` -- create or update the movement between two stops
- `delete(movementId)`
- `deleteByStopId(stopId)` -- remove movements referencing a deleted stop

**activityRepository:**
- `getByStopId(stopId)` or `getByTripId(tripId)` -- latter is better for batch loading
- `create(stopId, activityData)` -- assigns next sortIndex within stop
- `delete(activityId)`
- `reorder(stopId, fromIndex, toIndex)`

### Cascade delete concern

When a TripStop is deleted, the repository must also:
1. Delete all Activities for that stop
2. Delete all Movements referencing that stop (as fromStopId or toStopId)
3. Renumber remaining stops' sortIndex values

This is multiple localStorage writes. The repository should handle this atomically (read all, modify, write all) to avoid inconsistent state.

**Recommendation:** Add a `deleteStopWithCascade(tripId, stopId)` method that handles all of this in one operation.

---

## 5. Map Visualization Changes

### Current: Markers only

```jsx
<MapboxMap countryName={country.name} cities={cities} />
```

The map shows pins for each city. No connections.

### New: Markers + Route lines

With ordered stops and movements, the map should show:

1. **Numbered markers** (not just dots) showing the stop order: 1, 2, 3, ...
2. **Lines between consecutive stops** showing the route
3. **Line styling by transport type** (dashed for flights, solid for ground transport, etc.)
4. **Popups showing movement details** when clicking a route line

The `MapboxMap` component interface changes:

```jsx
<MapboxMap
  countryName={country.name}
  stops={orderedStops}          // TripStop[] sorted by sortIndex
  movements={movements}          // Movement[] to draw connections
  onStopClick={(stopId) => ...}  // Select a stop to show details
  selectedStopId={selectedStopId}
/>
```

### Implementation notes

- Use Mapbox GL `addSource` + `addLayer` with GeoJSON LineString for route lines
- Color-code or dash lines by `movement.type`
- Numbered markers can use a custom HTML element (extending the current `city-marker`)
- `fitBounds` logic stays the same (works on stops array)

---

## 6. Cities Dropdown Evolution

### Current: Flat list with add/remove

```
Cities (3)
  - Paris      [x]
  - Lyon       [x]
  - Marseille  [x]
  + Add city
```

### New: Itinerary sidebar/panel

The dropdown grows into an itinerary panel (likely a slide-out sidebar rather than a small dropdown):

```
Itinerary (3 stops)
  1. Paris                    [drag] [x]
     - Visit Louvre
     - Eiffel Tower
     + Add activity
        |
        v  Train (SNCF, 2h15)  [edit]
        |
  2. Lyon                     [drag] [x]
     + Add activity
        |
        v  No transport set    [+ add]
        |
  3. Marseille                [drag] [x]
     + Add activity

  [+ Add stop]
```

### Reordering UX

**Recommendation: Drag-and-drop with up/down button fallback.**

- Drag handle on each stop for mouse users
- Up/down arrow buttons for accessibility and mobile
- On reorder, the store calls `reorderStop(tripId, fromIndex, toIndex)` which renumbers all sortIndex values and persists

Library option: `@dnd-kit/sortable` (lightweight, accessible, works well with lists).

### Adding a stop

The existing `CityAutocomplete` component works almost as-is. The only change is what happens on select:

```javascript
// Current
async function handleAddCity(city) {
  await updateTrip(trip.id, { cities: [...cities, city] })
}

// New
async function handleAddStop(city) {
  await addStop(trip.id, {
    name: city.name,
    lng: city.lng,
    lat: city.lat,
    notes: '',
  })
  // sortIndex is auto-assigned by the repository (next integer)
}
```

### Removing a stop

Must cascade-delete movements and activities. The UI should warn the user if the stop has activities or movements:

```
"Remove Lyon? This will also delete 2 activities and the
 connected transport segments."
 [Cancel] [Remove]
```

---

## 7. Activities Integration in the UI

### Where activities appear

Activities nest under each stop in the itinerary panel. They are secondary detail -- visible when a stop is expanded, not always shown.

### Activity CRUD UI

- **Add:** Inline form under the stop (title is the only required field)
- **Edit:** Click to expand into an edit form with date/time/duration/notes
- **Delete:** Swipe or trash icon with confirmation
- **Reorder:** Drag handles within the stop's activity list (same `@dnd-kit/sortable`)

### Activity on the map?

For MVP: No. Activities don't have their own coordinates. They inherit the stop's location. No map interaction for activities.

Future: Could show activity pins at specific addresses within a city, but that requires geocoding each activity.

---

## 8. Schema Concerns and Feedback

### Concern 1: Movement lifecycle when reordering stops

**Problem:** When the user reorders stops, existing movements may become invalid. If stops are [A, B, C] with movements A->B and B->C, and the user moves C between A and B (new order: [A, C, B]), the movements A->B and B->C no longer connect consecutive stops.

**Schema response:** The schema uses `fromStopId` / `toStopId` references, not sortIndex-based adjacency. So movements don't automatically break on reorder -- they still point to the same stops. But they no longer represent the correct sequence.

**Frontend recommendation:** On reorder, the frontend should:
1. Delete all movements for the trip (they're now invalid)
2. Notify the user: "Reordering stops has cleared your transport segments. Please re-add them."
3. Alternative: Try to reassign movements to new consecutive pairs if the same stops are still adjacent. This is more complex but better UX.

**This needs a decision.** Suggest the DB architect adds guidance on this. My preference: option 1 (delete all movements on reorder) for MVP simplicity, with a warning to the user.

### Concern 2: No `tripId` on Activity -- querying for trip-level view

The schema omits `tripId` from Activity. For the trip detail page, we need all activities for all stops in one trip. Without `tripId` on Activity, we must:

1. Load all stops for the trip (filter by tripId)
2. Collect all stop IDs
3. Filter all activities where `tripStopId` is in that set

This is a two-step process. In localStorage this is fine (everything is in memory). But it's slightly awkward as a pattern. The alternative of adding `tripId` to Activity would allow a direct `activities.filter(a => a.tripId === tripId)`.

**Recommendation:** Accept the schema as-is for now. The two-step filter is simple enough and avoids denormalization. If performance becomes an issue when we move to an API, we can add `tripId` to Activity then or use a server-side join.

### Concern 3: Movement `type` enum extensibility

The enum `'train' | 'car' | 'plane' | 'bus' | 'ferry' | 'other'` is good. The frontend will need an icon and label map:

```javascript
const TRANSPORT_CONFIG = {
  train: { label: 'Train', icon: 'train-icon' },
  car:   { label: 'Car',   icon: 'car-icon' },
  plane: { label: 'Plane', icon: 'plane-icon' },
  bus:   { label: 'Bus',   icon: 'bus-icon' },
  ferry: { label: 'Ferry', icon: 'ferry-icon' },
  other: { label: 'Other', icon: 'dots-icon' },
}
```

No concern here, just noting the frontend mapping needed.

### Concern 4: Empty state flow

With the old schema, a trip started with zero cities and you added them from the dropdown. With the new schema, the flow is similar but the empty state changes:

- New trip -> 0 stops -> show "Add your first stop" prompt
- 1 stop -> no movements possible yet -> show the stop on the map
- 2+ stops -> movements can be added between consecutive stops

The UI needs to handle each state cleanly. This is a UX concern, not a schema issue.

---

## 9. Summary of Frontend Changes Required

### New files

| File | Purpose |
|------|---------|
| `src/stores/itineraryStore.js` | Zustand store for stops, movements, activities |
| `src/hooks/useItinerary.js` | Hook for loading/managing stops + movements |
| `src/data/repositories/tripStopRepository.js` | CRUD + reorder for stops |
| `src/data/repositories/movementRepository.js` | CRUD for movements |
| `src/data/repositories/activityRepository.js` | CRUD + reorder for activities |
| `src/components/ItineraryPanel.jsx` | Ordered stop list with drag-and-drop |
| `src/components/StopCard.jsx` | Single stop with activities + movement connector |
| `src/components/MovementEditor.jsx` | Inline editor for transport type/details |
| `src/components/ActivityItem.jsx` | Single activity with edit/delete |

### Modified files

| File | Changes |
|------|---------|
| `src/pages/TripDetail.jsx` | Replace cities dropdown with itinerary panel; pass stops to map |
| `src/components/MapboxMap.jsx` | Add route lines between stops; numbered markers |
| `src/components/CityAutocomplete.jsx` | Minor: `onSelect` now creates a TripStop, not a city object |
| `src/stores/tripStore.js` | Remove cities handling from trip updates |
| `src/data/repositories/tripRepository.js` | Remove cities from trip create/update |
| `src/data/adapters/localStorageAdapter.js` | No changes needed (generic enough) |

### Migration

Add `migrateV1toV2()` call on app startup (in `main.jsx` or in the localStorage adapter's `initStorage`).

---

## 10. Open Questions for Team Discussion

1. **Reorder + movements:** What should happen to movements when stops are reordered? (See Concern 1)
2. **Itinerary panel UX:** Sidebar slide-out or full-width panel below the header? Need to decide the layout.
3. **Activities MVP scope:** Do we build the full activity CRUD now, or ship stops + movements first and add activities in a follow-up?
4. **Dependencies:** Should we add `@dnd-kit/sortable` for drag-and-drop, or start with simple up/down buttons?
