import { useState, useCallback, useRef, useEffect } from 'react'

export function useToast(duration = 3000) {
  const [toast, setToast] = useState(null)
  const timeoutRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const showToast = useCallback((message) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setToast(message)
    timeoutRef.current = setTimeout(() => {
      setToast(null)
      timeoutRef.current = null
    }, duration)
  }, [duration])

  return { toast, showToast }
}
