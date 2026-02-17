import TripCard from './TripCard'
import EmptyState from './EmptyState'

export default function TripsList({ trips, isLoading, onNew, onSelect }) {
  if (isLoading && trips.length === 0) {
    return <div className="trips-loading">Loading trips...</div>
  }

  if (trips.length === 0) {
    return <EmptyState onCreate={onNew} />
  }

  return (
    <div className="trips-list">
      {trips.map(trip => (
        <TripCard key={trip.id} trip={trip} onClick={() => onSelect(trip)} />
      ))}
    </div>
  )
}
