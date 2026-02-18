import { useState } from 'react'
import { formatPrice } from '../utils/currency'
import './StopControls.css'

export default function StopControls({ stop, onMoveUp, onMoveDown, onRemove, onUpdateNights, onUpdatePrice, isFirst, isLast, currency }) {
  const [editingNights, setEditingNights] = useState(false)
  const [nightsValue, setNightsValue] = useState(stop.nights || 1)
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceValue, setPriceValue] = useState(stop.pricePerNight ?? '')
  const [confirming, setConfirming] = useState(false)

  const handleNightsSave = () => {
    const n = Math.max(1, parseInt(nightsValue) || 1)
    onUpdateNights(stop.id, n)
    setEditingNights(false)
  }

  const handlePriceSave = () => {
    const val = priceValue === '' ? null : parseFloat(priceValue)
    if (onUpdatePrice) onUpdatePrice(stop.id, val != null && !isNaN(val) ? val : null)
    setEditingPrice(false)
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

        {editingPrice ? (
          <span className="price-edit-group">
            <input
              type="number"
              className="price-input"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={priceValue}
              onChange={e => setPriceValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePriceSave(); if (e.key === 'Escape') setEditingPrice(false) }}
              onBlur={handlePriceSave}
              autoFocus
              data-testid="price-input"
            />
            <span className="price-label">/night</span>
          </span>
        ) : (
          <button
            className="price-badge"
            onClick={() => { setPriceValue(stop.pricePerNight ?? ''); setEditingPrice(true) }}
            data-testid="price-badge"
          >
            {stop.pricePerNight != null
              ? `${formatPrice(stop.pricePerNight, currency)}/night`
              : '+ price'}
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
