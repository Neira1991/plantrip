import { useState } from 'react'
import './InviteMemberModal.css'

export default function InviteMemberModal({ onInvite, onClose, isLoading }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('designer')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    // Basic email validation
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    try {
      await onInvite(email.trim(), role)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to send invite')
    }
  }

  return (
    <div className="invite-modal-overlay" onClick={onClose}>
      <div className="invite-modal-card" onClick={e => e.stopPropagation()}>
        <h3 className="invite-modal-title">Invite Team Member</h3>
        <p className="invite-modal-description">
          Send an invitation to join your organization
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="invite-email">
              Email Address
            </label>
            <input
              id="invite-email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              autoFocus
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Role</label>
            <div className="role-selector">
              <label className="role-option">
                <input
                  type="radio"
                  name="role"
                  value="designer"
                  checked={role === 'designer'}
                  onChange={e => setRole(e.target.value)}
                  disabled={isLoading}
                />
                <div className="role-option-content">
                  <span className="role-option-name">Designer</span>
                  <span className="role-option-desc">Can create and manage trips</span>
                </div>
              </label>

              <label className="role-option">
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={role === 'admin'}
                  onChange={e => setRole(e.target.value)}
                  disabled={isLoading}
                />
                <div className="role-option-content">
                  <span className="role-option-name">Admin</span>
                  <span className="role-option-desc">Full access including team management</span>
                </div>
              </label>
            </div>
          </div>

          {error && <p className="invite-modal-error">{error}</p>}

          <div className="invite-modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
