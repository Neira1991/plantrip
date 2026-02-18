import { useState } from 'react'
import './StopControls.css'

export default function StopControls({ stop, onMoveUp, onMoveDown, onRemove, onUpdateNights, isFirst, isLast }) {
  const [editingNights, setEditingNights] = useState(false)
  const [nightsValue, setNightsValue] = useState(stop.nights || 1)
  const [confirming, setConfirming] = useState(false)

  const handleNightsSave = () => {
    const n = Math.max(1, parseInt(nightsValue) || 1)
    onUpdateNights(stop.id, n)
    setEditingNights(false)
  }

  return (
    <div className="stop-controls" data-testid="stop-controls">
      <div className="nights-editor">
        {editingNights ? (
          <span className="nights-edit-group">
            <input
              type="number"
              className="nights-input"
              min="1"
              value={nightsValue}
              onChange={e => setNightsValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNightsSave(); if (e.key === 'Escape') setEditingNights(false) }}
              onBlur={handleNightsSave}
              autoFocus
              data-testid="nights-input"
            />
            <span className="nights-label">nights</span>
          </span>
        ) : (
          <button
            className="nights-badge"
            onClick={() => { setNightsValue(stop.nights || 1); setEditingNights(true) }}
            data-testid="nights-badge"
          >
            {stop.nights || 1} {(stop.nights || 1) === 1 ? 'night' : 'nights'}
          </button>
        )}
      </div>
      <div className="stop-actions">
        {!isFirst && (
          <button onClick={onMoveUp} className="btn-icon" data-testid="btn-move-up" title="Move up">▲</button>
        )}
        {!isLast && (
          <button onClick={onMoveDown} className="btn-icon" data-testid="btn-move-down" title="Move down">▼</button>
        )}
        {confirming ? (
          <span className="confirm-delete">
            <button onClick={() => { onRemove(); setConfirming(false) }} className="btn-danger-sm" data-testid="btn-confirm-remove">Remove?</button>
            <button onClick={() => setConfirming(false)} className="btn-icon">✕</button>
          </span>
        ) : (
          <button onClick={() => setConfirming(true)} className="btn-icon btn-remove" data-testid="btn-remove-stop" title="Remove stop">🗑</button>
        )}
      </div>
    </div>
  )
}
