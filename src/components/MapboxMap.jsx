import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './MapboxMap.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

export default function MapboxMap({ countryName, cities = [] }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const citiesRef = useRef(cities)
  citiesRef.current = cities

  // Initialize map
  useEffect(() => {
    if (!MAPBOX_TOKEN || !containerRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [0, 20],
      zoom: 2,
      attributionControl: false,
    })

    m.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
    mapRef.current = m

    // Fly to country (only if no cities already – cities effect handles its own fit)
    if (citiesRef.current.length === 0) {
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(countryName)}.json?access_token=${MAPBOX_TOKEN}&types=country&limit=1`
      )
        .then(r => r.json())
        .then(data => {
          const feature = data.features?.[0]
          if (!feature) return
          if (feature.bbox) {
            const [w, s, e, n] = feature.bbox
            m.fitBounds([[w, s], [e, n]], { padding: 50, duration: 1200 })
          } else if (feature.center) {
            m.flyTo({ center: feature.center, zoom: 5, duration: 1200 })
          }
        })
        .catch(() => {})
    }

    return () => {
      m.remove()
      mapRef.current = null
    }
  }, [countryName])

  // Sync markers
  useEffect(() => {
    const m = mapRef.current
    if (!m) return

    markersRef.current.forEach(mk => mk.remove())
    markersRef.current = []

    cities.forEach(city => {
      const el = document.createElement('div')
      el.className = 'city-marker'

      const popup = new mapboxgl.Popup({ offset: 12, closeButton: false })
        .setText(city.name)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([city.lng, city.lat])
        .setPopup(popup)
        .addTo(m)

      markersRef.current.push(marker)
    })

    if (cities.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      cities.forEach(c => bounds.extend([c.lng, c.lat]))
      const fit = () => m.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 600 })
      if (m.loaded()) fit()
      else m.once('load', fit)
    }
  }, [cities])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="mapbox-placeholder">
        <p>Set <code>VITE_MAPBOX_TOKEN</code> in your .env file to enable the map</p>
      </div>
    )
  }

  return <div ref={containerRef} className="mapbox-container" />
}
