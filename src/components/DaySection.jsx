import { useState } from 'react'
import ActivityItem from './ActivityItem'
import ActivitySearchBox from './ActivitySearchBox'
import StopControls from './StopControls'
import './DaySection.css'

const TRANSPORT_TYPES = [
  { value: 'train', label: 'Train', icon: '🚆' },
  { value: 'car', label: 'Car', icon: '🚗' },
  { value: 'plane', label: 'Plane', icon: '✈️' },
  { value: 'bus', label: 'Bus', icon: '🚌' },
  { value: 'ferry', label: 'Ferry', icon: '⛴️' },
  { value: 'walk', label: 'Walk', icon: '🚶' },
  { value: 'other', label: 'Other', icon: '📍' },
]

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDuration(mins) {
  if (!mins) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}

export default function DaySection({ day, tripId, countryCode, onAddActivity, onUpdateActivity, onRemoveActivity, onReorderActivity, onMoveUp, onMoveDown, onRemoveStop, onUpdateNights, onAddMovement, onUpdateMovement, onRemoveMovement, onExploreStop }) {
  const [movementForm, setMovementForm] = useState(null)

  const handleAddActivity = ({ title, date, lng, lat, address, notes }) => {
    onAddActivity(day.stopId, { title, date: date || day.date, lng, lat, address, notes })
  }

  const isFirstStop = day.stopSortIndex === 0
  const isLastStop = day.stopSortIndex === day.totalStops - 1

  return (
    <div className="day-section" data-testid="day-section">
      <div className="day-header">
        <span className="day-number" data-testid="day-number">Day {day.dayNumber}</span>
        <span className="day-date">{formatDate(day.date)}</span>
        <span className="day-city">{day.stopName}</span>
      </div>

      {day.isFirstDayOfStop && onExploreStop && (
        <button
          className="btn-explore-stop"
          onClick={() => onExploreStop({ id: day.stopId, name: day.stopName, lat: day.stopLat, lng: day.stopLng })}
          data-testid="btn-explore-stop"
        >
          Explore
        </button>
      )}

      {day.isFirstDayOfStop && (
        <StopControls
          stop={{ id: day.stopId, nights: day.nights, sortIndex: day.stopSortIndex }}
          onMoveUp={() => onMoveUp(day.stopSortIndex)}
          onMoveDown={() => onMoveDown(day.stopSortIndex)}
          onRemove={() => onRemoveStop(day.stopId)}
          onUpdateNights={onUpdateNights}
          isFirst={isFirstStop}
          isLast={isLastStop}
        />
      )}

      <div className="day-activities">
        {day.activities.map(activity => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            tripId={tripId}
            onUpdate={(updates) => onUpdateActivity(activity.id, updates)}
            onRemove={() => onRemoveActivity(day.stopId, activity.id)}
          />
        ))}
        <div className="add-activity-row">
          <ActivitySearchBox
            stopLng={day.stopLng}
            stopLat={day.stopLat}
            countryCode={countryCode}
            date={day.date}
            onAdd={handleAddActivity}
            testId="add-activity-input"
          />
        </div>
      </div>

      {day.movementAfter && (
        <div className="movement-connector" data-testid="movement-connector">
          <div className="movement-line" />
          {day.movementAfter.movement ? (
            <MovementSummary
              movement={day.movementAfter.movement}
              onRemove={() => onRemoveMovement(day.movementAfter.movement.id)}
              onEdit={(data) => onUpdateMovement(day.movementAfter.movement.id, data)}
            />
          ) : (
            <div className="movement-add">
              {movementForm ? (
                <MovementForm
                  fromStopId={day.stopId}
                  onSave={(data) => { onAddMovement(data); setMovementForm(null) }}
                  onCancel={() => setMovementForm(null)}
                />
              ) : (
                <button
                  className="btn-add-movement"
                  onClick={() => setMovementForm(true)}
                  data-testid="btn-add-movement"
                >+ transport</button>
              )}
            </div>
          )}
          <div className="movement-line" />
        </div>
      )}
    </div>
  )
}

function MovementSummary({ movement, onRemove, onEdit }) {
  const [editing, setEditing] = useState(false)
  const transportConfig = TRANSPORT_TYPES.find(t => t.value === movement.type)

  if (editing) {
    return (
      <MovementForm
        fromStopId={movement.fromStopId}
        initialData={movement}
        onSave={(data) => { onEdit(data); setEditing(false) }}
        onCancel={() => setEditing(false)}
        onDelete={() => { onRemove(); setEditing(false) }}
      />
    )
  }

  return (
    <button className="movement-summary" data-testid="movement-summary" onClick={() => setEditing(true)}>
      <span className="movement-icon">{transportConfig?.icon || '📍'}</span>
      <span className="movement-label">
        {transportConfig?.label || movement.type}
        {movement.carrier ? ` · ${movement.carrier}` : ''}
        {movement.durationMinutes ? ` · ${formatDuration(movement.durationMinutes)}` : ''}
      </span>
    </button>
  )
}

function MovementForm({ fromStopId, initialData, onSave, onCancel, onDelete }) {
  const [type, setType] = useState(initialData?.type || 'train')
  const [carrier, setCarrier] = useState(initialData?.carrier || '')
  const [duration, setDuration] = useState(initialData?.durationMinutes || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      fromStopId,
      type,
      carrier: carrier.trim(),
      durationMinutes: duration ? parseInt(duration) : null,
    })
  }

  return (
    <form className="movement-form" onSubmit={handleSubmit}>
      <div className="movement-type-grid">
        {TRANSPORT_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            className={`movement-type-btn ${type === t.value ? 'active' : ''}`}
            onClick={() => setType(t.value)}
            title={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <input
        type="text"
        className="movement-input"
        placeholder="Carrier (optional)"
        value={carrier}
        onChange={e => setCarrier(e.target.value)}
        maxLength={200}
        data-testid="movement-carrier-input"
      />
      <input
        type="number"
        className="movement-input"
        placeholder="Duration (min)"
        min="1"
        value={duration}
        onChange={e => setDuration(e.target.value)}
        data-testid="movement-duration-input"
      />
      <div className="movement-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
        {onDelete && (
          <button type="button" className="btn-delete" onClick={onDelete} data-testid="btn-delete-movement">Delete</button>
        )}
        <button type="submit" className="btn-save" data-testid="btn-save-movement">Save</button>
      </div>
    </form>
  )
}
