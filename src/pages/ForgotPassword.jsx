import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiAdapter } from '../data/adapters/apiAdapter'
import AuthLayout from '../components/AuthLayout'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await apiAdapter.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout>
      {sent ? (
        <>
          <p className="auth-subtitle">Check your email</p>
          <p style={{ color: '#aaa', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6 }}>
            If an account exists for <strong style={{ color: '#e0e0e0' }}>{email}</strong>, we've sent a password reset link.
          </p>
          <p className="auth-link" style={{ marginTop: 24 }}>
            <Link to="/login">Back to sign in</Link>
          </p>
        </>
      ) : (
        <>
          <p className="auth-subtitle">Reset your password</p>
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error">{error}</div>}
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="auth-submit"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
          <p className="auth-link">
            Remember your password? <Link to="/login">Sign in</Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
