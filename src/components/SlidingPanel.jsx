import { useEscapeKey } from '../hooks/useEscapeKey'
import './SlidingPanel.css'

export default function SlidingPanel({ isOpen, onClose, title, titleId, className, children }) {
  useEscapeKey(onClose, isOpen)

  return (
    <>
      <div
        className={`sliding-panel-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />
      <aside
        className={`sliding-panel ${isOpen ? 'open' : ''}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
      >
        <header className="sliding-panel-header">
          <button className="sliding-panel-close" onClick={onClose} aria-label={`Close ${title} panel`}>
            {'\u2715'}
          </button>
          <h2 id={titleId} className="sliding-panel-title">{title}</h2>
          <div style={{ width: 48 }} />
        </header>
        {children}
      </aside>
    </>
  )
}
