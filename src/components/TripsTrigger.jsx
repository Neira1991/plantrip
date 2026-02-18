import './TripsTrigger.css'

export default function TripsTrigger({ isOpen, onToggle }) {
  return (
    <button
      className={`trips-trigger ${isOpen ? 'active' : ''}`}
      data-testid="btn-trips-panel"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls="trips-panel"
      aria-label={isOpen ? 'Close trips panel' : 'Open trips panel'}
    >
      🗺️
    </button>
  )
}
