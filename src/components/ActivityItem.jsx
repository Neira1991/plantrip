import { useState } from 'react'
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

export default function ActivityItem({ activity, onUpdate, onRemove, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(activity.title)
  const [startTime, setStartTime] = useState(activity.startTime || '')
  const [durationMinutes, setDurationMinutes] = useState(activity.durationMinutes || '')

  // Support both onRemove and onDelete for backwards compatibility
  const handleRemove = onRemove || onDelete

  const handleSave = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    onUpdate({
      title: trimmed,
      startTime: startTime || null,
      durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
    })
    setEditing(false)
  }

  const handleCancel = () => {
    setTitle(activity.title)
    setStartTime(activity.startTime || '')
    setDurationMinutes(activity.durationMinutes || '')
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
        {activity.lng != null && <span className="activity-location-badge" data-testid="activity-location-badge">📍</span>}
        {activity.durationMinutes && (
          <span className="activity-duration-badge" data-testid="activity-duration-badge">{formatDuration(activity.durationMinutes)}</span>
        )}
      </div>
      <button
        className="activity-delete-btn"
        onClick={e => { e.stopPropagation(); handleRemove(activity.id) }}
        data-testid="btn-remove-activity"
      >✕</button>
    </div>
  )
}
