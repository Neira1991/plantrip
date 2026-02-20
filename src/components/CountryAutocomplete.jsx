import { useState, useRef, useEffect, useMemo } from 'react'
import { countries } from '../data/static/countries'
import CountryShape from './CountryShape'
import './CountryAutocomplete.css'

function highlightMatch(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function CountryAutocomplete({ onSelect, onFirstMatch, initialValue = '' }) {
  const [query, setQuery] = useState(initialValue)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const containerRef = useRef(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return countries.filter(c => c.name.toLowerCase().includes(q)).slice(0, 7)
  }, [query])

  useEffect(() => {
    onFirstMatch?.(filtered.length > 0 ? filtered[0] : null)
  }, [filtered, onFirstMatch])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex]
      if (item) item.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  function selectCountry(country) {
    setQuery(country.name)
    setIsOpen(false)
    onSelect(country)
    inputRef.current?.blur()
  }

  function handleChange(e) {
    setQuery(e.target.value)
    setActiveIndex(-1)
    setIsOpen(true)
    if (!e.target.value.trim()) {
      onSelect(null)
    }
  }

  function handleKeyDown(e) {
    if (!isOpen || filtered.length === 0) {
      if (e.key === 'ArrowDown' && query.trim() && filtered.length > 0) {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < filtered.length) {
          selectCountry(filtered[activeIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setActiveIndex(-1)
        break
    }
  }

  const showDropdown = isOpen && filtered.length > 0

  return (
    <div className="autocomplete" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        className="autocomplete-input"
        data-testid="country-search-input"
        placeholder="Where do you want to go?"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (query.trim() && filtered.length > 0) setIsOpen(true) }}
        autoComplete="off"
        spellCheck={false}
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `country-option-${activeIndex}` : undefined}
      />
      <div className={`autocomplete-dropdown ${showDropdown ? 'open' : ''}`}>
        <ul ref={listRef} role="listbox">
          {filtered.map((country, i) => (
            <li
              key={country.code}
              id={`country-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`autocomplete-item ${i === activeIndex ? 'active' : ''}`}
              data-testid="country-option"
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                selectCountry(country)
              }}
            >
              <CountryShape code={country.code} colors={country.colors} size={24} />
              <span className="autocomplete-item-name">
                {highlightMatch(country.name, query)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
