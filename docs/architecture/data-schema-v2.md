# PlanTrip Data Schema v2 — Stops, Movements, Activities

**Version:** 2.0
**Date:** 2026-02-17
**Author:** Database Architect
**Status:** Proposed

---

## Summary

This schema replaces the embedded `cities: [{id, name, lng, lat}]` array on Trip with three normalized entities:

- **TripStop** — an ordered city within a trip
- **Movement** — transport between two consecutive stops
- **Activity** — a planned activity at a stop

The design is minimalist. It works with localStorage (flat JSON arrays) today and maps cleanly to PostgreSQL tables with foreign keys later.

---

## Entity Relationship Diagram

```
                        Trip
                         │
                         │ 1
                         │
                         ▼ N
                      TripStop ◄──────────────┐
                    (ordered)                  │
                     │      │                  │
                     │ 1    │ 1                │
                     │      │                  │
                     ▼ N    ▼ N                │
                Activity   Movement            │
                          (fromStopId)    (toStopId)
```

**ASCII detail:**

```
Trip (1) ──< (N) TripStop
                    │
                    ├──< (N) Activity
                    │
                    ├── (1) ──< Movement.fromStopId
                    └── (1) ──< Movement.toStopId

Movement connects two consecutive TripStops within the same trip.
```

---

## Entities

### Trip (unchanged)

The Trip entity stays as-is. The only change is that the `cities` array is removed — city data now lives in TripStop.

```typescript
interface Trip {
  id: string              // UUID v4 (crypto.randomUUID())
  name: string            // 1-200 chars
  countryCode: string     // FK → Country.code
  startDate: string | null
  endDate: string | null
  status: 'planning' | 'booked' | 'completed' | 'cancelled'
  notes: string
  createdAt: string       // ISO 8601
  updatedAt: string       // ISO 8601
  // REMOVED: cities: []  — replaced by TripStop
}
```

---

### TripStop (new)

**Purpose:** A city the user plans to visit, in a specific position within the trip's itinerary.

```typescript
interface TripStop {
  id: string              // UUID v4
  tripId: string          // FK → Trip.id
  sortIndex: number       // Order within the trip (0, 1, 2, ...)
  name: string            // City name (e.g. "Paris")
  lng: number             // Longitude (from Mapbox Geocoding)
  lat: number             // Latitude (from Mapbox Geocoding)
  notes: string           // Free text, default ""
  createdAt: string       // ISO 8601
  updatedAt: string       // ISO 8601
}
```

**Key decisions:**

