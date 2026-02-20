export default function ConfirmDialog({
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
}) {
  return (
    <div className="delete-confirm">
      <p className="delete-confirm-text">{message}</p>
      <div className="delete-confirm-actions">
        <button type="button" className="btn-delete-cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button type="button" className={`btn-delete-confirm${variant !== 'danger' ? ` btn-delete-confirm--${variant}` : ''}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
