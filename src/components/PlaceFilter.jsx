import './PlaceFilter.css'

const CATEGORIES = [
  { key: 'cultural', label: 'Cultural' },
  { key: 'natural', label: 'Natural' },
  { key: 'architecture', label: 'Architecture' },
  { key: 'historic', label: 'Historic' },
  { key: 'religion', label: 'Religion' },
  { key: 'amusements', label: 'Amusements' },
  { key: 'foods', label: 'Food' },
  { key: 'shops', label: 'Shops' },
  { key: 'sport', label: 'Sport' },
  { key: 'transport', label: 'Transport' },
]

export default function PlaceFilter({ selected, onChange }) {
  const toggle = (key) => {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key))
    } else {
      onChange([...selected, key])
    }
  }

  return (
    <div className="place-filter">
      {CATEGORIES.map(cat => (
        <button
          key={cat.key}
          className={`place-filter-chip ${selected.includes(cat.key) ? 'active' : ''}`}
          onClick={() => toggle(cat.key)}
          type="button"
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}
