import DaySection from './DaySection'
import './ItineraryPanel.css'

export default function ItineraryPanel({
  timeline,
  tripId,
  countryCode,
  onClose,
  onAddStop,
  onReorderStop,
  onRemoveStop,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity,
  onSaveMovement,
  onDeleteMovement,
  onUpdateMovement,
  onOpenCitySearch,
  onUpdateNights,
  onExploreStop,
  toast,
}) {
  const handleMoveUp = async (sortIndex) => {
    if (sortIndex > 0) {
      await onReorderStop(tripId, sortIndex, sortIndex - 1)
    }
  }

  const handleMoveDown = async (sortIndex) => {
    const maxIndex = timeline.length > 0 ? timeline[timeline.length - 1].totalStops - 1 : 0
    if (sortIndex < maxIndex) {
      await onReorderStop(tripId, sortIndex, sortIndex + 1)
    }
  }

  const handleRemoveStop = async (stopId) => {
    await onRemoveStop(tripId, stopId)
  }

  const handleAddMovement = async (data) => {
    // Find the toStopId based on fromStopId
    const dayWithMovement = timeline.find(d => d.movementAfter?.fromStop.id === data.fromStopId)
    if (!dayWithMovement) return

    // Find next stop
    const currentStopIndex = dayWithMovement.stopSortIndex
    const nextStop = timeline.find(d => d.stopSortIndex === currentStopIndex + 1)
    if (!nextStop) return

    await onSaveMovement(tripId, data.fromStopId, nextStop.stopId, data)
  }

  return (
    <div className="itinerary-panel" data-testid="itinerary-panel">
      <div className="itinerary-panel-header">
        <h2 className="itinerary-panel-title">
          Itinerary
          {timeline.length > 0 && (
            <span className="itinerary-count">
              {timeline.length} {timeline.length === 1 ? 'day' : 'days'}
            </span>
          )}
        </h2>
        <button className="itinerary-close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="itinerary-panel-body">
        {timeline.length === 0 ? (
          <div className="itinerary-empty" data-testid="itinerary-empty">
            <p>No stops yet</p>
            <p className="itinerary-empty-hint">Add your first stop to start building your itinerary</p>
          </div>
        ) : (
          <div className="itinerary-list">
            {timeline.map(day => (
              <DaySection
                key={`${day.stopId}-${day.dayNumber}`}
                day={day}
                tripId={tripId}
                countryCode={countryCode}
                onAddActivity={onAddActivity}
                onUpdateActivity={onUpdateActivity}
                onRemoveActivity={onRemoveActivity}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onRemoveStop={handleRemoveStop}
                onUpdateNights={onUpdateNights}
                onAddMovement={handleAddMovement}
                onUpdateMovement={onUpdateMovement}
                onRemoveMovement={onDeleteMovement}
                onExploreStop={onExploreStop}
              />
            ))}
          </div>
        )}
      </div>

      <div className="itinerary-panel-footer">
        <button className="itinerary-add-stop-btn" data-testid="btn-add-stop" onClick={onOpenCitySearch}>
          + Add stop
        </button>
      </div>

      {toast && <div className="itinerary-toast" data-testid="itinerary-toast">{toast}</div>}
    </div>
  )
}
