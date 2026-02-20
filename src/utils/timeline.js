/**
 * Build a day-by-day timeline from trip data.
 *
 * Accepts a normalized shape so it works for both:
 *   - useItinerary (flat arrays: stops[], movements[], activities[])
 *   - SharedTrip    (nested data: stops[{ stop, activities, movementToNext }])
 *
 * @param {object} params
 * @param {string} params.startDate        - Trip start date (YYYY-MM-DD)
 * @param {Array}  params.stops            - Sorted stop objects with { id, name, lng, lat, sortIndex, nights, pricePerNight }
 * @param {object} params.movementByFromId - Map of fromStopId -> movement object
 * @param {object} params.activitiesByKey  - Map of "stopId|date" -> sorted activity array (use "stopId|none" for undated)
 * @returns {Array} timeline days
 */
export function buildTimeline({ startDate, stops, movementByFromId, activitiesByKey }) {
  if (!startDate || stops.length === 0) return []

  const days = []
  let dayNum = 1
  const start = new Date(startDate + 'T00:00:00')

  for (let si = 0; si < stops.length; si++) {
    const stop = stops[si]
    for (let n = 0; n < stop.nights; n++) {
      const d = new Date(start)
      d.setDate(start.getDate() + dayNum - 1)
      const dateStr = d.toISOString().split('T')[0]
      const isFirst = n === 0
      const isLast = n === stop.nights - 1

      days.push({
        dayNumber: dayNum,
        date: dateStr,
        stopId: stop.id,
        stopName: stop.name,
        stopLng: stop.lng,
        stopLat: stop.lat,
        stopSortIndex: stop.sortIndex,
        nights: stop.nights,
        pricePerNight: stop.pricePerNight,
        totalStops: stops.length,
        isFirstDayOfStop: isFirst,
        isLastDayOfStop: isLast,
        activities: [
          ...(activitiesByKey[`${stop.id}|${dateStr}`] || []),
          ...(isFirst ? (activitiesByKey[`${stop.id}|none`] || []) : []),
        ],
        movementAfter: isLast && si < stops.length - 1
          ? { movement: movementByFromId[stop.id] || null, fromStop: stop }
          : null,
      })
      dayNum++
    }
  }
  return days
}

/**
 * Normalize flat arrays (useItinerary shape) into the params expected by buildTimeline.
 */
export function normalizeFlat(tripStartDate, stops, movements, activities) {
  const sorted = stops.toSorted((a, b) => a.sortIndex - b.sortIndex)
  const movementByFromId = Object.fromEntries(movements.map(m => [m.fromStopId, m]))

  const activitiesByKey = {}
  for (const a of activities) {
    const key = `${a.tripStopId}|${a.date || 'none'}`
    ;(activitiesByKey[key] ??= []).push(a)
  }
  for (const arr of Object.values(activitiesByKey)) {
    arr.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '') || a.sortIndex - b.sortIndex)
  }

  return { startDate: tripStartDate, stops: sorted, movementByFromId, activitiesByKey }
}

/**
 * Normalize nested data (SharedTrip shape) into the params expected by buildTimeline.
 */
export function normalizeNested(data) {
  const sorted = [...data.stops].sort((a, b) => a.stop.sortIndex - b.stop.sortIndex)

  const movementByFromId = {}
  for (const entry of sorted) {
    if (entry.movementToNext) {
      movementByFromId[entry.stop.id] = entry.movementToNext
    }
  }

  const activitiesByKey = {}
  for (const entry of sorted) {
    for (const a of entry.activities) {
      const key = `${entry.stop.id}|${a.date || 'none'}`
      ;(activitiesByKey[key] ??= []).push(a)
    }
  }
  for (const arr of Object.values(activitiesByKey)) {
    arr.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '') || a.sortIndex - b.sortIndex)
  }

  const stops = sorted.map(e => e.stop)
  return { startDate: data.startDate, stops, movementByFromId, activitiesByKey }
}
