# PlanTrip Data Architecture

## Executive Summary

This document defines the complete data schema and storage abstraction layer for PlanTrip, designed to support the MVP (client-side Trip CRUD) while enabling seamless migration to a backend API with relational database in the future.

**Key Decisions:**
- **Storage for MVP:** localStorage (simpler, sufficient for MVP scale)
- **Architecture Pattern:** Repository Pattern with abstraction layer
- **ID Strategy:** UUIDs for client-side generation and future API compatibility
- **Data Modeling:** Relational design with foreign keys (even in localStorage)
- **Migration Path:** Interface-based design allows swapping storage backend with zero business logic changes

---

## Data Schema

### Entity Relationship Diagram

```
Country (1) ──< (N) City (N) ──< (N) TrainRoute (N) >── (N) City
   |                 |
   |                 |
  (1)               (N)
   |                 |
  (N)               (1)
 Trip ───────────> City (optional: primary city visited)
```

### 1. Country Entity

**Purpose:** Reference data for countries, their codes, and flag colors.

**Storage:** Static JSON file (`src/data/countries.js`) - no CRUD needed for MVP

```typescript
interface Country {
  code: string;           // ISO 3166-1 alpha-2 (e.g., "FR", "JP")
  name: string;           // Full country name
  colors: string[];       // Hex colors from flag
}
```

**Indexes (future DB):**
- Primary: `code` (unique)
- Secondary: `name` (unique, for lookups)

**Notes:**
- No `id` field needed; `code` serves as natural primary key
- Immutable reference data
- Will remain as static JSON in both MVP and future versions

---

### 2. Trip Entity (MVP)

**Purpose:** Core entity for tracking user's planned or completed trips.

```typescript
interface Trip {
  id: string;                    // UUID v4
  name: string;                  // Trip title (e.g., "Summer Europe Tour")
  countryCode: string;           // FK to Country.code
  startDate: string | null;      // ISO 8601 date string (YYYY-MM-DD)
  endDate: string | null;        // ISO 8601 date string
  status: 'planning' | 'booked' | 'completed' | 'cancelled';
  notes: string;                 // Rich text / markdown notes
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp

  // Future extensions (not MVP):
  primaryCityId?: string | null; // FK to City.id (main destination)
  tags?: string[];               // e.g., ["backpacking", "food-tour"]
}
```

**Validation Rules:**
- `id`: Must be valid UUID v4
- `name`: Required, 1-200 characters
- `countryCode`: Required, must exist in countries.js
- `startDate`, `endDate`: Must be valid ISO 8601 dates or null
- `endDate` must be >= `startDate` when both present
- `status`: Required, one of enum values
- `notes`: Optional, max 10,000 characters
- `createdAt`, `updatedAt`: Auto-generated, immutable (createdAt), auto-updated (updatedAt)

**Indexes (future DB):**
- Primary: `id`
- Foreign Key: `countryCode` -> `Country.code`
- Composite: `(countryCode, startDate)` for filtering
- Index: `status`, `createdAt` (for sorting/filtering)

---

### 3. City Entity (Future)

**Purpose:** Major cities within countries, used for trip segments and train route connections.

```typescript
interface City {
  id: string;                    // UUID v4
  name: string;                  // City name (e.g., "Paris")
  countryCode: string;           // FK to Country.code
  latitude: number;              // Decimal degrees
  longitude: number;             // Decimal degrees
  timezone: string;              // IANA timezone (e.g., "Europe/Paris")
  population: number | null;     // For ranking/sorting
  isCapital: boolean;            // Flag for capital cities
  metadata: object | null;       // JSON: { wikiUrl, imageUrl, etc. }
  createdAt: string;
  updatedAt: string;
}
```

**Indexes (future DB):**
- Primary: `id`
- Foreign Key: `countryCode` -> `Country.code`
- Unique: `(name, countryCode)` - same city name can exist across countries
- Spatial: `(latitude, longitude)` for geo queries
- Index: `population`, `isCapital`

---

### 4. TrainRoute Entity (Future)

**Purpose:** Train connections between cities with schedule and metadata.

