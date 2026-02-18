import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatPrice } from '../utils/currency'
import './ActivityItem.css'

function formatTime(timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function formatDuration(minutes) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h${m}m` : `${h}h`
}

export default function ActivityItem({ activity, onUpdate, onRemove, onDelete, tripId, currency }) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(activity.title)
  const [startTime, setStartTime] = useState(activity.startTime || '')
  const [durationMinutes, setDurationMinutes] = useState(activity.durationMinutes || '')
  const [price, setPrice] = useState(activity.price ?? '')

  // Support both onRemove and onDelete for backwards compatibility
  const handleRemove = onRemove || onDelete

  const handleSave = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    onUpdate({
      title: trimmed,
      startTime: startTime || null,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
      price: price !== '' ? parseFloat(price) : null,
    })
    setEditing(false)
  }

  const handleCancel = () => {
    setTitle(activity.title)
    setStartTime(activity.startTime || '')
    setDurationMinutes(activity.durationMinutes || '')
    setPrice(activity.price ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="activity-item editing" data-testid="activity-item">
        <div className="activity-edit-main">
          <input
            type="text"
            className="activity-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
            maxLength={200}
            autoFocus
            data-testid="activity-title-input"
          />
        </div>
        <div className="activity-time-fields">
          <input
            type="time"
            className="activity-time-input"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            data-testid="activity-time-input"
          />
          <input
            type="number"
            className="activity-duration-input"
            placeholder="Duration (min)"
            min="1"
            value={durationMinutes}
            onChange={e => setDurationMinutes(e.target.value)}
            data-testid="activity-duration-input"
          />
          <input
            type="number"
            className="activity-price-input"
            placeholder="Price"
            min="0"
            step="0.01"
            value={price}
            onChange={e => setPrice(e.target.value)}
            data-testid="activity-price-input"
          />
        </div>
        <div className="activity-edit-actions">
          <button onClick={handleSave} className="btn-save-activity" data-testid="btn-save-activity">Save</button>
          <button onClick={handleCancel} className="btn-cancel-activity">✕</button>
        </div>
      </div>
    )
  }

  return (
    <div className="activity-item" data-testid="activity-item" onClick={() => setEditing(true)}>
      <div className="activity-main">
        {activity.startTime && (
          <span className="activity-time-badge" data-testid="activity-time-badge">{formatTime(activity.startTime)}</span>
        )}
        <span className="activity-title" data-testid="activity-title">{activity.title}</span>
        {activity.durationMinutes && (
          <span className="activity-duration-badge" data-testid="activity-duration-badge">{formatDuration(activity.durationMinutes)}</span>
        )}
        {activity.price != null && (
          <span className="activity-price-badge" data-testid="activity-price-badge">{formatPrice(activity.price, currency)}</span>
        )}
      </div>
      {tripId && (
        <button
          className="activity-detail-btn"
          onClick={e => { e.stopPropagation(); navigate(`/trip/${tripId}/activity/${activity.id}`, { state: { currency } }) }}
          title="View details"
          data-testid="btn-activity-detail"
        >&rarr;</button>
      )}
      <button
        className="activity-delete-btn"
        onClick={e => { e.stopPropagation(); handleRemove(activity.id) }}
        data-testid="btn-remove-activity"
      >✕</button>
    </div>
  )
}
