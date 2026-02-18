import { useState } from 'react'
import PhotoGallery from './PhotoGallery'
import './SharedDaySection.css'

const TRANSPORT_TYPES = {
  train: { label: 'Train', icon: '\u{1F686}' },
  car: { label: 'Car', icon: '\u{1F697}' },
  plane: { label: 'Plane', icon: '\u2708\uFE0F' },
  bus: { label: 'Bus', icon: '\u{1F68C}' },
  ferry: { label: 'Ferry', icon: '\u26F4\uFE0F' },
  walk: { label: 'Walk', icon: '\u{1F6B6}' },
  other: { label: 'Other', icon: '\u{1F4CD}' },
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

function formatDuration(mins) {
  if (!mins) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}

export default function SharedDaySection({ day }) {
  return (
    <div className="shared-day-section">
      <div className="shared-day-header">
        <span className="shared-day-number">Day {day.dayNumber}</span>
        <span className="shared-day-date">{formatDate(day.date)}</span>
        <span className="shared-day-city">{day.stopName}</span>
      </div>

      {day.activities.length > 0 && (
        <div className="shared-day-activities">
          {day.activities.map(activity => (
            <SharedActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      )}

      {day.movementAfter && day.movementAfter.movement && (
        <div className="shared-movement-connector">
          <div className="shared-movement-line" />
          <div className="shared-movement-summary">
            <span className="shared-movement-icon">
              {TRANSPORT_TYPES[day.movementAfter.movement.type]?.icon || '\u{1F4CD}'}
            </span>
            <span className="shared-movement-label">
              {TRANSPORT_TYPES[day.movementAfter.movement.type]?.label || day.movementAfter.movement.type}
              {day.movementAfter.movement.carrier ? ` \u00B7 ${day.movementAfter.movement.carrier}` : ''}
              {day.movementAfter.movement.durationMinutes ? ` \u00B7 ${formatDuration(day.movementAfter.movement.durationMinutes)}` : ''}
            </span>
          </div>
          <div className="shared-movement-line" />
        </div>
      )}
    </div>
  )
}

function SharedActivityItem({ activity }) {
  const [expanded, setExpanded] = useState(false)
  const hasPhotos = activity.photos && activity.photos.length > 0
  const categoryLabel = activity.category
    ? activity.category.split(',')[0].replace(/_/g, ' ')
    : null
  const hasEnrichedInfo = activity.openingHours || activity.priceInfo || categoryLabel || activity.rating != null

  return (
    <div className="shared-activity-item-wrap">
      <div
        className={`shared-activity-item ${hasEnrichedInfo || hasPhotos ? 'clickable' : ''}`}
        onClick={() => { if (hasEnrichedInfo || hasPhotos) setExpanded(v => !v) }}
      >
        {activity.startTime && (
          <span className="shared-activity-time">{formatTime(activity.startTime)}</span>
        )}
        <span className="shared-activity-title">{activity.title}</span>
        {categoryLabel && <span className="shared-activity-category">{categoryLabel}</span>}
        {activity.rating != null && (
          <span className="shared-activity-rating">
            {'\u2605'.repeat(Math.floor(activity.rating))}
          </span>
        )}
        {activity.lng != null && <span className="shared-activity-location">{'\u{1F4CD}'}</span>}
        {activity.durationMinutes && (
          <span className="shared-activity-duration">{formatDuration(activity.durationMinutes)}</span>
        )}
        {(hasEnrichedInfo || hasPhotos) && (
          <span className="shared-activity-expand">{expanded ? '\u25B2' : '\u25BC'}</span>
        )}
      </div>
      {expanded && (
        <div className="shared-activity-details">
          {hasPhotos && (
            <PhotoGallery photos={activity.photos} readOnly />
          )}
          {activity.openingHours && (
            <div className="shared-activity-info-row">
              <span className="shared-info-icon">{'\u{1F552}'}</span>
              <span>{activity.openingHours}</span>
            </div>
          )}
          {activity.priceInfo && (
            <div className="shared-activity-info-row">
              <span className="shared-info-icon">{'\u{1F4B0}'}</span>
              <span>{activity.priceInfo}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