```typescript
interface TrainRoute {
  id: string;                    // UUID v4
  originCityId: string;          // FK to City.id
  destinationCityId: string;     // FK to City.id
  operator: string;              // e.g., "SNCF", "Trenitalia"
  routeName: string | null;      // e.g., "TGV", "Eurostar"
  durationMinutes: number;       // Typical travel time
  frequency: string;             // e.g., "hourly", "daily", "3x per week"
  operatingDays: number[];       // [0-6] where 0=Sunday
  approximateCost: number | null; // EUR (for reference)
  bookingUrl: string | null;
  metadata: object | null;       // JSON: { scenicRoute: bool, highSpeed: bool }
  isActive: boolean;             // For seasonal/discontinued routes
  createdAt: string;
  updatedAt: string;
}
```

**Validation Rules:**
- `originCityId` !== `destinationCityId`
- `durationMinutes` > 0
- `operatingDays`: array of integers 0-6

**Indexes (future DB):**
- Primary: `id`
- Foreign Keys: `originCityId`, `destinationCityId` -> `City.id`
- Unique: `(originCityId, destinationCityId, routeName)` - allow multiple routes between same cities
- Index: `isActive`, `operator`
- Composite: `(originCityId, isActive)`, `(destinationCityId, isActive)`

---

### 5. TripSegment Entity (Future)

**Purpose:** Break trips into segments between cities, linked to train routes.

```typescript
interface TripSegment {
  id: string;                    // UUID v4
  tripId: string;                // FK to Trip.id
  originCityId: string;          // FK to City.id
  destinationCityId: string;     // FK to City.id
  trainRouteId: string | null;   // FK to TrainRoute.id (null if other transport)
  departureDate: string | null;  // ISO 8601 date
  arrivalDate: string | null;    // ISO 8601 date
  sequenceOrder: number;         // Order within trip (1, 2, 3...)
  bookingReference: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
```

**Indexes (future DB):**
- Primary: `id`
- Foreign Keys: `tripId`, `originCityId`, `destinationCityId`, `trainRouteId`
- Unique: `(tripId, sequenceOrder)`
- Index: `tripId`, `departureDate`

---

## Storage Abstraction Layer

### Architecture: Repository Pattern

The Repository Pattern decouples business logic from storage implementation, allowing the frontend to work with a consistent interface regardless of whether data comes from localStorage, IndexedDB, or a REST API.

```
┌─────────────────────┐
│  React Components   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Repository Layer   │  ◄── Interface Contract (ITripRepository)
│  (Business Logic)   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Storage Adapter    │  ◄── Swappable Implementation
│  (localStorage/API) │
└─────────────────────┘
```

### Interface Definition

**File:** `src/lib/storage/interfaces/IRepository.ts`

```typescript
// Generic result type for error handling
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Base repository interface
export interface IRepository<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  // Read operations
  findById(id: string): Promise<Result<T | null>>;
  findAll(filters?: Record<string, any>): Promise<Result<T[]>>;

  // Write operations
  create(data: TCreate): Promise<Result<T>>;
  update(id: string, data: TUpdate): Promise<Result<T>>;
  delete(id: string): Promise<Result<void>>;

  // Batch operations
  createMany(items: TCreate[]): Promise<Result<T[]>>;
  deleteMany(ids: string[]): Promise<Result<void>>;
}

// Trip-specific repository interface
export interface ITripRepository extends IRepository<Trip, CreateTripDto, UpdateTripDto> {
  // Trip-specific queries
  findByCountry(countryCode: string): Promise<Result<Trip[]>>;
  findByDateRange(start: string, end: string): Promise<Result<Trip[]>>;
  findByStatus(status: Trip['status']): Promise<Result<Trip[]>>;

  // Aggregations
  count(filters?: Record<string, any>): Promise<Result<number>>;
}

// Data Transfer Objects (DTOs)
export interface CreateTripDto {
  name: string;
  countryCode: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: Trip['status'];
  notes?: string;
}

export interface UpdateTripDto {
  name?: string;
  countryCode?: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: Trip['status'];
  notes?: string;
}
```

---

### MVP Implementation: localStorage

