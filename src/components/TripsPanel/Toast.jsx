import { useEffect } from 'react'

export default function Toast({ message, type = 'success', visible, onHide }) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onHide, 3000)
      return () => clearTimeout(timer)
    }
  }, [visible, onHide])

  return (
    <div
      className={`toast toast-${type} ${visible ? 'visible' : ''}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}
