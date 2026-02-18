import { useState } from 'react'

export default function ActivityItem({ activity, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(activity.title)

  function handleSave() {
    const trimmed = title.trim()
    if (!trimmed) return
    onUpdate(activity.id, { title: trimmed })
    setEditing(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') {
      setTitle(activity.title)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <div className="activity-item editing" data-testid="activity-item">
        <input
          type="text"
          className="activity-edit-input"
          data-testid="activity-edit-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          maxLength={200}
          autoFocus
        />
      </div>
    )
  }

  return (
    <div className="activity-item" data-testid="activity-item">
      <span className="activity-title" data-testid="activity-title" onClick={() => setEditing(true)}>{activity.title}</span>
      <button className="activity-delete-btn" data-testid="btn-delete-activity" onClick={() => onDelete(activity.id)} title="Remove">
        ✕
      </button>
    </div>
  )
}
