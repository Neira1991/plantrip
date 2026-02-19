import { useEffect, useState, useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { apiAdapter } from '../data/adapters/apiAdapter'
import './Auth.css'

export default function InviteAccept() {
  const { token } = useParams()
  const { isAuthenticated, user } = useAuthStore()
  const [invite, setInvite] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | accepting | accepted | error
  const [error, setError] = useState('')
  const acceptInvite = useCallback(async () => {
    setStatus('accepting')
    setError('')
    try {
      await apiAdapter.post(`/org/invites/${token}/accept`)
      setStatus('accepted')
    } catch (err) {
      setStatus('ready')
      setError(err.message || 'Failed to accept invite')
    }
  }, [token])

  useEffect(() => {
    let cancelled = false
    async function fetchAndMaybeAccept() {
      try {
        const data = await apiAdapter.getInviteInfo(token)
        if (cancelled) return
        setInvite(data)

        // Auto-accept if logged in with matching email
        if (isAuthenticated && user && user.email.toLowerCase() === data.email.toLowerCase()) {
          setStatus('accepting')
          try {
            await apiAdapter.post(`/org/invites/${token}/accept`)
            if (!cancelled) setStatus('accepted')
          } catch (err) {
            if (!cancelled) {
              setStatus('ready')
              setError(err.message || 'Failed to accept invite')
            }
          }
        } else {
          setStatus('ready')
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(err.message || 'Invite not found')
        }
      }
    }
    fetchAndMaybeAccept()
    return () => { cancelled = true }
  }, [token, isAuthenticated, user])

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">
          plan<span>trip</span>
        </h1>

        {status === 'loading' && (
          <p className="auth-subtitle">Loading invite...</p>
        )}

        {status === 'accepting' && (
          <p className="auth-subtitle">Accepting invite...</p>
        )}

        {status === 'error' && (
          <>
            <p className="auth-subtitle">Invite error</p>
            <div className="auth-error" style={{ textAlign: 'center' }}>{error}</div>
            <p className="auth-link" style={{ marginTop: 24 }}>
              <Link to="/">Go to dashboard</Link>
            </p>
          </>
        )}

        {status === 'accepted' && (
          <>
            <p className="auth-subtitle">You're in!</p>
            <p style={{ color: '#aaa', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6 }}>
              You've joined <strong style={{ color: '#e0e0e0' }}>{invite?.orgName}</strong> as a {invite?.role}.
            </p>
            <p className="auth-link" style={{ marginTop: 24 }}>
              <Link to="/">Go to dashboard</Link>
            </p>
          </>
        )}

        {status === 'ready' && invite && (
          <>
            <p className="auth-subtitle">You've been invited</p>
            <p style={{ color: '#aaa', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.6, margin: '0 0 24px' }}>
              Join <strong style={{ color: '#e0e0e0' }}>{invite.orgName}</strong> as a <strong style={{ color: '#e0e0e0' }}>{invite.role}</strong>.
            </p>
            {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

            {isAuthenticated ? (
              user?.email.toLowerCase() !== invite.email.toLowerCase() ? (
                <p style={{ color: '#e74c3c', fontSize: '0.9rem', textAlign: 'center' }}>
                  This invite is for <strong>{invite.email}</strong>. You're signed in as <strong>{user.email}</strong>.
                </p>
              ) : (
                <button className="auth-submit" onClick={acceptInvite}>
                  Accept Invite
                </button>
              )
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Link
                  to={`/login?redirect=/invite/${token}`}
                  className="auth-submit"
                  style={{ textAlign: 'center', textDecoration: 'none' }}
                >
                  Sign in to accept
                </Link>
                <p className="auth-link" style={{ margin: 0 }}>
                  Don't have an account? <Link to={`/register?redirect=/invite/${token}`}>Create one</Link>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
