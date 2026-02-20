import { useState } from 'react'
import PhotoGallery from './PhotoGallery'
import { formatPrice } from '../utils/currency'
import { formatDateWithDay } from '../utils/date'
import { formatTime, formatDuration } from '../utils/time'
import { TRANSPORT_MAP } from '../data/static/transportTypes'
import './SharedDaySection.css'

export default function SharedDaySection({ day, currency, feedbackMode, feedbackByActivity, feedbackSubmitting, onFeedback }) {
  return (
    <div className="shared-day-section">
      <div className="shared-day-header">
        <span className="shared-day-number">Day {day.dayNumber}</span>
        <span className="shared-day-date">{formatDateWithDay(day.date)}</span>
        <span className="shared-day-city">{day.stopName}</span>
      </div>

      {day.activities.length > 0 && (
        <div className="shared-day-activities">
          {day.activities.map(activity => (
            <SharedActivityItem
              key={activity.id}
              activity={activity}
              currency={currency}
              feedbackMode={feedbackMode}
              feedback={feedbackByActivity?.[activity.id]}
              feedbackSubmitting={feedbackSubmitting}
              onFeedback={onFeedback}
            />
          ))}
        </div>
      )}

      {day.movementAfter && day.movementAfter.movement && (
        <div className="shared-movement-connector">
          <div className="shared-movement-line" />
          <div className="shared-movement-summary">
            <span className="shared-movement-icon">
              {TRANSPORT_MAP[day.movementAfter.movement.type]?.icon || '\u{1F4CD}'}
            </span>
            <span className="shared-movement-label">
              {TRANSPORT_MAP[day.movementAfter.movement.type]?.label || day.movementAfter.movement.type}
              {day.movementAfter.movement.carrier ? ` \u00B7 ${day.movementAfter.movement.carrier}` : ''}
              {day.movementAfter.movement.durationMinutes ? ` \u00B7 ${formatDuration(day.movementAfter.movement.durationMinutes)}` : ''}
            </span>
            {day.movementAfter.movement.price != null && (
              <span className="shared-movement-price">{formatPrice(day.movementAfter.movement.price, currency)}</span>
            )}
          </div>
          <div className="shared-movement-line" />
        </div>
      )}
    </div>
  )
}

function SharedActivityItem({ activity, currency, feedbackMode, feedback, feedbackSubmitting, onFeedback }) {
  const [expanded, setExpanded] = useState(false)
  const [message, setMessage] = useState('')
  const hasPhotos = activity.photos && activity.photos.length > 0
  const categoryLabel = activity.category
    ? activity.category.split(',')[0].replace(/_/g, ' ')
    : null
  const hasEnrichedInfo = activity.openingHours || activity.price != null || categoryLabel || activity.rating != null
  const hasSent = !!feedback

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
            <PhotoGallery photos={activity.photos} />
          )}
          {activity.openingHours && (
            <div className="shared-activity-info-row">
              <span className="shared-info-icon">{'\u{1F552}'}</span>
              <span>{activity.openingHours}</span>
            </div>
          )}
          {activity.price != null && (
            <div className="shared-activity-info-row">
              <span className="shared-info-icon">{'\u{1F4B0}'}</span>
              <span>{formatPrice(activity.price, currency)}</span>
            </div>
          )}
        </div>
      )}
      {feedbackMode && (
        <div className="shared-activity-feedback-btns">
          {hasSent ? (
            <span className="shared-fb-sent">Sent</span>
          ) : (
            <>
              <button
                className="shared-fb-btn shared-fb-like"
                onClick={() => onFeedback(activity.id, 'like', message)}
                disabled={feedbackSubmitting}
                aria-label={`Like ${activity.title}`}
              >
                {'\u{1F44D}'}
              </button>
              <button
                className="shared-fb-btn shared-fb-dislike"
                onClick={() => onFeedback(activity.id, 'dislike', message)}
                disabled={feedbackSubmitting}
                aria-label={`Dislike ${activity.title}`}
              >
                {'\u{1F44E}'}
              </button>
              <input
                type="text"
                className="shared-fb-message-input"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Optional note..."
                maxLength={500}
                onClick={e => e.stopPropagation()}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
