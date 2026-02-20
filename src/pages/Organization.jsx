import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrgStore } from '../stores/orgStore'
import { useAuthStore } from '../stores/authStore'
import { useToast } from '../hooks/useToast'
import ConfirmDialog from '../components/ConfirmDialog'
import InviteMemberModal from '../components/InviteMemberModal'
import { formatDateTime } from '../utils/date'
import './Organization.css'

export default function Organization() {
  const navigate = useNavigate()
  const { user, checkAuth } = useAuthStore()
  const {
    organization,
    members,
    invites,
    orgTrips,
    stats,
    isLoading,
    loadOrganization,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    loadMembers,
    inviteMember,
    removeMember,
    updateMemberRole,
    revokeInvite,
    loadOrgTrips,
    loadStats,
    loadInvites,
    leaveOrganization,
  } = useOrgStore()

  const [orgName, setOrgName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const { toast, showToast } = useToast()

  const isAdmin = user?.organization?.role === 'admin'

  useEffect(() => {
    loadOrganization()
  }, [loadOrganization])

  useEffect(() => {
    if (organization) {
      loadMembers()
      if (isAdmin) {
        loadInvites()
        loadOrgTrips()
        loadStats()
      }
    }
  }, [organization, isAdmin, loadMembers, loadInvites, loadOrgTrips, loadStats])

  useEffect(() => {
    if (organization) {
      setNewName(organization.name || '')
    }
  }, [organization])

  async function handleCreateOrg(e) {
    e.preventDefault()
    if (!orgName.trim()) return

    setIsCreating(true)
    try {
      await createOrganization(orgName.trim())
      await checkAuth() // Refresh user to get organization data
      showToast('Organization created successfully')
    } catch (err) {
      showToast(err.message || 'Failed to create organization')
    } finally {
      setIsCreating(false)
    }
  }

  async function handleUpdateName() {
    if (!newName.trim() || newName === organization.name) {
      setEditingName(false)
      setNewName(organization.name)
      return
    }

    try {
      await updateOrganization({ name: newName.trim() })
      await checkAuth() // Refresh user
      setEditingName(false)
      showToast('Organization name updated')
    } catch (err) {
      showToast(err.message || 'Failed to update name')
      setNewName(organization.name)
      setEditingName(false)
    }
  }

  async function handleDelete() {
    try {
      await deleteOrganization()
      await checkAuth() // Refresh user
      showToast('Organization deleted')
      setShowDeleteConfirm(false)
    } catch (err) {
      showToast(err.message || 'Failed to delete organization')
    }
  }

  async function handleLeave() {
    try {
      await leaveOrganization()
      await checkAuth() // Refresh user
      showToast('Left organization')
      setShowLeaveConfirm(false)
    } catch (err) {
      showToast(err.message || 'Failed to leave organization')
    }
  }

  async function handleInvite(email, role) {
    await inviteMember(email, role)
    showToast('Invitation sent')
  }

  async function handleRevokeInvite(inviteId) {
    try {
      await revokeInvite(inviteId)
      showToast('Invite revoked')
    } catch (err) {
      showToast(err.message || 'Failed to revoke invite')
    }
  }

  async function handleRemoveMember(userId, userEmail) {
    if (!confirm(`Remove ${userEmail} from the organization?`)) return

    try {
      await removeMember(userId)
      showToast('Member removed')
    } catch (err) {
      showToast(err.message || 'Failed to remove member')
    }
  }

  async function handleChangeRole(userId, userEmail, currentRole) {
    const newRole = currentRole === 'admin' ? 'designer' : 'admin'
    if (!confirm(`Change ${userEmail} role to ${newRole}?`)) return

    try {
      await updateMemberRole(userId, newRole)
      showToast('Role updated')
    } catch (err) {
      showToast(err.message || 'Failed to update role')
    }
  }

  // No organization state
  if (!isLoading && !organization) {
    return (
      <div className="organization-page">
        <header className="org-page-header">
          <button className="btn-header-icon" onClick={() => navigate('/')} title="Home">
            ←
          </button>
          <h1 className="org-page-title">Organization</h1>
        </header>

        <div className="org-create-container">
          <div className="org-create-card">
            <h2 className="org-create-title">Create Organization</h2>
            <p className="org-create-description">
              Start collaborating with your team on travel planning
            </p>
            <form onSubmit={handleCreateOrg}>
              <div className="form-field">
                <label className="form-label" htmlFor="org-name">
                  Organization Name
                </label>
                <input
                  id="org-name"
                  type="text"
                  className="form-input"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Acme Travel Agency"
                  autoFocus
                  maxLength={100}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn-save org-create-submit"
                disabled={isCreating || !orgName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create Organization'}
              </button>
            </form>
          </div>
        </div>

        {toast && <div className="org-toast">{toast}</div>}
      </div>
    )
  }

  return (
    <div className="organization-page">
      <header className="org-page-header">
        <button className="btn-header-icon" onClick={() => navigate('/')} title="Home">
          ←
        </button>
        <h1 className="org-page-title">Organization</h1>
      </header>

      <div className="org-content">
        {/* Organization Header */}
        <section className="org-section">
          <div className="org-header-card">
            <div className="org-header-top">
              {editingName ? (
                <div className="org-name-edit">
                  <input
                    type="text"
                    className="org-name-input"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onBlur={handleUpdateName}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleUpdateName()
                      if (e.key === 'Escape') {
                        setEditingName(false)
                        setNewName(organization.name)
                      }
                    }}
                    autoFocus
                    maxLength={100}
                  />
                </div>
              ) : (
                <h2 className="org-name">
                  {organization?.name}
                  {isAdmin && (
                    <button
                      className="org-name-edit-btn"
                      onClick={() => setEditingName(true)}
                      title="Edit name"
                      aria-label="Edit organization name"
                    >
                      ✏️
                    </button>
                  )}
                </h2>
              )}
              <div className="org-header-badges">
                <span className={`org-role-badge role-${user?.organization?.role}`}>
                  {user?.organization?.role}
                </span>
                <span className="org-member-count">
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>

            <div className="org-header-actions">
              {isAdmin ? (
                showDeleteConfirm ? (
                  <ConfirmDialog
                    message="Are you sure? All members will lose access to organization trips."
                    confirmLabel="Delete Organization"
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                  />
                ) : (
                  <button
                    className="btn-org-danger"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete Organization
                  </button>
                )
              ) : (
                showLeaveConfirm ? (
                  <ConfirmDialog
                    message="Are you sure you want to leave this organization?"
                    confirmLabel="Leave Organization"
                    onConfirm={handleLeave}
                    onCancel={() => setShowLeaveConfirm(false)}
                  />
                ) : (
                  <button
                    className="btn-org-secondary"
                    onClick={() => setShowLeaveConfirm(true)}
                  >
                    Leave Organization
                  </button>
                )
              )}
            </div>
          </div>
        </section>

        {/* Team Members */}
        <section className="org-section">
          <div className="org-section-header">
            <h3 className="org-section-title">Team Members</h3>
            {isAdmin && (
              <button
                className="btn-org-primary"
                onClick={() => setShowInviteModal(true)}
              >
                + Invite Member
              </button>
            )}
          </div>

          <div className="org-table-wrapper">
            <table className="org-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Trips</th>
                  <th>Joined</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr key={member.id}>
                    <td>
                      <div className="member-email">
                        {member.email}
                        {member.id === user?.id && (
                          <span className="member-you-badge">you</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge role-${member.role}`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="member-trips">{member.tripCount || 0}</td>
                    <td className="member-date">{formatDateTime(member.createdAt)}</td>
                    {isAdmin && (
                      <td>
                        <div className="member-actions">
                          {member.id !== user?.id && (
                            <>
                              <button
                                className="btn-member-action"
                                onClick={() => handleChangeRole(member.id, member.email, member.role)}
                                title="Change role"
                              >
                                Change role
                              </button>
                              <button
                                className="btn-member-action btn-member-remove"
                                onClick={() => handleRemoveMember(member.id, member.email)}
                                title="Remove member"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pending Invites (Admin only) */}
        {isAdmin && invites.length > 0 && (
          <section className="org-section">
            <h3 className="org-section-title">Pending Invites</h3>
            <div className="invites-list">
              {invites.map(invite => (
                <div key={invite.id} className="invite-item">
                  <div className="invite-info">
                    <span className="invite-email">{invite.email}</span>
                    <span className={`role-badge role-${invite.role}`}>
                      {invite.role}
                    </span>
                    <span className="invite-expires">
                      Expires {formatDateTime(invite.expiresAt)}
                    </span>
                  </div>
                  <button
                    className="btn-invite-revoke"
                    onClick={() => handleRevokeInvite(invite.id)}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All Trips (Admin only) */}
        {isAdmin && orgTrips.length > 0 && (
          <section className="org-section">
            <h3 className="org-section-title">All Trips</h3>
            <div className="org-table-wrapper">
              <table className="org-table">
                <thead>
                  <tr>
                    <th>Trip Name</th>
                    <th>Country</th>
                    <th>Designer</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {orgTrips.map(trip => (
                    <tr
                      key={trip.id}
                      className="trip-row"
                      onClick={() => navigate(`/trip/${trip.id}`)}
                    >
                      <td className="trip-name">{trip.name}</td>
                      <td className="trip-country">{trip.countryCode}</td>
                      <td className="trip-designer">{trip.designerEmail}</td>
                      <td>
                        <span className={`status-badge status-${trip.status}`}>
                          {trip.status}
                        </span>
                      </td>
                      <td className="trip-date">{formatDateTime(trip.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Stats (Admin only) */}
        {isAdmin && stats && (
          <section className="org-section">
            <h3 className="org-section-title">Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.totalTrips || 0}</div>
                <div className="stat-label">Total Trips</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {stats.tripsPerDesigner?.toFixed(1) || '0.0'}
                </div>
                <div className="stat-label">Trips per Designer</div>
              </div>
            </div>
          </section>
        )}
      </div>

      {showInviteModal && (
        <InviteMemberModal
          onInvite={handleInvite}
          onClose={() => setShowInviteModal(false)}
          isLoading={isLoading}
        />
      )}

      {toast && <div className="org-toast">{toast}</div>}
    </div>
  )
}
