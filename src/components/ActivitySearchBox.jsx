import { useState, useRef, useEffect, useCallback } from 'react'
import { apiAdapter } from '../data/adapters/apiAdapter'
import './ActivitySearchBox.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

function stripHtml(str) {
  if (!str) return ''
  return str.replace(/<[^>]*>/g, '')
}

function primaryKind(kinds) {
  if (!kinds) return null
  return kinds.split(',')[0].replace(/_/g, ' ')
}

export default function ActivitySearchBox({ stopLng, stopLat, countryCode, date, onAdd, testId }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [searchMode, setSearchMode] = useState('mapbox') // 'mapbox' or 'otm'
  const [otmAvailable, setOtmAvailable] = useState(true)
  const [loading, setLoading] = useState(false)
  const sessionToken = useRef(crypto.randomUUID())
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  // -- OpenTripMap search --
  const fetchOtmSuggestions = useCallback(async (q) => {
    if (q.length < 3 || stopLat == null || stopLng == null) {
      setSuggestions([])
      setOpen(false)
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        name: q,
        lat: String(stopLat),
        lon: String(stopLng),
        radius: '10000',
        rate: '1',
        limit: '15',
      })
      const data = await apiAdapter.get(`/places/autosuggest?${params}`)
      const items = (Array.isArray(data) ? data : [])
        .filter(p => p.name)
        .map(p => ({
          source: 'otm',
          xid: p.xid,
          name: stripHtml(p.highlightedName || p.name),
          kinds: p.kinds || '',
          point: p.point,
          rate: p.rate || 0,
        }))
      setSuggestions(items)
      setOpen(items.length > 0)
      setActiveIndex(-1)
    } catch {
      // OTM returned an error — mark it unavailable and auto-switch to Mapbox
      setOtmAvailable(false)
      setSearchMode('mapbox')
      setSuggestions([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [stopLng, stopLat])

  // -- Mapbox search (existing behavior) --
  const fetchMapboxSuggestions = useCallback(async (q) => {
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

      if ((data.suggestions || []).length === 0 && countryCode) {
        res = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/suggest?${buildParams(false)}`
        )
        data = await res.json()
      }

      const items = (data.suggestions || []).map(s => ({
        source: 'mapbox',
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
    const trimmed = val.trim()
    const minLen = searchMode === 'otm' ? 3 : 2
    if (trimmed.length < minLen) {
      setSuggestions([])
      setOpen(false)
      return
    }
    const fetcher = searchMode === 'otm' ? fetchOtmSuggestions : fetchMapboxSuggestions
    debounceRef.current = setTimeout(() => fetcher(trimmed), 300)
  }

  const retrieveOtmAndAdd = async (suggestion) => {
    const title = suggestion.name
    let lng = suggestion.point?.lon ?? null
    let lat = suggestion.point?.lat ?? null
    let address = ''
    let notes = ''

    try {
      const detail = await apiAdapter.get(`/places/${suggestion.xid}`)
      if (detail.point) {
        lng = detail.point.lon ?? lng
        lat = detail.point.lat ?? lat
      }
      if (detail.address) {
        const parts = [detail.address.road, detail.address.city, detail.address.country].filter(Boolean)
        address = parts.join(', ')
      }
      if (detail.wikipediaExtracts?.text) {
        notes = detail.wikipediaExtracts.text.slice(0, 300)
      }
    } catch {
      // Use basic data from autosuggest
    }

    onAdd({ title, date, lng, lat, address, notes })
    setQuery('')
    setSuggestions([])
    setOpen(false)
  }

  const retrieveMapboxAndAdd = async (suggestion) => {
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

  const handleSelect = (suggestion) => {
    if (suggestion.source === 'otm') {
      retrieveOtmAndAdd(suggestion)
    } else {
      retrieveMapboxAndAdd(suggestion)
    }
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
        handleSelect(suggestions[activeIndex])
      } else {
        const title = query.trim()
        if (!title) return
        onAdd({ title, date })
        setQuery('')
        setSuggestions([])
        setOpen(false)
      }
    }
  }

  const toggleMode = () => {
    const next = searchMode === 'otm' ? 'mapbox' : 'otm'
    setSearchMode(next)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
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
      <div className="activity-search-input-row">
        <input
          type="text"
          className="add-activity-input"
          placeholder={searchMode === 'otm' ? 'Search places...' : 'Search by address...'}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={200}
          data-testid={testId}
        />
        {otmAvailable && (
          <button
            type="button"
            className="activity-search-mode-toggle"
            onClick={toggleMode}
            title={searchMode === 'otm' ? 'Switch to address search' : 'Switch to place search'}
          >
            {searchMode === 'otm' ? 'Address' : 'Places'}
          </button>
        )}
      </div>
      {open && suggestions.length > 0 && (
        <div className="activity-search-dropdown" data-testid="activity-search-dropdown">
          {suggestions.map((s, i) => (
            <button
              key={s.xid || s.mapbox_id || i}
              className={`activity-search-option ${i === activeIndex ? 'active' : ''}`}
              onClick={() => handleSelect(s)}
              data-testid="activity-search-option"
            >
              <span className="activity-search-name">{s.name}</span>
              {s.source === 'otm' && s.kinds && (
                <span className="activity-search-kind">{primaryKind(s.kinds)}</span>
              )}
              {s.source === 'mapbox' && s.address && (
                <span className="activity-search-address">{s.address}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {loading && <div className="activity-search-loading" />}
    </div>
  )
}
