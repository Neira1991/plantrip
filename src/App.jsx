import { useState } from 'react'
import CountryAutocomplete from './components/CountryAutocomplete'
import CountryShape from './components/CountryShape'
import './App.css'

function App() {
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [firstMatch, setFirstMatch] = useState(null)

  const bgCountry = firstMatch || selectedCountry

  return (
    <div className="app">
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

      <CountryAutocomplete onSelect={setSelectedCountry} onFirstMatch={setFirstMatch} />

      {selectedCountry && (
        <div className="selected-country" key={selectedCountry.code}>
          <CountryShape code={selectedCountry.code} colors={selectedCountry.colors} size={72} />
          <span className="selected-country-name">{selectedCountry.name}</span>
        </div>
      )}
    </div>
  )
}

export default App
