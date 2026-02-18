import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import './Auth.css'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState('')
  const { register, error, isLoading, clearError } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters')
      return
    }

    try {
      await register(email, password)
      navigate('/')
    } catch {
      // error is already set in store
    }
  }

  const displayError = localError || error

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">
          plan<span>trip</span>
        </h1>
        <p className="auth-subtitle">Create your account</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {displayError && <div className="auth-error" data-testid="auth-error">{displayError}</div>}

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              data-testid="auth-email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError(); setLocalError('') }}
              required
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              data-testid="auth-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); setLocalError('') }}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              data-testid="auth-confirm-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearError(); setLocalError('') }}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit"
            data-testid="auth-submit"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
