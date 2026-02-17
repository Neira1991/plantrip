import { useState, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import TripsTrigger from './components/TripsTrigger'
import TripsPanel from './components/TripsPanel/TripsPanel'
import Home from './pages/Home'
import TripDetail from './pages/TripDetail'
import './App.css'

function App() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const togglePanel = useCallback(() => setIsPanelOpen(prev => !prev), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  return (
    <>
      <TripsTrigger isOpen={isPanelOpen} onToggle={togglePanel} />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trip/:id" element={<TripDetail />} />
      </Routes>

      <TripsPanel isOpen={isPanelOpen} onClose={closePanel} />
    </>
  )
}

export default App
