import { useState } from 'react'
import StopCard from './StopCard'
import './ItineraryPanel.css'

export default function ItineraryPanel({
  itinerary,
  tripId,
  onClose,
  onAddStop,
  onReorderStop,
  onRemoveStop,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity,
  onSaveMovement,
  onDeleteMovement,
  onOpenCitySearch,
  toast,
}) {
  return (
    <div className="itinerary-panel-overlay" onClick={onClose}>
      <div className="itinerary-panel" onClick={e => e.stopPropagation()}>
        <div className="itinerary-panel-header">
          <h2 className="itinerary-panel-title">
            Itinerary
            {itinerary.length > 0 && <span className="itinerary-count">{itinerary.length}</span>}
          </h2>
          <button className="itinerary-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="itinerary-panel-body">
          {itinerary.length === 0 ? (
            <div className="itinerary-empty">
              <p>No stops yet</p>
              <p className="itinerary-empty-hint">Add your first stop to start building your itinerary</p>
            </div>
          ) : (
            <div className="itinerary-list">
              {itinerary.map((entry, i) => (
                <StopCard
                  key={entry.stop.id}
                  entry={entry}
                  index={i}
                  totalStops={itinerary.length}
                  onMoveUp={(idx) => onReorderStop(tripId, idx, idx - 1)}
                  onMoveDown={(idx) => onReorderStop(tripId, idx, idx + 1)}
                  onRemove={(stopId) => onRemoveStop(tripId, stopId)}
                  onAddActivity={onAddActivity}
                  onUpdateActivity={onUpdateActivity}
                  onRemoveActivity={onRemoveActivity}
                  onSaveMovement={(fromStopId, data) => {
                    const nextEntry = itinerary[i + 1]
                    if (nextEntry) {
                      onSaveMovement(tripId, fromStopId, nextEntry.stop.id, data)
                    }
                  }}
                  onDeleteMovement={onDeleteMovement}
                />
              ))}
            </div>
          )}
        </div>

        <div className="itinerary-panel-footer">
          <button className="itinerary-add-stop-btn" onClick={onOpenCitySearch}>
            + Add stop
          </button>
        </div>

        {toast && <div className="itinerary-toast">{toast}</div>}
      </div>
    </div>
  )
}
