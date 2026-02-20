import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import AuthLayout from '../components/AuthLayout'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, error, isLoading, clearError } = useAuthStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await login(email, password)
      navigate(redirect || '/')
    } catch {
      // error is already set in store
    }
  }

  return (
    <AuthLayout>
      <p className="auth-subtitle">Sign in to your account</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error" data-testid="auth-error">{error}</div>}

        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            data-testid="auth-email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearError() }}
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
            onChange={(e) => { setPassword(e.target.value); clearError() }}
            required
          />
        </div>

        <button
          type="submit"
          className="auth-submit"
          data-testid="auth-submit"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="auth-link">
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
      <p className="auth-link">
        Don't have an account? <Link to="/register">Create one</Link>
      </p>
    </AuthLayout>
  )
}
