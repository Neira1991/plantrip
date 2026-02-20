import { useEffect } from 'react'

export function useEscapeKey(callback, isActive = true) {
  useEffect(() => {
    if (!isActive) return

    function handleKeyDown(e) {
      if (e.key === 'Escape') callback()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isActive, callback])
}