**File:** `src/lib/storage/adapters/LocalStorageTripRepository.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { ITripRepository, CreateTripDto, UpdateTripDto, Result } from '../interfaces/IRepository';
import type { Trip } from '../../../types/models';
import { countries } from '../../../data/countries';

const STORAGE_KEY = 'plantrip_trips';
const STORAGE_VERSION = '1.0';
const VERSION_KEY = 'plantrip_storage_version';

export class LocalStorageTripRepository implements ITripRepository {
  constructor() {
    this.initializeStorage();
  }

  private initializeStorage(): void {
    const version = localStorage.getItem(VERSION_KEY);
    if (!version) {
      localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
    // Future: handle migrations here based on version
  }

  private getTrips(): Trip[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to parse trips from localStorage:', error);
      return [];
    }
  }

  private saveTrips(trips: Trip[]): Result<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Failed to save trips')
      };
    }
  }

  private validateTrip(data: CreateTripDto | UpdateTripDto): Result<void> {
    if ('name' in data && data.name) {
      if (data.name.length < 1 || data.name.length > 200) {
        return { success: false, error: new Error('Trip name must be 1-200 characters') };
      }
    }

    if ('countryCode' in data && data.countryCode) {
      const validCountry = countries.find(c => c.code === data.countryCode);
      if (!validCountry) {
        return { success: false, error: new Error('Invalid country code') };
      }
    }

    if ('startDate' in data && 'endDate' in data && data.startDate && data.endDate) {
      if (new Date(data.endDate) < new Date(data.startDate)) {
        return { success: false, error: new Error('End date must be after start date') };
      }
    }

    return { success: true, data: undefined };
  }

  async findById(id: string): Promise<Result<Trip | null>> {
    const trips = this.getTrips();
    const trip = trips.find(t => t.id === id);
    return { success: true, data: trip || null };
  }

  async findAll(filters?: Record<string, any>): Promise<Result<Trip[]>> {
    let trips = this.getTrips();

    if (filters) {
      trips = trips.filter(trip => {
        return Object.entries(filters).every(([key, value]) => {
          if (value === undefined || value === null) return true;
          return trip[key as keyof Trip] === value;
        });
      });
    }

    // Sort by createdAt descending (newest first)
    trips.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, data: trips };
  }

  async findByCountry(countryCode: string): Promise<Result<Trip[]>> {
    return this.findAll({ countryCode });
  }

  async findByDateRange(start: string, end: string): Promise<Result<Trip[]>> {
    const trips = this.getTrips();
    const startDate = new Date(start);
    const endDate = new Date(end);

    const filtered = trips.filter(trip => {
      if (!trip.startDate) return false;
      const tripStart = new Date(trip.startDate);
      return tripStart >= startDate && tripStart <= endDate;
    });

    return { success: true, data: filtered };
  }

  async findByStatus(status: Trip['status']): Promise<Result<Trip[]>> {
    return this.findAll({ status });
  }

  async create(data: CreateTripDto): Promise<Result<Trip>> {
    const validation = this.validateTrip(data);
    if (!validation.success) return validation as Result<never>;

    const now = new Date().toISOString();
    const trip: Trip = {
      id: uuidv4(),
      name: data.name,
      countryCode: data.countryCode,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      status: data.status || 'planning',
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    };

    const trips = this.getTrips();
    trips.push(trip);

    const saveResult = this.saveTrips(trips);
    if (!saveResult.success) return saveResult as Result<never>;

    return { success: true, data: trip };
  }

  async update(id: string, data: UpdateTripDto): Promise<Result<Trip>> {
    const validation = this.validateTrip(data);
    if (!validation.success) return validation as Result<never>;

    const trips = this.getTrips();
    const index = trips.findIndex(t => t.id === id);

    if (index === -1) {
      return { success: false, error: new Error('Trip not found') };
    }

    const updatedTrip: Trip = {
      ...trips[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    trips[index] = updatedTrip;

    const saveResult = this.saveTrips(trips);
    if (!saveResult.success) return saveResult as Result<never>;

    return { success: true, data: updatedTrip };
  }

  async delete(id: string): Promise<Result<void>> {
    const trips = this.getTrips();
    const filtered = trips.filter(t => t.id !== id);

    if (filtered.length === trips.length) {
      return { success: false, error: new Error('Trip not found') };
    }

    return this.saveTrips(filtered);
  }

  async createMany(items: CreateTripDto[]): Promise<Result<Trip[]>> {
    const trips = this.getTrips();
    const now = new Date().toISOString();
    const newTrips: Trip[] = [];

    for (const data of items) {
      const validation = this.validateTrip(data);
      if (!validation.success) return validation as Result<never>;

      newTrips.push({
        id: uuidv4(),
        name: data.name,
        countryCode: data.countryCode,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        status: data.status || 'planning',
        notes: data.notes || '',
        createdAt: now,
        updatedAt: now,
      });
    }

    trips.push(...newTrips);
    const saveResult = this.saveTrips(trips);
    if (!saveResult.success) return saveResult as Result<never>;

    return { success: true, data: newTrips };
  }

  async deleteMany(ids: string[]): Promise<Result<void>> {
    const trips = this.getTrips();
    const filtered = trips.filter(t => !ids.includes(t.id));
    return this.saveTrips(filtered);
  }

  async count(filters?: Record<string, any>): Promise<Result<number>> {
    const result = await this.findAll(filters);
    if (!result.success) return result as Result<never>;
    return { success: true, data: result.data.length };
  }
}
```

