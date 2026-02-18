import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import MapboxMap from '../components/MapboxMap'
import SharedDaySection from '../components/SharedDaySection'
import { apiAdapter } from '../data/adapters/apiAdapter'
import { countries } from '../data/static/countries'
import { formatPrice } from '../utils/currency'
import './SharedTrip.css'

function buildTimeline(data) {
  if (!data.startDate || data.stops.length === 0) return []

  const sorted = [...data.stops].sort((a, b) => a.stop.sortIndex - b.stop.sortIndex)
  const movementByFrom = {}
  for (const entry of sorted) {
    if (entry.movementToNext) {
      movementByFrom[entry.stop.id] = entry.movementToNext
    }
  }

  const actByKey = {}
  for (const entry of sorted) {
    for (const a of entry.activities) {
      const key = `${entry.stop.id}|${a.date || 'none'}`
      ;(actByKey[key] ??= []).push(a)
    }
  }
  for (const arr of Object.values(actByKey)) {
    arr.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '') || a.sortIndex - b.sortIndex)
  }

  const days = []
  let dayNum = 1
  const start = new Date(data.startDate + 'T00:00:00')

  for (let si = 0; si < sorted.length; si++) {
    const stop = sorted[si].stop
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
        totalStops: sorted.length,
        isFirstDayOfStop: isFirst,
        isLastDayOfStop: isLast,
        activities: [
          ...(actByKey[`${stop.id}|${dateStr}`] || []),
          ...(isFirst ? (actByKey[`${stop.id}|none`] || []) : []),
        ],
        movementAfter: isLast && si < sorted.length - 1
          ? { movement: movementByFrom[stop.id] || null, fromStop: stop }
          : null,
      })
      dayNum++
    }
  }
  return days
}

function formatExpiryCountdown(expiresAt) {
  const now = new Date()
  const exp = new Date(expiresAt)
  const diffMs = exp - now
  if (diffMs <= 0) return 'Expired'

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) return `Expires in ${hours}h ${minutes}m`
  return `Expires in ${minutes}m`
}

function formatDateShort(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

export default function SharedTrip() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => document.head.removeChild(meta)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function fetchShared() {
      try {
        const result = await apiAdapter.get(`/shared/${token}`)
        if (!cancelled) {
          setData(result)
          setCountdown(formatExpiryCountdown(result.expiresAt))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'This share link is invalid or has expired')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchShared()
    return () => { cancelled = true }
  }, [token])

  // Update countdown every minute
  useEffect(() => {
    if (!data?.expiresAt) return
    const interval = setInterval(() => {
      setCountdown(formatExpiryCountdown(data.expiresAt))
    }, 60000)
    return () => clearInterval(interval)
  }, [data?.expiresAt])

  const timeline = useMemo(() => {
    if (!data) return []
    return buildTimeline(data)
  }, [data])

  const stops = useMemo(() => {
    if (!data) return []
    return data.stops.map(s => s.stop)
  }, [data])

  const movements = useMemo(() => {
    if (!data) return []
    return data.stops.map(s => s.movementToNext).filter(Boolean)
  }, [data])

  const geoActivities = useMemo(() => {
    if (!data) return []
    return data.stops.flatMap(s => s.activities).filter(a => a.lng != null && a.lat != null)
  }, [data])

  if (loading) {
    return (
      <div className="shared-trip">
        <div className="shared-trip-loading">
          <div className="shared-loading-spinner" />
          <p>Loading shared trip...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="shared-trip">
        <div className="shared-trip-error">
          <div className="shared-error-icon">!</div>
          <h2>Link unavailable</h2>
          <p>{error}</p>
          <p className="shared-error-hint">This link may have expired or been revoked by the trip owner.</p>
        </div>
      </div>
    )
  }

  const country = countries.find(c => c.code === data.countryCode)
  const dateRange = (data.startDate || data.endDate)
    ? [formatDateShort(data.startDate), formatDateShort(data.endDate)].filter(Boolean).join(' \u2013 ')
    : null

  return (
    <div className="shared-trip">
      <header className="shared-trip-header">
        <div className="shared-header-left">
          <span className="shared-badge">Shared trip (read-only)</span>
        </div>
        <div className="shared-header-center">
          <span className="shared-trip-name">{data.tripName}</span>
          <span className={`shared-trip-status status-${data.status}`}>{data.status}</span>
          {dateRange && <span className="shared-trip-dates">{dateRange}</span>}
        </div>
        <div className="shared-header-right">
          <span className="shared-expiry">{countdown}</span>
        </div>
      </header>

      <div className="shared-trip-content">
        <div className="shared-trip-map">
          <MapboxMap
            countryName={country?.name || ''}
            stops={stops}
            movements={movements}
            activities={geoActivities}
          />
        </div>

        <div className="shared-trip-itinerary">
          <div className="shared-itinerary-header">
            <h2 className="shared-itinerary-title">
              Itinerary
              {timeline.length > 0 && (
                <span className="shared-itinerary-count">
                  {timeline.length} {timeline.length === 1 ? 'day' : 'days'}
                </span>
              )}
            </h2>
          </div>

          <div className="shared-itinerary-body">
            {timeline.length === 0 ? (
              <div className="shared-itinerary-empty">
                <p>No stops in this trip yet</p>
              </div>
            ) : (
              <div className="shared-itinerary-list">
                {timeline.map(day => (
                  <SharedDaySection
                    key={`${day.stopId}-${day.dayNumber}`}
                    day={day}
                    currency={data.currency}
                  />
                ))}
              </div>
            )}

            {data.budget && data.budget.grandTotal > 0 && (
              <div className="shared-budget-summary">
                <h3 className="shared-budget-title">Budget</h3>
                {data.budget.activitiesTotal > 0 && (
                  <div className="shared-budget-row">
                    <span>Activities</span>
                    <span>{formatPrice(data.budget.activitiesTotal, data.currency)}</span>
                  </div>
                )}
                {data.budget.accommodationTotal > 0 && (
                  <div className="shared-budget-row">
                    <span>Accommodation</span>
                    <span>{formatPrice(data.budget.accommodationTotal, data.currency)}</span>
                  </div>
                )}
                {data.budget.transportTotal > 0 && (
                  <div className="shared-budget-row">
                    <span>Transport</span>
                    <span>{formatPrice(data.budget.transportTotal, data.currency)}</span>
                  </div>
                )}
                <div className="shared-budget-row shared-budget-total">
                  <span>Total</span>
                  <span>{formatPrice(data.budget.grandTotal, data.currency)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
