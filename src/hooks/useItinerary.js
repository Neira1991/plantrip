import { useEffect, useMemo } from 'react'
import { useItineraryStore } from '../stores/itineraryStore'
import { buildTimeline, normalizeFlat } from '../utils/timeline'

export function useItinerary(tripId, tripStartDate) {
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

  const budget = useMemo(() => {
    const activitiesTotal = activities.reduce((sum, a) => sum + (a.price || 0), 0)
    const accommodationTotal = stops.reduce((sum, s) => sum + (s.pricePerNight || 0) * (s.nights || 1), 0)
    const transportTotal = movements.reduce((sum, m) => sum + (m.price || 0), 0)
    return {
      activitiesTotal,
      accommodationTotal,
      transportTotal,
      grandTotal: activitiesTotal + accommodationTotal + transportTotal,
    }
  }, [stops, movements, activities])

  const timeline = useMemo(() => {
    if (!tripStartDate || stops.length === 0) return []
    return buildTimeline(normalizeFlat(tripStartDate, stops, movements, activities))
  }, [stops, movements, activities, tripStartDate])

  return {
    stops,
    movements,
    activities,
    itinerary,
    timeline,
    budget,
    isLoading,
    loadItinerary,
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
