import { useEffect, useMemo } from 'react'
import { useItineraryStore } from '../stores/itineraryStore'

export function useItinerary(tripId) {
  const stops = useItineraryStore(s => s.stops)
  const movements = useItineraryStore(s => s.movements)
  const activities = useItineraryStore(s => s.activities)
  const isLoading = useItineraryStore(s => s.isLoading)
  const loadItinerary = useItineraryStore(s => s.loadItinerary)
  const addStop = useItineraryStore(s => s.addStop)
  const updateStop = useItineraryStore(s => s.updateStop)
  const removeStop = useItineraryStore(s => s.removeStop)
  const reorderStop = useItineraryStore(s => s.reorderStop)
  const addMovement = useItineraryStore(s => s.addMovement)
  const updateMovement = useItineraryStore(s => s.updateMovement)
  const removeMovement = useItineraryStore(s => s.removeMovement)
  const addActivity = useItineraryStore(s => s.addActivity)
  const updateActivity = useItineraryStore(s => s.updateActivity)
  const removeActivity = useItineraryStore(s => s.removeActivity)
  const reorderActivity = useItineraryStore(s => s.reorderActivity)

  useEffect(() => {
    if (tripId) loadItinerary(tripId)
  }, [tripId, loadItinerary])

  const itinerary = useMemo(() => {
    const movementByFromStop = Object.fromEntries(
      movements.map(m => [m.fromStopId, m])
    )
    const activitiesByStop = {}
    for (const a of activities) {
      if (!activitiesByStop[a.tripStopId]) activitiesByStop[a.tripStopId] = []
      activitiesByStop[a.tripStopId].push(a)
    }
    // Sort activities within each stop
    for (const key of Object.keys(activitiesByStop)) {
      activitiesByStop[key].sort((a, b) => a.sortIndex - b.sortIndex)
    }

    return stops
      .toSorted((a, b) => a.sortIndex - b.sortIndex)
      .map(stop => ({
        stop,
        activities: activitiesByStop[stop.id] || [],
        movementToNext: movementByFromStop[stop.id] || null,
      }))
  }, [stops, movements, activities])

  return {
    stops,
    movements,
    activities,
    itinerary,
    isLoading,
    addStop,
    updateStop,
    removeStop,
    reorderStop,
    addMovement,
    updateMovement,
    removeMovement,
    addActivity,
    updateActivity,
    removeActivity,
    reorderActivity,
  }
}
