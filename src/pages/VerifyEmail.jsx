import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiAdapter } from '../data/adapters/apiAdapter'
import './Auth.css'

export default function VerifyEmail() {
  const { token } = useParams()
  const [status, setStatus] = useState('verifying') // verifying | success | error
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function verify() {
      try {
        await apiAdapter.verifyEmail(token)
        if (!cancelled) setStatus('success')
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(err.message || 'Verification failed')
        }
      }
    }
    verify()
    return () => { cancelled = true }
  }, [token])

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">
          plan<span>trip</span>
        </h1>

        {status === 'verifying' && (
          <p className="auth-subtitle">Verifying your email...</p>
        )}

        {status === 'success' && (
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

        {status === 'error' && (
          <>
            <p className="auth-subtitle">Verification failed</p>
            <div className="auth-error" style={{ textAlign: 'center' }}>{error}</div>
            <p className="auth-link" style={{ marginTop: 24 }}>
              <Link to="/">Go to dashboard</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
