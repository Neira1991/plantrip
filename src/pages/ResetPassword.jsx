import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiAdapter } from '../data/adapters/apiAdapter'
import './Auth.css'

export default function ResetPassword() {
  const { token } = useParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      await apiAdapter.resetPassword(token, password)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">
          plan<span>trip</span>
        </h1>

        {success ? (
          <>
            <p className="auth-subtitle">Password reset!</p>
            <p style={{ color: '#aaa', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6 }}>
              Your password has been updated. You can now sign in with your new password.
            </p>
            <p className="auth-link" style={{ marginTop: 24 }}>
              <Link to="/login">Sign in</Link>
            </p>
          </>
        ) : (
          <>
            <p className="auth-subtitle">Choose a new password</p>
            <form className="auth-form" onSubmit={handleSubmit}>
              {error && <div className="auth-error">{error}</div>}
              <div className="auth-field">
                <label htmlFor="password">New password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  required
                  autoFocus
                />
              </div>
              <div className="auth-field">
                <label htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
                  required
                />
              </div>
              <button
                type="submit"
                className="auth-submit"
                disabled={isLoading}
              >
                {isLoading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
            <p className="auth-link">
              <Link to="/login">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
