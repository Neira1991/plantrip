export default function DeleteConfirm({ onConfirm, onCancel }) {
  return (
    <div className="delete-confirm">
      <p className="delete-confirm-text">Are you sure? This cannot be undone.</p>
      <div className="delete-confirm-actions">
        <button className="btn-delete-cancel" onClick={onCancel}>Cancel</button>
        <button className="btn-delete-confirm" onClick={onConfirm}>Yes, Delete</button>
      </div>
    </div>
  )
}
