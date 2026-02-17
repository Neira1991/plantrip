import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CountryAutocomplete from '../components/CountryAutocomplete'
import CountryShape from '../components/CountryShape'
import { useTrips } from '../hooks/useTrips'
import './Home.css'

export default function Home() {
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [firstMatch, setFirstMatch] = useState(null)
  const { findByCountry } = useTrips()
  const navigate = useNavigate()

  const bgCountry = firstMatch || selectedCountry

  function handleCountrySelect(country) {
    setSelectedCountry(country)
    if (country) {
      const existingTrip = findByCountry(country.code)
      if (existingTrip) {
        navigate(`/trip/${existingTrip.id}`)
      } else {
        navigate(`/trip/new?country=${country.code}`)
      }
    }
  }

  return (
    <div className="home">
      {bgCountry && (
        <div className="background-flag" key={`bg-${bgCountry.code}`}>
          <CountryShape code={bgCountry.code} colors={bgCountry.colors} size={500} />
        </div>
      )}

      <header className="app-header">
        <h1 className="app-title">
          Plan<span>Trip</span>
        </h1>
        <p className="app-subtitle">Your next adventure starts here</p>
      </header>

      <CountryAutocomplete onSelect={handleCountrySelect} onFirstMatch={setFirstMatch} />

      {selectedCountry && (
        <div className="selected-country" key={selectedCountry.code}>
          <CountryShape code={selectedCountry.code} colors={selectedCountry.colors} size={72} />
          <span className="selected-country-name">{selectedCountry.name}</span>
        </div>
      )}
    </div>
  )
}
