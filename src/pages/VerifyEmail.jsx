import { Link, useParams } from 'react-router-dom'
import { apiAdapter } from '../data/adapters/apiAdapter'
import { useAsyncLoad } from '../hooks/useAsyncLoad'
import AuthLayout from '../components/AuthLayout'

export default function VerifyEmail() {
  const { token } = useParams()
  const { loading, error } = useAsyncLoad(() => apiAdapter.verifyEmail(token), [token])

  return (
    <AuthLayout>
      {loading && (
        <p className="auth-subtitle">Verifying your email...</p>
      )}

      {!loading && !error && (
        <>
          <p className="auth-subtitle">Email verified!</p>
          <p style={{ color: '#aaa', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6 }}>
            Your email has been verified. You're all set.
          </p>
          <p className="auth-link" style={{ marginTop: 24 }}>
            <Link to="/">Go to dashboard</Link>
          </p>
        </>
      )}

      {!loading && error && (
        <>
          <p className="auth-subtitle">Verification failed</p>
          <div className="auth-error" style={{ textAlign: 'center' }}>{error}</div>
          <p className="auth-link" style={{ marginTop: 24 }}>
            <Link to="/">Go to dashboard</Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
