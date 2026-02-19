import { useState, useCallback, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import ProtectedRoute from './components/ProtectedRoute'
import TripsTrigger from './components/TripsTrigger'
import TripsPanel from './components/TripsPanel/TripsPanel'
import Home from './pages/Home'
import TripDetail from './pages/TripDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import InviteAccept from './pages/InviteAccept'
import SharedTrip from './pages/SharedTrip'
import ActivityDetail from './pages/ActivityDetail'
import Organization from './pages/Organization'
import './App.css'

function App() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const togglePanel = useCallback(() => setIsPanelOpen(prev => !prev), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  if (isLoading) {
    return null
  }

  return (
    <>
      {isAuthenticated && (
        <TripsTrigger isOpen={isPanelOpen} onToggle={togglePanel} />
      )}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/invite/:token" element={<InviteAccept />} />
        <Route path="/shared/:token" element={<SharedTrip />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trip/:id"
          element={
            <ProtectedRoute>
              <TripDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/trip/:tripId/activity/:activityId"
          element={
            <ProtectedRoute>
              <ActivityDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organization"
          element={
            <ProtectedRoute>
              <Organization />
            </ProtectedRoute>
          }
        />
      </Routes>

      {isAuthenticated && (
        <TripsPanel isOpen={isPanelOpen} onClose={closePanel} />
      )}
    </>
  )
}

export default App
