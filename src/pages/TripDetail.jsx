import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import MapboxMap from '../components/MapboxMap'
import CityAutocomplete from '../components/CityAutocomplete'
import ItineraryPanel from '../components/ItineraryPanel'
import DeleteConfirm from '../components/TripsPanel/DeleteConfirm'
import { useTrips } from '../hooks/useTrips'
import { useItinerary } from '../hooks/useItinerary'
import { countries } from '../data/static/countries'
import './TripDetail.css'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

export default function TripDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { trips, createTrip, updateTrip, deleteTrip } = useTrips()

  const isNew = id === 'new'
  const countryParam = searchParams.get('country')

  const trip = !isNew ? trips.find(t => t.id === id) : null
  const country = countries.find(c => c.code === (trip?.countryCode || countryParam)) || null

  const tripId = trip?.id || null
  const {
    itinerary,
    stops,
    movements,
    addStop,
    removeStop,
    reorderStop,
    addActivity,
    updateActivity,
    removeActivity,
    addMovement,
    removeMovement,
  } = useItinerary(tripId)

  const [mode, setMode] = useState(isNew ? 'edit' : 'view')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('planning')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showCitySearch, setShowCitySearch] = useState(false)
  const [showItinerary, setShowItinerary] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (trip) {
      setName(trip.name || '')
      setStartDate(trip.startDate || '')
      setEndDate(trip.endDate || '')
      setStatus(trip.status || 'planning')
      setNotes(trip.notes || '')
    } else if (isNew && country) {
      setName(`${country.name} Trip`)
      setStartDate('')
      setEndDate('')
      setStatus('planning')
      setNotes('')
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
    ? [formatDate(trip?.startDate), formatDate(trip?.endDate)].filter(Boolean).join(' – ')
    : null

  function validate() {
    const errs = {}
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      errs.endDate = 'End date must be after start date'
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
        endDate: endDate || null,
        status,
        notes: notes.trim(),
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

  return (
    <div className="trip-detail">
      {/* ── Header ── */}
      <header className="trip-detail-header">
        <button className="btn-header-icon" onClick={() => navigate('/')} title="Home">
          ←
        </button>

        <div className="trip-header-center">
          <span className="trip-header-name">{trip?.name || name}</span>
          <span className={`trip-header-status status-${trip?.status || status}`}>
            {trip?.status || status}
          </span>
          {dateRange && <span className="trip-header-dates">{dateRange}</span>}
        </div>

        <div className="trip-header-actions">
          {!isNew && (
            <button
              className="btn-header-icon"
              onClick={() => setShowItinerary(true)}
              title="Itinerary"
            >
              📍{stops.length > 0 && <span className="cities-badge">{stops.length}</span>}
            </button>
          )}

          {mode === 'view' && !isNew && (
            <button className="btn-header-icon" onClick={() => setMode('edit')} title="Edit trip">
              ✏️
            </button>
          )}
        </div>
      </header>

      {/* ── Map (fills remaining space) ── */}
      <div className="trip-detail-map">
        <MapboxMap
          countryName={country.name}
          stops={stops}
          movements={movements}
        />
      </div>

      {/* ── Itinerary panel ── */}
      {showItinerary && (
        <ItineraryPanel
          itinerary={itinerary}
          tripId={tripId}
          onClose={() => setShowItinerary(false)}
          onReorderStop={handleReorderStop}
          onRemoveStop={removeStop}
          onAddActivity={addActivity}
          onUpdateActivity={updateActivity}
          onRemoveActivity={removeActivity}
          onSaveMovement={addMovement}
          onDeleteMovement={removeMovement}
          onOpenCitySearch={() => { setShowItinerary(false); setShowCitySearch(true) }}
          toast={toast}
        />
      )}

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
              <label className="form-label">Dates</label>
              <div className="date-range">
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
                <span className="date-separator">–</span>
                <input
                  type="date"
                  className={`form-input ${errors.endDate ? 'error' : ''}`}
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); setErrors(prev => ({ ...prev, endDate: null })) }}
                />
              </div>
              {errors.endDate && <span className="form-error-message">{errors.endDate}</span>}
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="trip-notes">Notes</label>
              <textarea
                id="trip-notes"
                className="form-input form-textarea"
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
                  <button type="button" className="delete-trip-link" onClick={() => setShowDelete(true)}>
                    Delete trip
                  </button>
                ) : (
                  <DeleteConfirm onConfirm={handleDelete} onCancel={() => setShowDelete(false)} />
                )}
              </div>
            )}

            <div className="trip-edit-actions">
              <button type="button" className="btn-cancel" onClick={handleCancel}>Cancel</button>
              <button type="button" className="btn-save" onClick={handleSave} disabled={saving}>
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
    </div>
  )
}
