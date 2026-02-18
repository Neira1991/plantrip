import { useState } from 'react'

const TRANSPORT_TYPES = [
  { value: 'train', label: 'Train', icon: '🚆' },
  { value: 'car', label: 'Car', icon: '🚗' },
  { value: 'plane', label: 'Plane', icon: '✈️' },
  { value: 'bus', label: 'Bus', icon: '🚌' },
  { value: 'ferry', label: 'Ferry', icon: '⛴️' },
  { value: 'other', label: 'Other', icon: '📍' },
]

export default function MovementEditor({ movement, fromStop, toStop, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [type, setType] = useState(movement?.type || 'train')
  const [carrier, setCarrier] = useState(movement?.carrier || '')
  const [durationMinutes, setDurationMinutes] = useState(movement?.durationMinutes || '')

  function handleSave() {
    onSave({
      type,
      carrier: carrier.trim(),
      durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
    })
    setEditing(false)
  }

  function formatDuration(mins) {
    if (!mins) return ''
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h${m}m`
  }

  const transportConfig = TRANSPORT_TYPES.find(t => t.value === movement?.type)

  if (!movement) {
    return (
      <div className="movement-connector">
        <div className="movement-line" />
        {!editing ? (
          <button className="movement-add-btn" data-testid="btn-add-movement" onClick={() => setEditing(true)}>
            + transport
          </button>
        ) : (
          <div className="movement-edit-form">
            <div className="movement-type-grid">
              {TRANSPORT_TYPES.map(t => (
                <button
                  key={t.value}
                  className={`movement-type-btn ${type === t.value ? 'active' : ''}`}
                  data-testid="movement-type-btn"
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
              value={carrier}
              onChange={e => setCarrier(e.target.value)}
              placeholder="Carrier (optional)"
              maxLength={200}
            />
            <input
              type="number"
              className="movement-input"
              value={durationMinutes}
              onChange={e => setDurationMinutes(e.target.value)}
              placeholder="Duration (min)"
              min="1"
            />
            <div className="movement-edit-actions">
              <button className="movement-cancel-btn" data-testid="btn-cancel-movement" onClick={() => setEditing(false)}>Cancel</button>
              <button className="movement-save-btn" data-testid="btn-save-movement" onClick={handleSave}>Save</button>
            </div>
          </div>
        )}
        <div className="movement-line" />
      </div>
    )
  }

  if (editing) {
    return (
      <div className="movement-connector">
        <div className="movement-line" />
        <div className="movement-edit-form">
          <div className="movement-type-grid">
            {TRANSPORT_TYPES.map(t => (
              <button
                key={t.value}
                className={`movement-type-btn ${type === t.value ? 'active' : ''}`}
                data-testid="movement-type-btn"
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
            value={carrier}
            onChange={e => setCarrier(e.target.value)}
            placeholder="Carrier (optional)"
            maxLength={200}
          />
          <input
            type="number"
            className="movement-input"
            value={durationMinutes}
            onChange={e => setDurationMinutes(e.target.value)}
            placeholder="Duration (min)"
            min="1"
          />
          <div className="movement-edit-actions">
            <button className="movement-cancel-btn" data-testid="btn-cancel-movement" onClick={() => setEditing(false)}>Cancel</button>
            <button className="movement-delete-btn" data-testid="btn-delete-movement" onClick={() => { onDelete(movement.id); setEditing(false) }}>Delete</button>
            <button className="movement-save-btn" data-testid="btn-save-movement" onClick={handleSave}>Save</button>
          </div>
        </div>
        <div className="movement-line" />
      </div>
    )
  }

  return (
    <div className="movement-connector">
      <div className="movement-line" />
      <button className="movement-summary" data-testid="movement-summary" onClick={() => {
        setType(movement.type)
        setCarrier(movement.carrier || '')
        setDurationMinutes(movement.durationMinutes || '')
        setEditing(true)
      }}>
        <span className="movement-icon">{transportConfig?.icon || '📍'}</span>
        <span className="movement-label">
          {transportConfig?.label || movement.type}
          {movement.carrier ? ` · ${movement.carrier}` : ''}
          {movement.durationMinutes ? ` · ${formatDuration(movement.durationMinutes)}` : ''}
        </span>
      </button>
      <div className="movement-line" />
    </div>
  )
}
