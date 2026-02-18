import { useState, useRef, useEffect, useCallback } from 'react'
import './ActivitySearchBox.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function ActivitySearchBox({ stopLng, stopLat, countryCode, date, onAdd, testId }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const sessionToken = useRef(crypto.randomUUID())
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  const fetchSuggestions = useCallback(async (q) => {
    if (!MAPBOX_TOKEN || q.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    const baseParams = {
      q,
      access_token: MAPBOX_TOKEN,
      session_token: sessionToken.current,
      limit: '5',
      types: 'poi,address',
      language: 'en',
    }

    const buildParams = (withCountry) => {
      const params = new URLSearchParams(baseParams)
      if (stopLng != null && stopLat != null) {
        params.set('proximity', `${stopLng},${stopLat}`)
      }
      if (withCountry && countryCode) {
        params.set('country', countryCode)
      }
      return params
    }

    try {
      let res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest?${buildParams(true)}`
      )
      let data = await res.json()

      // Retry without country filter if no results (e.g. China has limited Mapbox coverage)
      if ((data.suggestions || []).length === 0 && countryCode) {
        res = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/suggest?${buildParams(false)}`
        )
        data = await res.json()
      }

      const items = (data.suggestions || []).map(s => ({
        mapbox_id: s.mapbox_id,
        name: s.name,
        address: s.full_address || s.address || '',
      }))
      setSuggestions(items)
      setOpen(items.length > 0)
      setActiveIndex(-1)
    } catch {
      setSuggestions([])
      setOpen(false)
    }
  }, [stopLng, stopLat, countryCode])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    if (val.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(val.trim()), 300)
  }

  const retrieveAndAdd = async (suggestion) => {
    const title = suggestion.name
    let lng = null, lat = null, address = suggestion.address || ''

    if (MAPBOX_TOKEN && suggestion.mapbox_id) {
      try {
        const params = new URLSearchParams({
          access_token: MAPBOX_TOKEN,
          session_token: sessionToken.current,
        })
        const res = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/retrieve/${suggestion.mapbox_id}?${params}`
        )
        const data = await res.json()
        const feature = data.features?.[0]
        if (feature?.geometry?.coordinates) {
          ;[lng, lat] = feature.geometry.coordinates
        }
        if (feature?.properties?.full_address) {
          address = feature.properties.full_address
        }
      } catch {
        // Fall through without coordinates
      }
    }

    onAdd({ title, date, lng, lat, address })
    setQuery('')
    setSuggestions([])
    setOpen(false)
    sessionToken.current = crypto.randomUUID()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      return
    }
    if (e.key === 'ArrowDown' && open) {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
      return
    }
    if (e.key === 'ArrowUp' && open) {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        retrieveAndAdd(suggestions[activeIndex])
      } else {
        // Free-text add (no coordinates)
        const title = query.trim()
        if (!title) return
        onAdd({ title, date })
        setQuery('')
        setSuggestions([])
        setOpen(false)
      }
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  return (
    <div className="activity-search-container" ref={containerRef}>
      <input
        type="text"
        className="add-activity-input"
        placeholder="Add activity..."
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={200}
        data-testid={testId}
      />
      {open && suggestions.length > 0 && (
        <div className="activity-search-dropdown" data-testid="activity-search-dropdown">
          {suggestions.map((s, i) => (
            <button
              key={s.mapbox_id}
              className={`activity-search-option ${i === activeIndex ? 'active' : ''}`}
              onClick={() => retrieveAndAdd(s)}
              data-testid="activity-search-option"
            >
              <span className="activity-search-name">{s.name}</span>
              {s.address && <span className="activity-search-address">{s.address}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
