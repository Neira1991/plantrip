import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import './MapboxMap.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

const MOVEMENT_STYLES = {
  plane: { color: '#667eea', dasharray: [2, 4] },
  train: { color: '#667eea', dasharray: null },
  car: { color: '#888', dasharray: null },
  bus: { color: '#888', dasharray: [4, 2] },
  ferry: { color: '#4fc3f7', dasharray: [1, 3] },
  other: { color: '#666', dasharray: [2, 2] },
}

export default function MapboxMap({ countryName, stops = [], movements = [], activities = [] }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const activityMarkersRef = useRef([])
  const stopsRef = useRef(stops)

  useEffect(() => {
    stopsRef.current = stops
  })

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

    // Fly to country if no stops yet
    if (stopsRef.current.length === 0) {
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

    // Resize map when container dimensions change
    const ro = new ResizeObserver(() => {
      setTimeout(() => m.resize(), 0)
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      m.remove()
      mapRef.current = null
    }
  }, [countryName])

  // Sync markers (numbered)
  useEffect(() => {
    const m = mapRef.current
    if (!m) return

    // Clear old markers
    markersRef.current.forEach(mk => mk.remove())
    markersRef.current = []

    const sortedStops = [...stops].sort((a, b) => a.sortIndex - b.sortIndex)

    sortedStops.forEach((stop, i) => {
      const el = document.createElement('div')
      el.className = 'stop-marker'
      el.textContent = String(i + 1)

      const popup = new mapboxgl.Popup({ offset: 16, closeButton: false })
        .setText(stop.name)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(popup)
        .addTo(m)

      markersRef.current.push(marker)
    })

    // Fit bounds
    if (sortedStops.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      sortedStops.forEach(s => bounds.extend([s.lng, s.lat]))
      const fit = () => m.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 600 })
      if (m.loaded()) fit()
      else m.once('load', fit)
    }
  }, [stops])

  // Sync route lines
  useEffect(() => {
    const m = mapRef.current
    if (!m) return

    function clearRoutes() {
      try {
        if (!m.isStyleLoaded()) return
        const style = m.getStyle()
        if (!style) return
        ;(style.layers || []).forEach(layer => {
          if (layer.id.startsWith('route-')) {
            try { m.removeLayer(layer.id) } catch { /* layer already removed */ }
          }
        })
        Object.keys(style.sources || {}).forEach(src => {
          if (src.startsWith('route-')) {
            try { m.removeSource(src) } catch { /* source already removed */ }
          }
        })
      } catch { /* style not ready */ }
    }

    function drawRoutes() {
      clearRoutes()

      const sortedStops = [...stops].sort((a, b) => a.sortIndex - b.sortIndex)
      const movementByFromStop = Object.fromEntries(
        movements.map(mv => [mv.fromStopId, mv])
      )

      for (let i = 0; i < sortedStops.length - 1; i++) {
        const from = sortedStops[i]
        const to = sortedStops[i + 1]
        const movement = movementByFromStop[from.id]
        const style = MOVEMENT_STYLES[movement?.type] || MOVEMENT_STYLES.other
        const sourceId = `route-${i}`

        try {
          m.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [[from.lng, from.lat], [to.lng, to.lat]],
              },
            },
          })

          const paintProps = {
            'line-color': movement ? style.color : '#333',
            'line-width': movement ? 2 : 1,
            'line-opacity': movement ? 0.8 : 0.4,
          }
          if (style.dasharray) {
            paintProps['line-dasharray'] = style.dasharray
          }

          m.addLayer({
            id: sourceId,
            type: 'line',
            source: sourceId,
            paint: paintProps,
          })
        } catch { /* source/layer conflict */ }
      }
    }

    if (m.loaded() && m.isStyleLoaded()) {
      drawRoutes()
    } else {
      m.once('load', drawRoutes)
    }

    return () => clearRoutes()
  }, [stops, movements])

  // Sync activity markers
  useEffect(() => {
    const m = mapRef.current
    if (!m) return

    // Clear old activity markers
    activityMarkersRef.current.forEach(mk => mk.remove())
    activityMarkersRef.current = []

    activities.forEach(activity => {
      const el = document.createElement('div')
      el.className = 'activity-marker'

      const popup = new mapboxgl.Popup({ offset: 10, closeButton: false })
        .setText(activity.title)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([activity.lng, activity.lat])
        .setPopup(popup)
        .addTo(m)

      activityMarkersRef.current.push(marker)
    })

    // Re-fit bounds to include activity markers
    if (stops.length > 0 || activities.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      stops.forEach(s => bounds.extend([s.lng, s.lat]))
      activities.forEach(a => bounds.extend([a.lng, a.lat]))
      const fit = () => m.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 600 })
      if (m.loaded()) fit()
      else m.once('load', fit)
    }
  }, [activities, stops])

  if (!MAPBOX_TOKEN) {
    return (
      <div className="mapbox-placeholder">
        <p>Set <code>VITE_MAPBOX_TOKEN</code> in your .env file to enable the map</p>
      </div>
    )
  }

  return <div ref={containerRef} className="mapbox-container" />
}