---

### Future Implementation: REST API

**File:** `src/lib/storage/adapters/ApiTripRepository.ts`

```typescript
import type { ITripRepository, CreateTripDto, UpdateTripDto, Result } from '../interfaces/IRepository';
import type { Trip } from '../../../types/models';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export class ApiTripRepository implements ITripRepository {
  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<Result<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          // Future: add auth token
          // 'Authorization': `Bearer ${getAuthToken()}`
        },
        ...options,
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: new Error(error.message || `HTTP ${response.status}`)
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Network error')
      };
    }
  }

  async findById(id: string): Promise<Result<Trip | null>> {
    return this.fetch<Trip>(`/trips/${id}`);
  }

  async findAll(filters?: Record<string, any>): Promise<Result<Trip[]>> {
    const params = new URLSearchParams(filters as Record<string, string>);
    return this.fetch<Trip[]>(`/trips?${params}`);
  }

  async findByCountry(countryCode: string): Promise<Result<Trip[]>> {
    return this.fetch<Trip[]>(`/trips?countryCode=${countryCode}`);
  }

  async findByDateRange(start: string, end: string): Promise<Result<Trip[]>> {
    return this.fetch<Trip[]>(`/trips?startDate[gte]=${start}&startDate[lte]=${end}`);
  }

  async findByStatus(status: Trip['status']): Promise<Result<Trip[]>> {
    return this.fetch<Trip[]>(`/trips?status=${status}`);
  }

  async create(data: CreateTripDto): Promise<Result<Trip>> {
    return this.fetch<Trip>('/trips', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(id: string, data: UpdateTripDto): Promise<Result<Trip>> {
    return this.fetch<Trip>(`/trips/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete(id: string): Promise<Result<void>> {
    return this.fetch<void>(`/trips/${id}`, {
      method: 'DELETE',
    });
  }

  async createMany(items: CreateTripDto[]): Promise<Result<Trip[]>> {
    return this.fetch<Trip[]>('/trips/batch', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async deleteMany(ids: string[]): Promise<Result<void>> {
    return this.fetch<void>('/trips/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  async count(filters?: Record<string, any>): Promise<Result<number>> {
    const params = new URLSearchParams(filters as Record<string, string>);
    return this.fetch<number>(`/trips/count?${params}`);
  }
}
```

---

### Dependency Injection / Factory

**File:** `src/lib/storage/StorageFactory.ts`

```typescript
import type { ITripRepository } from './interfaces/IRepository';
import { LocalStorageTripRepository } from './adapters/LocalStorageTripRepository';
import { ApiTripRepository } from './adapters/ApiTripRepository';

type StorageMode = 'localStorage' | 'api';

export class StorageFactory {
  private static mode: StorageMode = 'localStorage'; // Default for MVP
  private static tripRepository?: ITripRepository;

  static setMode(mode: StorageMode): void {
    this.mode = mode;
    // Clear cached instances when mode changes
    this.tripRepository = undefined;
  }

  static getTripRepository(): ITripRepository {
    if (!this.tripRepository) {
      this.tripRepository = this.mode === 'api'
        ? new ApiTripRepository()
        : new LocalStorageTripRepository();
    }
    return this.tripRepository;
  }
}

// Usage in components:
// const tripRepo = StorageFactory.getTripRepository();
// const result = await tripRepo.findAll();
```

---

## Error Handling Pattern

All repository methods return a `Result<T>` type to handle errors gracefully without throwing exceptions.

### React Hook Example

**File:** `src/hooks/useTrips.ts`

```typescript
import { useState, useEffect } from 'react';
import { StorageFactory } from '../lib/storage/StorageFactory';
import type { Trip } from '../types/models';

export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const tripRepo = StorageFactory.getTripRepository();

  const loadTrips = async () => {
    setLoading(true);
    setError(null);

    const result = await tripRepo.findAll();

    if (result.success) {
      setTrips(result.data);
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const createTrip = async (data: CreateTripDto) => {
    const result = await tripRepo.create(data);

    if (result.success) {
      setTrips(prev => [result.data, ...prev]);
      return result.data;
    } else {
      setError(result.error);
      throw result.error;
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  return {
    trips,
    loading,
    error,
    createTrip,
    refresh: loadTrips,
  };
}
```

---

## localStorage vs IndexedDB Recommendation

### Decision: **localStorage for MVP**

| Criteria | localStorage | IndexedDB |
|----------|--------------|-----------|
| **Complexity** | Simple key-value API | Complex asynchronous API |
| **Setup Time** | 5 minutes | 1-2 hours |
| **Storage Limit** | 5-10MB | 50MB - unlimited |
| **Query Performance** | Linear scan O(n) | Indexed queries O(log n) |
| **MVP Scale** | <100 trips | >1000 trips |
| **Browser Support** | 100% | 97% (IE issues) |
| **Data Structure** | JSON strings | Native objects |

**Rationale:**
- MVP will have <50 trips per user → localStorage is sufficient
- Simple API reduces bugs and development time
- No complex queries needed initially (just load all trips)
- Storage abstraction layer makes migration to IndexedDB/API trivial later

**Migration Trigger:**
When users report performance issues with >200 trips, implement `IndexedDBTripRepository` with same interface.

---

## Data Migration & Versioning

### Version Key Strategy

Store a version key alongside data to handle schema changes.

```typescript
// localStorage keys:
// - 'plantrip_storage_version': '1.0'
// - 'plantrip_trips': '[{...}]'

class MigrationService {
  static async migrate(): Promise<void> {
    const version = localStorage.getItem('plantrip_storage_version');

    if (!version || version === '1.0') {
      // Already on latest version
      return;
    }

    // Example: migrate from 0.9 to 1.0
    if (version === '0.9') {
      const oldTrips = JSON.parse(localStorage.getItem('trips') || '[]');
      const newTrips = oldTrips.map((trip: any) => ({
        ...trip,
        status: trip.status || 'planning', // Add new required field
      }));
      localStorage.setItem('plantrip_trips', JSON.stringify(newTrips));
      localStorage.setItem('plantrip_storage_version', '1.0');
    }
  }
}
```

### Export/Import for Backup

```typescript
export class BackupService {
  static exportData(): string {
    const trips = localStorage.getItem('plantrip_trips') || '[]';
    const version = localStorage.getItem('plantrip_storage_version');

    return JSON.stringify({
      version,
      exportedAt: new Date().toISOString(),
      trips: JSON.parse(trips),
    }, null, 2);
  }

  static importData(jsonString: string): Result<void> {
    try {
      const data = JSON.parse(jsonString);
      localStorage.setItem('plantrip_trips', JSON.stringify(data.trips));
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }
}
```

---

## Type Definitions

**File:** `src/types/models.ts`

```typescript
export interface Country {
  code: string;
  name: string;
  colors: string[];
}

export interface Trip {
  id: string;
  name: string;
  countryCode: string;
  startDate: string | null;
  endDate: string | null;
  status: 'planning' | 'booked' | 'completed' | 'cancelled';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface City {
  id: string;
  name: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
  population: number | null;
  isCapital: boolean;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrainRoute {
  id: string;
  originCityId: string;
  destinationCityId: string;
  operator: string;
  routeName: string | null;
  durationMinutes: number;
  frequency: string;
  operatingDays: number[];
  approximateCost: number | null;
  bookingUrl: string | null;
  metadata: Record<string, any> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TripSegment {
  id: string;
  tripId: string;
  originCityId: string;
  destinationCityId: string;
  trainRouteId: string | null;
  departureDate: string | null;
  arrivalDate: string | null;
  sequenceOrder: number;
  bookingReference: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## Implementation Checklist

### Phase 1: MVP (Current)
- [ ] Create type definitions in `src/types/models.ts`
- [ ] Create repository interfaces in `src/lib/storage/interfaces/IRepository.ts`
- [ ] Implement `LocalStorageTripRepository`
- [ ] Create `StorageFactory` with dependency injection
- [ ] Build React hooks (`useTrips`, `useTrip`)
- [ ] Add migration service for future versioning
- [ ] Implement export/import backup functionality

### Phase 2: Backend Migration (Future)
- [ ] Implement `ApiTripRepository` with same interface
- [ ] Update `StorageFactory.setMode('api')`
- [ ] Add authentication headers to API calls
- [ ] Implement server-side validation
- [ ] Add optimistic updates for better UX
- [ ] Implement caching strategy (React Query/SWR)

### Phase 3: Advanced Features (Future)
- [ ] Add City, TrainRoute, TripSegment repositories
- [ ] Implement graph queries for train route planning
- [ ] Add real-time sync with WebSockets
- [ ] Offline-first with service workers
- [ ] Conflict resolution for multi-device sync

---

## API Design (Future Backend)

### REST Endpoints

```
GET    /api/trips              - List all trips (with filters)
GET    /api/trips/:id          - Get single trip
POST   /api/trips              - Create trip
PATCH  /api/trips/:id          - Update trip
DELETE /api/trips/:id          - Delete trip
POST   /api/trips/batch        - Bulk create
DELETE /api/trips/batch        - Bulk delete

GET    /api/cities             - List cities (with filters)
GET    /api/cities/:id/routes  - Get train routes from city

GET    /api/routes             - List train routes
GET    /api/routes/search      - Find routes between cities
```

### Example API Response

```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Summer Europe Tour",
    "countryCode": "FR",
    "startDate": "2026-07-01",
    "endDate": "2026-07-15",
    "status": "planning",
    "notes": "Visit Paris, Lyon, Marseille",
    "createdAt": "2026-02-17T10:30:00Z",
    "updatedAt": "2026-02-17T10:30:00Z"
  },
  "meta": {
    "requestId": "req_abc123"
  }
}
```

---

## Security Considerations

### Current (MVP - Client-side)
- No sensitive data stored (just trip plans)
- localStorage is isolated per origin
- No authentication needed

### Future (API Backend)
- JWT authentication with httpOnly cookies
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS policy for allowed origins
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitize user input in notes field)

---

## Performance Optimization

### localStorage Optimization
- Lazy load trips (only parse when needed)
- Debounce save operations (wait 300ms after last edit)
- Use `requestIdleCallback` for background saves

### API Optimization
- Implement pagination (e.g., 20 trips per page)
- Add caching headers (`Cache-Control`, `ETag`)
- Use React Query for automatic caching/invalidation
- Implement optimistic updates for instant UI feedback
- Add WebSocket for real-time updates across tabs

---

## Conclusion

This architecture provides:

1. **Clean Separation**: Business logic never touches storage details
2. **Easy Migration**: Swap `LocalStorageTripRepository` → `ApiTripRepository` in one line
3. **Type Safety**: Full TypeScript coverage with DTOs
4. **Error Handling**: Result types prevent uncaught exceptions
5. **Scalability**: Relational schema ready for complex queries
6. **Developer Experience**: Simple API for React components

The repository pattern ensures that when PlanTrip grows from an MVP to a full-scale app, the frontend code remains stable while the backend evolves independently.
