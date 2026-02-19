import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import MapboxMap from '../components/MapboxMap'
import CityAutocomplete from '../components/CityAutocomplete'
import ItineraryPanel from '../components/ItineraryPanel'
import DeleteConfirm from '../components/TripsPanel/DeleteConfirm'
import { useTrips } from '../hooks/useTrips'
import { useItinerary } from '../hooks/useItinerary'
import { apiAdapter } from '../data/adapters/apiAdapter'
import { countries } from '../data/static/countries'
import { CURRENCY_OPTIONS } from '../utils/currency'
import './TripDetail.css'

function formatDateShort(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

function formatDateFull(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  })
}

export default function TripDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { trips, createTrip, updateTrip, deleteTrip, loadTrips } = useTrips()

  const isNew = id === 'new'
  const countryParam = searchParams.get('country')

  const trip = !isNew ? trips.find(t => t.id === id) : null
  const country = countries.find(c => c.code === (trip?.countryCode || countryParam)) || null

  const tripId = trip?.id || null
  const {
    itinerary,
    timeline,
    budget,
    stops,
    movements,
    activities,
    loadItinerary,
    addStop,
    updateStop,
    removeStop,
    reorderStop,
    addActivity,
    updateActivity,
    removeActivity,
    addMovement,
    updateMovement,
    removeMovement,
  } = useItinerary(tripId, trip?.startDate)

  const [mode, setMode] = useState(isNew ? 'edit' : 'view')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('planning')
  const [notes, setNotes] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showCitySearch, setShowCitySearch] = useState(false)
  const [showItinerary, setShowItinerary] = useState(false)
  const [toast, setToast] = useState(null)
  const [sharePopup, setSharePopup] = useState(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [showAiPrompt, setShowAiPrompt] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState(null)
  useEffect(() => {
    if (trip) {
      setName(trip.name || '')
      setStartDate(trip.startDate || '')
      setEndDate(trip.endDate || '')
      setStatus(trip.status || 'planning')
      setNotes(trip.notes || '')
      setCurrency(trip.currency || 'EUR')
    } else if (isNew && country) {
      setName(`${country.name} Trip`)
      setStartDate('')
      setEndDate('')
      setStatus('planning')
      setNotes('')
      setCurrency('EUR')
    }
  }, [trip, isNew, country])

  if (!isNew && !trip && trips.length > 0) {
    return (
      <div className="trip-detail">
        <div className="trip-detail-not-found">
          <p>Trip not found</p>
          <button className="btn-back-link" onClick={() => navigate('/')}>← Back home</button>
        </div>
      </div>
    )
  }

  if (!country) {
    return (
      <div className="trip-detail">
        <div className="trip-detail-not-found">
          <p>No country selected</p>
          <button className="btn-back-link" onClick={() => navigate('/')}>← Back home</button>
        </div>
      </div>
    )
  }

  const dateRange = (trip?.startDate || trip?.endDate)
    ? [formatDateShort(trip?.startDate), formatDateShort(trip?.endDate)].filter(Boolean).join(' – ')
    : null

  function validate() {
    const errs = {}
    if (!startDate) {
      errs.startDate = 'Start date is required'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const data = {
        countryCode: country.code,
        name: name.trim() || `${country.name} Trip`,
        startDate: startDate || null,
        status,
        notes: notes.trim(),
        currency,
      }
      if (isNew) {
        const created = await createTrip(data)
        navigate(`/trip/${created.id}`, { replace: true })
      } else {
        await updateTrip(trip.id, data)
      }
      setMode('view')
    } catch {
      // error handled by store
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (isNew) {
      navigate('/')
    } else {
      setName(trip.name || '')
      setStartDate(trip.startDate || '')
      setEndDate(trip.endDate || '')
      setStatus(trip.status || 'planning')
      setNotes(trip.notes || '')
      setCurrency(trip.currency || 'EUR')
      setErrors({})
      setShowDelete(false)
      setMode('view')
    }
  }

  async function handleDelete() {
    await deleteTrip(trip.id)
    navigate('/')
  }

  async function handleAddStop(city) {
    await addStop(tripId, {
      name: city.name,
      lng: city.lng,
      lat: city.lat,
    })
    await loadTrips() // Refresh trip to get updated end_date
  }

  async function handleUpdateStopNights(stopId, nights) {
    await updateStop(stopId, { nights })
    await loadTrips() // Refresh trip to get updated end_date
  }

  async function handleUpdateStopPrice(stopId, pricePerNight) {
    await updateStop(stopId, { pricePerNight })
  }

  async function handleRemoveStop(tripId, stopId) {
    await removeStop(tripId, stopId)
    await loadTrips() // Refresh trip to get updated end_date
  }

  async function handleReorderStop(tid, fromIndex, toIndex) {
    const result = await reorderStop(tid, fromIndex, toIndex)
    if (result?.movementsCleared) {
      showToast('Transport segments cleared — re-add them for the new order')
    }
  }

  function showToast(message) {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleShare() {
    if (shareLoading) return
    setShareLoading(true)
    try {
      const result = await apiAdapter.post(`/trips/${tripId}/share`)
      const shareUrl = `${window.location.origin}/shared/${result.token}`
      try {
        await navigator.clipboard.writeText(shareUrl)
        setSharePopup({ url: shareUrl, copied: true })
      } catch {
        setSharePopup({ url: shareUrl, copied: false })
      }
    } catch (err) {
      showToast('Failed to create share link')
    } finally {
      setShareLoading(false)
    }
  }

  async function handleRevokeShare() {
    try {
      await apiAdapter.del(`/trips/${tripId}/share`)
      setSharePopup(null)
      showToast('Share link revoked')
    } catch {
      showToast('Failed to revoke share link')
    }
  }

  async function handleCopyShareUrl() {
    if (!sharePopup?.url) return
    try {
      await navigator.clipboard.writeText(sharePopup.url)
      setSharePopup(prev => ({ ...prev, copied: true }))
    } catch {
      // Clipboard not available
    }
  }

  async function handleGenerate() {
    if (aiGenerating) return
    setAiGenerating(true)
    setAiError(null)
    try {
      await apiAdapter.post(`/trips/${tripId}/generate`, { prompt: aiPrompt })
      await loadItinerary(tripId)
      await loadTrips()
      setShowAiPrompt(false)
      setAiPrompt('')
      setShowItinerary(true)
      showToast('Itinerary generated!')
    } catch (err) {
      setAiError(err.message || 'Failed to generate itinerary')
    } finally {
      setAiGenerating(false)
    }
  }

  return (
    <div className="trip-detail">
      {/* ── Header ── */}
      <header className="trip-detail-header">
        <button className="btn-header-icon" onClick={() => navigate('/')} title="Home" data-testid="btn-home">
          ←
        </button>

        <div className="trip-header-center">
          <span className="trip-header-name" data-testid="trip-header-name">{trip?.name || name}</span>
          <span className={`trip-header-status status-${trip?.status || status}`} data-testid="trip-header-status">
            {trip?.status || status}
          </span>
          {dateRange && <span className="trip-header-dates">{dateRange}</span>}
        </div>

        <div className="trip-header-actions">
          {!isNew && (
            <button
              className="btn-header-icon"
              onClick={() => setShowItinerary(v => !v)}
              title="Itinerary"
              data-testid="btn-open-itinerary"
            >
              📍{stops.length > 0 && <span className="cities-badge">{stops.length}</span>}
            </button>
          )}

          {mode === 'view' && !isNew && (
            <button
              className="btn-header-icon"
              onClick={() => setShowAiPrompt(true)}
              title="AI Generate"
              data-testid="btn-ai-generate"
            >
              AI
            </button>
          )}

          {mode === 'view' && !isNew && (
            <button
              className="btn-header-icon"
              onClick={handleShare}
              title="Share trip"
              data-testid="btn-share-trip"
              disabled={shareLoading}
            >
              {shareLoading ? '...' : '\u{1F517}'}
            </button>
          )}

          {mode === 'view' && !isNew && (
            <button className="btn-header-icon" onClick={() => setMode('edit')} title="Edit trip" data-testid="btn-edit-trip">
              ✏️
            </button>
          )}
        </div>
      </header>

      {/* ── Content area (map + optional itinerary) ── */}
      <div className="trip-detail-content">
        <div className="trip-detail-map">
          <MapboxMap
            countryName={country.name}
            stops={stops}
            movements={movements}
            activities={activities.filter(a => a.lng != null && a.lat != null)}
          />
        </div>

        {showItinerary && (
          <ItineraryPanel
            timeline={timeline}
            tripId={tripId}
            currency={trip?.currency || currency}
            budget={budget}
            onClose={() => setShowItinerary(false)}
            onReorderStop={handleReorderStop}
            onRemoveStop={handleRemoveStop}
            onAddActivity={addActivity}
            onUpdateActivity={updateActivity}
            onRemoveActivity={removeActivity}
            onSaveMovement={addMovement}
            onUpdateMovement={updateMovement}
            onDeleteMovement={removeMovement}
            onUpdateNights={handleUpdateStopNights}
            onUpdateStopPrice={handleUpdateStopPrice}
            onOpenCitySearch={() => { setShowItinerary(false); setShowCitySearch(true) }}
            toast={toast}
          />
        )}
      </div>

      {/* ── Edit overlay ── */}
      {mode === 'edit' && (
        <div className="trip-edit-overlay" onClick={handleCancel}>
          <div className="trip-edit-card" onClick={e => e.stopPropagation()}>
            <div className="form-field">
              <label className="form-label" htmlFor="trip-name">Trip Name</label>
              <input
                id="trip-name"
                type="text"
                className="form-input"
                data-testid="trip-name-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Summer in Paris"
                maxLength={200}
                autoFocus
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="trip-status">Status</label>
              <select
                id="trip-status"
                className="form-input"
                data-testid="trip-status-select"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="planning">Planning</option>
                <option value="booked">Booked</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="trip-currency">Currency</label>
              <select
                id="trip-currency"
                className="form-input"
                data-testid="trip-currency-select"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              >
                {CURRENCY_OPTIONS.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="trip-start-date">Start Date *</label>
              <input
                id="trip-start-date"
                type="date"
                className={`form-input ${errors.startDate ? 'error' : ''}`}
                data-testid="trip-start-date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setErrors(prev => ({ ...prev, startDate: null })) }}
                required
              />
              {errors.startDate && <span className="form-error-message">{errors.startDate}</span>}
            </div>

            {!isNew && trip?.endDate && (
              <div className="form-field">
                <label className="form-label">End Date</label>
                <div className="form-readonly" data-testid="trip-end-date-display">
                  {formatDateFull(trip.endDate)}
                  <span className="form-readonly-hint">Computed from stops and nights</span>
                </div>
              </div>
            )}

            <div className="form-field">
              <label className="form-label" htmlFor="trip-notes">Notes</label>
              <textarea
                id="trip-notes"
                className="form-input form-textarea"
                data-testid="trip-notes-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any details about your trip..."
                rows={3}
                maxLength={10000}
              />
            </div>

            {!isNew && (
              <div className="form-field">
                {!showDelete ? (
                  <button type="button" className="delete-trip-link" data-testid="btn-delete-trip" onClick={() => setShowDelete(true)}>
                    Delete trip
                  </button>
                ) : (
                  <DeleteConfirm onConfirm={handleDelete} onCancel={() => setShowDelete(false)} />
                )}
              </div>
            )}

            <div className="trip-edit-actions">
              <button type="button" className="btn-cancel" data-testid="btn-cancel-edit" onClick={handleCancel}>Cancel</button>
              <button type="button" className="btn-save" data-testid="btn-save-trip" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : isNew ? 'Create Trip' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── City search overlay ── */}
      {showCitySearch && (
        <CityAutocomplete
          countryCode={country.code}
          onSelect={handleAddStop}
          onClose={() => setShowCitySearch(false)}
        />
      )}

      {/* ── Share popup ── */}
      {sharePopup && (
        <div className="share-popup-overlay" onClick={() => setSharePopup(null)}>
          <div className="share-popup-card" onClick={e => e.stopPropagation()}>
            <h3 className="share-popup-title">Share link created</h3>
            <p className="share-popup-expiry">Expires in 24 hours</p>
            <div className="share-popup-url-row">
              <input
                type="text"
                className="share-popup-url"
                value={sharePopup.url}
                readOnly
                onClick={e => e.target.select()}
              />
              <button className="share-popup-copy-btn" onClick={handleCopyShareUrl}>
                {sharePopup.copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="share-popup-actions">
              <button className="share-popup-revoke" onClick={handleRevokeShare}>Revoke link</button>
              <button className="share-popup-close" onClick={() => setSharePopup(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showAiPrompt && (
        <div className="ai-prompt-overlay" onClick={() => !aiGenerating && setShowAiPrompt(false)}>
          <div className="ai-prompt-card" onClick={e => e.stopPropagation()}>
            <h3 className="ai-prompt-title">Generate Itinerary with AI</h3>
            <p className="ai-prompt-description">Describe your ideal trip and AI will create a complete itinerary.</p>
            <textarea
              className="ai-prompt-textarea"
              data-testid="ai-prompt-input"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g., 10 days, Rome → Florence → Venice, focus on history and food, moderate budget"
              maxLength={2000}
              autoFocus
              disabled={aiGenerating}
              rows={4}
            />
            {aiError && <p className="ai-prompt-error" data-testid="ai-prompt-error">{aiError}</p>}
            {aiGenerating ? (
              <div className="ai-prompt-loading">
                <div className="ai-prompt-spinner" />
                <span>Generating your itinerary...</span>
              </div>
            ) : (
              <div className="ai-prompt-actions">
                <button className="btn-cancel" onClick={() => setShowAiPrompt(false)}>Cancel</button>
                <button
                  className="btn-save"
                  data-testid="btn-ai-submit"
                  onClick={handleGenerate}
                  disabled={!aiPrompt.trim()}
                >
                  Generate
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
