import { useState, useEffect, useCallback } from 'react'
import { apiAdapter } from '../data/adapters/apiAdapter'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { formatDateTime } from '../utils/date'
import './VersionsPanel.css'

export default function VersionsPanel({ isOpen, onClose, tripId, onRestored }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(false)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(null)
  const [restoring, setRestoring] = useState(false)

  const loadVersions = useCallback(async () => {
    if (!tripId) return
    setLoading(true)
    try {
      const data = await apiAdapter.listVersions(tripId)
      setVersions(Array.isArray(data) ? data : [])
    } catch {
      setVersions([])
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    if (isOpen) {
      loadVersions()
      setConfirmRestore(null)
    }
  }, [isOpen, loadVersions])

  const handleEscape = useCallback(() => {
    if (confirmRestore) {
      setConfirmRestore(null)
    } else {
      onClose()
    }
  }, [confirmRestore, onClose])

  useEscapeKey(handleEscape, isOpen)

  async function handleSave() {
    if (saving || !label.trim()) return
    setSaving(true)
    try {
      await apiAdapter.createVersion(tripId, { label: label.trim() })
      setLabel('')
      await loadVersions()
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  async function handleRestore(versionId) {
    if (confirmRestore === versionId) {
      setRestoring(true)
      try {
        await apiAdapter.restoreVersion(tripId, versionId)
        setConfirmRestore(null)
        onRestored()
        onClose()
      } catch {
        // silently fail
      } finally {
        setRestoring(false)
      }
    } else {
      setConfirmRestore(versionId)
    }
  }

  async function handleDelete(versionId) {
    try {
      await apiAdapter.deleteVersion(tripId, versionId)
      setVersions(prev => prev.filter(v => v.id !== versionId))
    } catch {
      // silently fail
    }
  }

  function handleSaveKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <>
      <div
        className={`versions-panel-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />
      <aside
        className={`versions-panel ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-labelledby="versions-panel-title"
        aria-modal="true"
      >
        <header className="versions-panel-header">
          <button className="versions-panel-close" onClick={onClose} aria-label="Close versions panel">
            {'\u2715'}
          </button>
          <h2 id="versions-panel-title" className="versions-panel-title">Versions</h2>
          <div style={{ width: 48 }} />
        </header>

        <div className="versions-save-form">
          <input
            type="text"
            className="versions-save-input"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={handleSaveKeyDown}
            placeholder="Version label..."
            maxLength={200}
          />
          <button
            className="versions-save-btn"
            onClick={handleSave}
            disabled={saving || !label.trim()}
          >
            {saving ? 'Saving...' : 'Save Version'}
          </button>
        </div>

        <div className="versions-panel-content">
          {loading ? (
            <div className="versions-panel-loading">Loading versions...</div>
          ) : versions.length === 0 ? (
            <div className="versions-panel-empty">No saved versions yet</div>
          ) : (
            <div className="versions-list">
              {versions.map(version => (
                <div key={version.id} className="version-item">
                  <div className="version-item-info">
                    <span className="version-badge">v{version.versionNumber}</span>
                    <div className="version-item-details">
                      <span className="version-label">{version.label || 'Untitled'}</span>
                      <span className="version-date">{formatDateTime(version.createdAt)}</span>
                    </div>
                  </div>
                  <div className="version-item-actions">
                    {confirmRestore === version.id ? (
                      <>
                        <span className="version-confirm-text">Restore?</span>
                        <button
                          className="version-confirm-btn"
                          onClick={() => handleRestore(version.id)}
                          disabled={restoring}
                        >
                          {restoring ? '...' : 'Yes'}
                        </button>
                        <button
                          className="version-cancel-btn"
                          onClick={() => setConfirmRestore(null)}
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="version-restore-btn"
                          onClick={() => handleRestore(version.id)}
                          aria-label={`Restore version ${version.label}`}
                        >
                          Restore
                        </button>
                        <button
                          className="version-delete-btn"
                          onClick={() => handleDelete(version.id)}
                          aria-label={`Delete version ${version.label}`}
                        >
                          {'\u2715'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
