import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import MapboxMap from '../components/MapboxMap'
import SharedDaySection from '../components/SharedDaySection'
import BudgetSummary from '../components/BudgetSummary'
import { useAsyncLoad } from '../hooks/useAsyncLoad'
import { apiAdapter } from '../data/adapters/apiAdapter'
import { countries } from '../data/static/countries'
import { formatDateShort } from '../utils/date'
import { buildTimeline, normalizeNested } from '../utils/timeline'
import './SharedTrip.css'

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

function getViewerSessionId() {
  let id = localStorage.getItem('plantrip_viewer_session_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('plantrip_viewer_session_id', id)
  }
  return id
}

export default function SharedTrip() {
  const { token } = useParams()
  const { data, loading, error } = useAsyncLoad(() => apiAdapter.get(`/shared/${token}`), [token])
  const [countdown, setCountdown] = useState('')
  const [feedbackMode, setFeedbackMode] = useState(false)
  const [viewerName, setViewerName] = useState(() => localStorage.getItem('plantrip_viewer_name') || '')
  const [feedbackByActivity, setFeedbackByActivity] = useState({})
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => document.head.removeChild(meta)
  }, [])

  // Update countdown immediately when data loads, then every minute
  useEffect(() => {
    if (!data?.expiresAt) return
    setCountdown(formatExpiryCountdown(data.expiresAt))
    const interval = setInterval(() => {
      setCountdown(formatExpiryCountdown(data.expiresAt))
    }, 60000)
    return () => clearInterval(interval)
  }, [data?.expiresAt])

  const timeline = useMemo(() => {
    if (!data) return []
    return buildTimeline(normalizeNested(data))
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

  function handleViewerNameChange(name) {
    setViewerName(name)
    localStorage.setItem('plantrip_viewer_name', name)
  }

  const handleFeedback = useCallback(async (activityId, sentiment, message) => {
    if (feedbackSubmitting) return
    setFeedbackSubmitting(true)
    try {
      await apiAdapter.submitFeedback(token, {
        activityId,
        sentiment,
        message: message || '',
        viewerName: viewerName.trim() || 'Anonymous',
        viewerSessionId: getViewerSessionId(),
      })
      setFeedbackByActivity(prev => ({
        ...prev,
        [activityId]: { sentiment, message },
      }))
    } catch {
      // silently fail
    } finally {
      setFeedbackSubmitting(false)
    }
  }, [token, viewerName, feedbackSubmitting])

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
          <button
            className={`shared-feedback-toggle ${feedbackMode ? 'active' : ''}`}
            onClick={() => setFeedbackMode(v => !v)}
          >
            {feedbackMode ? 'Done' : 'Give Feedback'}
          </button>
          <span className="shared-expiry">{countdown}</span>
        </div>
      </header>

      {feedbackMode && (
        <div className="shared-feedback-bar">
          <label className="shared-feedback-name-label" htmlFor="viewer-name">Your name:</label>
          <input
            id="viewer-name"
            type="text"
            className="shared-feedback-name-input"
            value={viewerName}
            onChange={e => handleViewerNameChange(e.target.value)}
            placeholder="Anonymous"
            maxLength={100}
          />
        </div>
      )}

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
                    feedbackMode={feedbackMode}
                    feedbackByActivity={feedbackByActivity}
                    feedbackSubmitting={feedbackSubmitting}
                    onFeedback={handleFeedback}
                  />
                ))}
              </div>
            )}

            <BudgetSummary budget={data.budget} currency={data.currency} className="shared-budget-summary" />
          </div>
        </div>
      </div>
    </div>
  )
}
