export default function EmptyState({ onCreate }) {
  return (
    <div className="trips-empty-state">
      <div className="empty-icon">🗺️</div>
      <h3>No trips yet</h3>
      <p>Search for a country to start planning</p>
      <button className="new-trip-btn-primary" onClick={onCreate}>
        Search Countries
      </button>
    </div>
  )
}
