import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import MapboxMap from '../components/MapboxMap'
import PhotoGallery from '../components/PhotoGallery'
import { apiAdapter } from '../data/adapters/apiAdapter'
import { useAsyncLoad } from '../hooks/useAsyncLoad'
import { formatPrice } from '../utils/currency'
import './ActivityDetail.css'

function formatRating(rating) {
  if (rating == null) return null
  const full = Math.floor(rating)
  const stars = []
  for (let i = 0; i < 3; i++) {
    stars.push(i < full ? '\u2605' : '\u2606')
  }
  return stars.join('')
}

export default function ActivityDetail() {
  const { tripId, activityId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const currency = location.state?.currency || 'EUR'
  const [activity, setActivity] = useState(null)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const { loading, error } = useAsyncLoad(async () => {
    const data = await apiAdapter.get(`/activities/${activityId}`)
    setActivity(data)

    // Auto-load photos if none exist
    if (!data.photos || data.photos.length === 0) {
      setPhotosLoading(true)
      try {
        const photos = await apiAdapter.post(`/activities/${activityId}/photos`)
        setActivity(prev => prev ? { ...prev, photos } : prev)
      } catch {
        // Photos unavailable
      } finally {
        setPhotosLoading(false)
      }
    }

    return data
  }, [activityId])


  const startEdit = (field, currentValue) => {
    setEditingField(field)
    setEditValue(currentValue || '')
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  const saveEdit = async () => {
    if (saving) return
    setSaving(true)
    try {
      let value = editValue
      if (editingField === 'price') {
        value = editValue !== '' ? parseFloat(editValue) : null
      }
      const updated = await apiAdapter.put(`/activities/${activityId}`, {
        [editingField]: value,
      })
      setActivity(prev => ({ ...prev, ...updated }))
      setEditingField(null)
      setEditValue('')
    } catch {
      // Save failed
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="activity-detail">
        <div className="activity-detail-loading">Loading...</div>
      </div>
    )
  }

  if (error || !activity) {
    return (
      <div className="activity-detail">
        <div className="activity-detail-error">
          <p>{error || 'Activity not found'}</p>
          <button className="btn-back" onClick={() => navigate(`/trip/${tripId}`)}>Back to trip</button>
        </div>
      </div>
    )
  }

  const hasPhotos = activity.photos && activity.photos.length > 0
  const categoryLabel = activity.category
    ? activity.category.split(',')[0].replace(/_/g, ' ')
    : null

  const infoFields = [
    { key: 'openingHours', label: 'Opening Hours', icon: '\u{1F552}' },
    { key: 'price', label: 'Price', icon: '\u{1F4B0}', type: 'number' },
    { key: 'address', label: 'Address', icon: '\u{1F4CD}' },
    { key: 'phone', label: 'Phone', icon: '\u{1F4DE}' },
  ]

  const guideFields = [
    { key: 'guideInfo', label: 'Guide', icon: '\u{1F4D6}' },
    { key: 'tips', label: 'Tips', icon: '\u{1F4A1}' },
    { key: 'transportInfo', label: 'Getting There', icon: '\u{1F68C}' },
  ]

  function renderEditableField(field, label, icon, multiline = false, fieldType = 'text') {
    const value = activity[field]
    const isEditing = editingField === field

    if (isEditing) {
      return (
        <div className="ad-field editing" key={field}>
          <span className="ad-field-icon">{icon}</span>
          <div className="ad-field-content">
            <label className="ad-field-label">{label}</label>
            {multiline ? (
              <textarea
                className="ad-field-input"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                rows={3}
                autoFocus
              />
            ) : (
              <input
                type={fieldType === 'number' ? 'number' : 'text'}
                className="ad-field-input"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                min={fieldType === 'number' ? '0' : undefined}
                step={fieldType === 'number' ? '0.01' : undefined}
                autoFocus
              />
            )}
            <div className="ad-field-actions">
              <button className="ad-btn-save" onClick={saveEdit} disabled={saving}>
                {saving ? '...' : 'Save'}
              </button>
              <button className="ad-btn-cancel" onClick={cancelEdit}>Cancel</button>
            </div>
          </div>
        </div>
      )
    }

    const displayValue = field === 'price' && value != null
      ? formatPrice(value, currency)
      : value

    return (
      <div className="ad-field" key={field} onClick={() => startEdit(field, value ?? '')}>
        <span className="ad-field-icon">{icon}</span>
        <div className="ad-field-content">
          <label className="ad-field-label">{label}</label>
          <span className={`ad-field-value ${!displayValue ? 'empty' : ''}`}>
            {displayValue || 'Click to add...'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="activity-detail">
      {/* Header */}
      <header className="ad-header">
        <button className="ad-back-btn" onClick={() => navigate(`/trip/${tripId}`)}>
          &larr;
        </button>
        <div className="ad-header-center">
          <h1 className="ad-title">{activity.title}</h1>
          <div className="ad-header-meta">
            {categoryLabel && <span className="ad-category-badge">{categoryLabel}</span>}
            {activity.rating != null && (
              <span className="ad-rating">{formatRating(activity.rating)}</span>
            )}
          </div>
        </div>
      </header>

      <div className="ad-body">
        {/* Photo Gallery */}
        <div className="ad-photo-section">
          {hasPhotos ? (
            <PhotoGallery photos={activity.photos} />
          ) : photosLoading ? (
            <div className="ad-photo-placeholder">
              <p className="ad-photo-hint">Loading photos...</p>
            </div>
          ) : null}
        </div>

        {/* Info Section */}
        <div className="ad-section">
          <h3 className="ad-section-title">Info</h3>
          <div className="ad-fields">
            {infoFields.map(f => renderEditableField(f.key, f.label, f.icon, false, f.type))}
            {activity.websiteUrl && (
              <div className="ad-field">
                <span className="ad-field-icon">{'\u{1F310}'}</span>
                <div className="ad-field-content">
                  <label className="ad-field-label">Website</label>
                  <a
                    className="ad-field-link"
                    href={activity.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {activity.websiteUrl}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Guide Section */}
        <div className="ad-section">
          <h3 className="ad-section-title">Guide</h3>
          <div className="ad-fields">
            {guideFields.map(f => renderEditableField(f.key, f.label, f.icon, true))}
          </div>
        </div>

        {/* Notes Section */}
        <div className="ad-section">
          <h3 className="ad-section-title">Notes</h3>
          {renderEditableField('notes', 'Notes', '\u{1F4DD}', true)}
        </div>

        {/* Mini Map */}
        {activity.lng != null && activity.lat != null && (
          <div className="ad-section">
            <h3 className="ad-section-title">Location</h3>
            <div className="ad-mini-map">
              <MapboxMap
                countryName=""
                stops={[{ id: activityId, name: activity.title, lng: activity.lng, lat: activity.lat, sortIndex: 0 }]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
