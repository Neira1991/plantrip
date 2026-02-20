import { useState, useRef, useEffect, useCallback } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import './CityAutocomplete.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function CityAutocomplete({ countryCode, onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEscapeKey(onClose)

  const search = useCallback(async (q) => {
    if (!q.trim() || !MAPBOX_TOKEN) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&types=place&country=${countryCode.toLowerCase()}&limit=5`
      const res = await fetch(url)
      const data = await res.json()
      setResults(
        data.features?.map(f => ({
          id: f.id,
          name: f.text,
          fullName: f.place_name,
          lng: f.center[0],
          lat: f.center[1],
        })) || []
      )
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [countryCode])

  function handleInput(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  function handleSelect(city) {
    onSelect({
      id: crypto.randomUUID(),
      name: city.name,
      lng: city.lng,
      lat: city.lat,
    })
    onClose()
  }

  return (
    <div className="city-search-overlay" onClick={onClose}>
      <div className="city-search-box" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="city-search-input"
          data-testid="city-search-input"
          value={query}
          onChange={handleInput}
          placeholder="Search for a city..."
        />
        {loading && <div className="city-search-loading">Searching...</div>}
        {results.length > 0 && (
          <ul className="city-search-results">
            {results.map(r => (
              <li key={r.id} className="city-search-result" data-testid="city-search-result" onClick={() => handleSelect(r)}>
                <span className="city-result-name">{r.name}</span>
                <span className="city-result-region">{r.fullName}</span>
              </li>
            ))}
          </ul>
        )}
        {!loading && query.trim().length > 0 && results.length === 0 && (
          <div className="city-search-empty">No cities found</div>
        )}
      </div>
    </div>
  )
}