- City data (name, lng, lat) is stored directly on TripStop, not in a separate City table. This matches the current reality: cities come from Mapbox Geocoding and are trip-specific. There is no global city catalog to deduplicate against. A separate City entity adds joins and complexity for zero benefit right now.
- `sortIndex` is an integer starting at 0. See [Ordering Strategy](#ordering-strategy) below for the full rationale.

**Validation rules:**
- `tripId`: required, must reference an existing Trip
- `sortIndex`: required, integer >= 0, unique within a trip (`tripId + sortIndex`)
- `name`: required, 1-200 characters
- `lng`: required, -180 to 180
- `lat`: required, -90 to 90

**Indexes (future PostgreSQL):**
- Primary: `id`
- Foreign key: `tripId` → `Trip.id` (CASCADE DELETE)
- Unique: `(tripId, sortIndex)`
- Index: `tripId` (for loading all stops for a trip)

---

### Movement (new)

**Purpose:** Transport between two consecutive TripStops. Represents "how do I get from stop A to stop B?"

```typescript
interface Movement {
  id: string              // UUID v4
  tripId: string          // FK → Trip.id (denormalized for easy querying)
  fromStopId: string      // FK → TripStop.id
  toStopId: string        // FK → TripStop.id
  type: 'train' | 'car' | 'plane' | 'bus' | 'ferry' | 'other'
  durationMinutes: number | null   // Estimated travel time
  departureTime: string | null     // ISO 8601 datetime
  arrivalTime: string | null       // ISO 8601 datetime
  carrier: string         // e.g. "SNCF", "Ryanair", "" if unknown
  bookingRef: string      // Booking reference, "" if none
  notes: string           // Free text, default ""
  createdAt: string
  updatedAt: string
}
```

**Key decisions:**

- `tripId` is denormalized (could be derived from fromStopId → TripStop.tripId). We include it because in localStorage we filter by tripId constantly, and a join-free lookup is worth the redundancy.
- `fromStopId` / `toStopId` reference TripStops, not city names. This keeps the ordering relationship explicit. A Movement always connects stops at consecutive sortIndex values.
- Only one Movement per pair of consecutive stops. If the user changes transport type, they edit the Movement — they don't create multiple.
- Movements are optional. A trip can have stops with no movements between them (user hasn't planned transport yet).

**Validation rules:**
- `tripId`: required, must reference an existing Trip
- `fromStopId`, `toStopId`: required, must reference TripStops belonging to the same trip
- `fromStopId` !== `toStopId`
- `type`: required, one of the enum values
- `durationMinutes`: null or positive integer
- If both `departureTime` and `arrivalTime` are set, arrival must be >= departure

**Indexes (future PostgreSQL):**
- Primary: `id`
- Foreign keys: `tripId` → `Trip.id` (CASCADE DELETE), `fromStopId` → `TripStop.id`, `toStopId` → `TripStop.id`
- Unique: `(fromStopId, toStopId)` — at most one movement between any pair
- Index: `tripId`

---

### Activity (new)

**Purpose:** Something the user plans to do at a particular stop.

```typescript
interface Activity {
  id: string              // UUID v4
  tripStopId: string      // FK → TripStop.id
  sortIndex: number       // Order within the stop (0, 1, 2, ...)
  title: string           // "Visit the Louvre" (1-200 chars)
  date: string | null     // ISO 8601 date (YYYY-MM-DD), null if unscheduled
  startTime: string | null // "09:00" (HH:MM), null if unscheduled
  durationMinutes: number | null
  notes: string           // Free text, default ""
  createdAt: string
  updatedAt: string
}
```

**Key decisions:**

- Activities belong to a TripStop, not directly to a Trip. This means "visit the Louvre" is attached to the "Paris" stop, which is the natural mental model.
- `sortIndex` is used for ordering within a stop, same strategy as TripStop ordering.
- No `tripId` on Activity — we get it through `TripStop.tripId`. Unlike Movement, Activity doesn't need frequent cross-stop queries, so the extra denormalization isn't worth it.
- `date` and `startTime` are separate fields. This lets the user add an activity without committing to a specific time.

**Validation rules:**
- `tripStopId`: required, must reference an existing TripStop
- `sortIndex`: required, integer >= 0, unique within a stop (`tripStopId + sortIndex`)
- `title`: required, 1-200 characters
- `date`: null or valid ISO 8601 date
- `startTime`: null or valid HH:MM string
- `durationMinutes`: null or positive integer

**Indexes (future PostgreSQL):**
- Primary: `id`
- Foreign key: `tripStopId` → `TripStop.id` (CASCADE DELETE)
- Unique: `(tripStopId, sortIndex)`
- Index: `tripStopId`

---

## Ordering Strategy

### Approach: Integer `sortIndex`

TripStops use `sortIndex` (0, 1, 2, ...) to define their position in the itinerary. Activities use the same approach within a TripStop.

### Why sortIndex over alternatives

| Approach | Insert | Reorder | Read | Complexity | Verdict |
|----------|--------|---------|------|------------|---------|
| **Integer sortIndex** | O(n) renumber | O(n) renumber | O(n log n) sort | Low | **Selected** |
| Linked list (nextId) | O(1) | O(1) pointer swap | O(n) traversal, no sort | Medium | Rejected |
| Fractional index | O(1) | O(1) | O(n log n) sort | Medium (precision issues) | Rejected |

**Why integer sortIndex wins for this app:**

1. **Simplicity.** The codebase is JavaScript with localStorage. Integer sort is the simplest thing that works. No linked-list traversal, no floating-point precision worries.
2. **Small N.** A trip has at most ~20 stops. Renumbering 20 items on every insert/reorder is instant. The O(n) cost is irrelevant at this scale.
3. **Clean queries.** `stops.sort((a, b) => a.sortIndex - b.sortIndex)` is trivial in JS and `ORDER BY sort_index` is trivial in SQL.
4. **PostgreSQL-friendly.** Integer indexes are natural for `UNIQUE (trip_id, sort_index)` constraints and efficient `ORDER BY`.

**Reorder algorithm:**

```javascript
// Move stop from position `from` to position `to` within a trip
function reorder(stops, from, to) {
  const reordered = [...stops]
  const [moved] = reordered.splice(from, 1)
  reordered.splice(to, 0, moved)
  return reordered.map((stop, i) => ({ ...stop, sortIndex: i }))
}
```

After a reorder, all stops get new contiguous sortIndex values (0, 1, 2, ...). This avoids gaps and keeps the invariant simple.

---

## localStorage Storage Layout

Each entity gets its own key in localStorage. This matches the existing pattern (`plantrip_trips`) and avoids re-serializing all data on every write.

```
localStorage keys:
  plantrip_storage_version  →  "2.0"
  plantrip_trips            →  [Trip, Trip, ...]
  plantrip_trip_stops       →  [TripStop, TripStop, ...]
  plantrip_movements        →  [Movement, Movement, ...]
  plantrip_activities       →  [Activity, Activity, ...]
```

**Loading a trip's full itinerary:**

```javascript
const stops = allStops
  .filter(s => s.tripId === tripId)
  .sort((a, b) => a.sortIndex - b.sortIndex)

const movements = allMovements
  .filter(m => m.tripId === tripId)

const activitiesByStop = {}
stops.forEach(stop => {
  activitiesByStop[stop.id] = allActivities
    .filter(a => a.tripStopId === stop.id)
    .sort((a, b) => a.sortIndex - b.sortIndex)
})
```

This is O(n) scans, which is fine for localStorage scale (dozens of trips, hundreds of stops at most).

---

## Migration from v1

The current Trip has `cities: [{id, name, lng, lat}]`. Migration converts each embedded city to a TripStop:

```javascript
function migrateV1toV2() {
  const version = localStorage.getItem('plantrip_storage_version')
  if (version !== '1.0') return  // already migrated or fresh install

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
    // Remove cities array from trip
    delete trip.cities
  }

  localStorage.setItem('plantrip_trips', JSON.stringify(trips))
  localStorage.setItem('plantrip_trip_stops', JSON.stringify(stops))
  localStorage.setItem('plantrip_movements', JSON.stringify([]))
  localStorage.setItem('plantrip_activities', JSON.stringify([]))
  localStorage.setItem('plantrip_storage_version', '2.0')
}
```

**Migration is non-destructive:** the existing `id`, `name`, `lng`, `lat` fields on each city map directly to TripStop fields. The array index becomes the `sortIndex`. No data is lost.

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

CREATE INDEX idx_trip_stops_trip ON trip_stops(trip_id);

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

CREATE INDEX idx_movements_trip ON movements(trip_id);

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

CREATE INDEX idx_activities_stop ON activities(trip_stop_id);
```

---

## What This Schema Does NOT Include

Deliberately omitted to keep things minimal:

- **Global City table.** Cities come from Mapbox Geocoding and are stored inline on TripStop. A normalized City catalog adds complexity (deduplication, geocode caching) for no current benefit. Can be added later if needed.
- **TrainRoute table.** The old docs described a TrainRoute entity for pre-built route data. Movement replaces this with a simpler user-entered model. If we later integrate a train API, we can add a `trainRouteId` foreign key to Movement.
- **Budget / cost tracking.** Not in scope.
- **Multi-user / sharing.** Not in scope.
- **Tags / categories on stops or activities.** Can be added as a simple `tags: string[]` field later.
- **Images / attachments.** Out of scope for localStorage.

---

## Summary of Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Ordering mechanism | Integer `sortIndex` | Simplest, small N, SQL-friendly |
| City data location | Inline on TripStop | No global city catalog exists; Mapbox data is trip-specific |
| Movement references | `fromStopId` + `toStopId` | Explicit, avoids implicit "next stop" logic |
| `tripId` on Movement | Denormalized | Avoids joins for common "get all movements for trip" query |
| `tripId` on Activity | Not included | Always queried via TripStop; less critical path |
| One Movement per stop pair | Enforced via unique constraint | Keeps the model simple; edit, don't duplicate |
| Separate localStorage keys | One key per entity type | Avoids re-serializing everything on each write |
