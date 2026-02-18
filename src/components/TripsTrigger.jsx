import { useAuthStore } from '../stores/authStore'
import './TripsTrigger.css'

export default function TripsTrigger({ isOpen, onToggle }) {
  const { logout } = useAuthStore()

  return (
    <div className="trips-trigger-group">
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
      <button
        className="logout-trigger"
        data-testid="btn-logout"
        onClick={logout}
        aria-label="Sign out"
      >
        ↪
      </button>
    </div>
  )
}
