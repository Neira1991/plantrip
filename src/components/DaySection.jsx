import { useState } from 'react'
import ActivityItem from './ActivityItem'
import StopControls from './StopControls'
import { formatPrice } from '../utils/currency'
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

export default function DaySection({ day, tripId, currency, onAddActivity, onUpdateActivity, onRemoveActivity, onReorderActivity, onMoveUp, onMoveDown, onRemoveStop, onUpdateNights, onUpdateStopPrice, onAddMovement, onUpdateMovement, onRemoveMovement }) {
  const [movementForm, setMovementForm] = useState(null)
  const [newActivityTitle, setNewActivityTitle] = useState('')

  const handleAddActivity = () => {
    const trimmed = newActivityTitle.trim()
    if (!trimmed) return
    onAddActivity(day.stopId, { title: trimmed, date: day.date })
    setNewActivityTitle('')
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

      {day.isFirstDayOfStop && (
        <StopControls
          stop={{ id: day.stopId, nights: day.nights, sortIndex: day.stopSortIndex, pricePerNight: day.pricePerNight }}
          onMoveUp={() => onMoveUp(day.stopSortIndex)}
          onMoveDown={() => onMoveDown(day.stopSortIndex)}
          onRemove={() => onRemoveStop(day.stopId)}
          onUpdateNights={onUpdateNights}
          onUpdatePrice={onUpdateStopPrice}
          isFirst={isFirstStop}
          isLast={isLastStop}
          currency={currency}
        />
      )}

      <div className="day-activities">
        {day.activities.map(activity => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            tripId={tripId}
            currency={currency}
            onUpdate={(updates) => onUpdateActivity(activity.id, updates)}
            onRemove={() => onRemoveActivity(day.stopId, activity.id)}
          />
        ))}
        <div className="add-activity-row">
          <input
            type="text"
            className="add-activity-input"
            placeholder="Add activity..."
            value={newActivityTitle}
            onChange={e => setNewActivityTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddActivity() }}
            maxLength={200}
            data-testid="add-activity-input"
          />
        </div>
      </div>

      {day.movementAfter && (
        <div className="movement-connector" data-testid="movement-connector">
          <div className="movement-line" />
          {day.movementAfter.movement ? (
            <MovementSummary
              movement={day.movementAfter.movement}
              currency={currency}
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

function MovementSummary({ movement, currency, onRemove, onEdit }) {
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

  const priceStr = movement.price != null ? formatPrice(movement.price, currency) : null

  return (
    <button className="movement-summary" data-testid="movement-summary" onClick={() => setEditing(true)}>
      <span className="movement-icon">{transportConfig?.icon || '📍'}</span>
      <span className="movement-label">
        {transportConfig?.label || movement.type}
        {movement.carrier ? ` · ${movement.carrier}` : ''}
        {movement.durationMinutes ? ` · ${formatDuration(movement.durationMinutes)}` : ''}
      </span>
      {priceStr && <span className="movement-price">{priceStr}</span>}
    </button>
  )
}

function MovementForm({ fromStopId, initialData, onSave, onCancel, onDelete }) {
  const [type, setType] = useState(initialData?.type || 'train')
  const [carrier, setCarrier] = useState(initialData?.carrier || '')
  const [duration, setDuration] = useState(initialData?.durationMinutes || '')
  const [price, setPrice] = useState(initialData?.price ?? '')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      fromStopId,
      type,
      carrier: carrier.trim(),
      durationMinutes: duration ? parseInt(duration) : null,
      price: price !== '' ? parseFloat(price) : null,
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
      <input
        type="number"
        className="movement-input"
        placeholder="Price"
        min="0"
        step="0.01"
        value={price}
        onChange={e => setPrice(e.target.value)}
        data-testid="movement-price-input"
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
