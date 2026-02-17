import { useState } from 'react'
import ActivityItem from './ActivityItem'
import MovementEditor from './MovementEditor'

export default function StopCard({
  entry,
  index,
  totalStops,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity,
  onSaveMovement,
  onDeleteMovement,
}) {
  const { stop, activities, movementToNext } = entry
  const [newActivity, setNewActivity] = useState('')
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  function handleAddActivity() {
    const trimmed = newActivity.trim()
    if (!trimmed) return
    onAddActivity(stop.id, { title: trimmed })
    setNewActivity('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleAddActivity()
  }

  return (
    <div className="stop-card-wrapper">
      <div className="stop-card">
        <div className="stop-card-header">
          <span className="stop-number">{index + 1}</span>
          <span className="stop-name">{stop.name}</span>
          <div className="stop-actions">
            {index > 0 && (
              <button className="stop-move-btn" onClick={() => onMoveUp(index)} title="Move up">↑</button>
            )}
            {index < totalStops - 1 && (
              <button className="stop-move-btn" onClick={() => onMoveDown(index)} title="Move down">↓</button>
            )}
            {!showConfirmDelete ? (
              <button className="stop-remove-btn" onClick={() => setShowConfirmDelete(true)} title="Remove stop">✕</button>
            ) : (
              <div className="stop-confirm-delete">
                <button className="stop-confirm-yes" onClick={() => onRemove(stop.id)}>Delete</button>
                <button className="stop-confirm-no" onClick={() => setShowConfirmDelete(false)}>Keep</button>
              </div>
            )}
          </div>
        </div>

        {activities.length > 0 && (
          <div className="stop-activities">
            {activities.map(activity => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                onUpdate={onUpdateActivity}
                onDelete={(activityId) => onRemoveActivity(stop.id, activityId)}
              />
            ))}
          </div>
        )}

        <div className="stop-add-activity">
          <input
            type="text"
            className="activity-add-input"
            value={newActivity}
            onChange={e => setNewActivity(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="+ Add activity"
            maxLength={200}
          />
        </div>
      </div>

      {index < totalStops - 1 && (
        <MovementEditor
          movement={movementToNext}
          fromStop={stop}
          onSave={(data) => onSaveMovement(stop.id, data)}
          onDelete={onDeleteMovement}
        />
      )}
    </div>
  )
}
