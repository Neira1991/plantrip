import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Migrate v1 data (cities[] on Trip) to v2 (TripStop entities)
function migrateV1toV2() {
  const version = localStorage.getItem('plantrip_storage_version')
  if (version !== '1.0') return

  const trips = JSON.parse(localStorage.getItem('plantrip_trips') || '[]')
  const stops = []

  for (const trip of trips) {
    const cities = trip.cities || []
    for (let i = 0; i < cities.length; i++) {
      stops.push({
        id: crypto.randomUUID(),
        tripId: trip.id,
        sortIndex: i,
        name: cities[i].name,
        lng: cities[i].lng,
        lat: cities[i].lat,
        notes: '',
        createdAt: trip.updatedAt,
        updatedAt: trip.updatedAt,
      })
    }
    delete trip.cities
  }

  localStorage.setItem('plantrip_trips', JSON.stringify(trips))
  localStorage.setItem('plantrip_trip_stops', JSON.stringify(stops))
  localStorage.setItem('plantrip_movements', JSON.stringify([]))
  localStorage.setItem('plantrip_activities', JSON.stringify([]))
  localStorage.setItem('plantrip_storage_version', '2.0')
}

migrateV1toV2()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
