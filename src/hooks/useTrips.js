import { useEffect, useCallback } from 'react'
import { useTripStore } from '../stores/tripStore'

export function useTrips() {
  const trips = useTripStore(s => s.trips)
  const isLoading = useTripStore(s => s.isLoading)
  const error = useTripStore(s => s.error)
  const loadTrips = useTripStore(s => s.loadTrips)
  const createTrip = useTripStore(s => s.createTrip)
  const updateTrip = useTripStore(s => s.updateTrip)
  const deleteTrip = useTripStore(s => s.deleteTrip)
  const clearError = useTripStore(s => s.clearError)

  useEffect(() => {
    loadTrips()
  }, [loadTrips])

  const findByCountry = useCallback(
    (countryCode) => trips.find(t => t.countryCode === countryCode) || null,
    [trips]
  )

  return { trips, isLoading, error, loadTrips, createTrip, updateTrip, deleteTrip, clearError, findByCountry }
}
