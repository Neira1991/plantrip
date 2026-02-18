export default function DeleteConfirm({ onConfirm, onCancel }) {
  return (
    <div className="delete-confirm">
      <p className="delete-confirm-text">Are you sure? This cannot be undone.</p>
      <div className="delete-confirm-actions">
        <button className="btn-delete-cancel" data-testid="btn-cancel-delete" onClick={onCancel}>Cancel</button>
        <button className="btn-delete-confirm" data-testid="btn-confirm-delete" onClick={onConfirm}>Yes, Delete</button>
      </div>
    </div>
  )
}
