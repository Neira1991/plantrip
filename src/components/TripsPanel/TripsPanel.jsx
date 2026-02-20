import { useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTrips } from '../../hooks/useTrips'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import TripsList from './TripsList'
import './TripsPanel.css'

export default function TripsPanel({ isOpen, onClose }) {
  const { trips, isLoading } = useTrips()
  const panelRef = useRef(null)
  const navigate = useNavigate()

  useEscapeKey(onClose, isOpen)

  const handleSelect = useCallback((trip) => {
    onClose()
    navigate(`/trip/${trip.id}`)
  }, [navigate, onClose])

  const handleNew = useCallback(() => {
    onClose()
    navigate('/')
  }, [navigate, onClose])

  return (
    <>
      <div
        className={`trips-panel-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        id="trips-panel"
        data-testid="trips-panel"
        className={`trips-panel ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-labelledby="trips-panel-title"
        aria-modal="true"
      >
        <header className="trips-panel-header">
          <button className="close-btn" onClick={onClose} aria-label="Close trips panel">
            ✕
          </button>
          <h2 id="trips-panel-title" className="panel-title">My Trips</h2>
          <div style={{ width: 48 }} />
        </header>

        <div className="trips-panel-content">
          <TripsList
            trips={trips}
            isLoading={isLoading}
            onNew={handleNew}
            onSelect={handleSelect}
          />
        </div>
      </aside>
    </>
  )
}
