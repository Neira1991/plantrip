import { useState, useEffect, useRef, useCallback } from 'react'

export function useAsyncLoad(asyncFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null })
  const cancelledRef = useRef(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedFn = useCallback(asyncFn, deps)

  useEffect(() => {
    cancelledRef.current = false
    setState(s => ({ ...s, loading: true, error: null }))

    memoizedFn()
      .then((result) => {
        if (!cancelledRef.current) setState({ data: result, loading: false, error: null })
      })
      .catch((err) => {
        if (!cancelledRef.current) setState({ data: null, loading: false, error: err.message || 'An error occurred' })
      })

    return () => { cancelledRef.current = true }
  }, [memoizedFn])

  return state
}
