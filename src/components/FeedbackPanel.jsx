import { useState, useEffect, useCallback } from 'react'
import { apiAdapter } from '../data/adapters/apiAdapter'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { formatDateTime } from '../utils/date'
import './FeedbackPanel.css'

export default function FeedbackPanel({ isOpen, onClose, tripId }) {
  const [versionGroups, setVersionGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('all')

  const loadFeedback = useCallback(async () => {
    if (!tripId) return
    setLoading(true)
    try {
      const data = await apiAdapter.getTripFeedback(tripId)
      setVersionGroups(Array.isArray(data?.versions) ? data.versions : [])
    } catch {
      setVersionGroups([])
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    if (isOpen) loadFeedback()
  }, [isOpen, loadFeedback])

  useEscapeKey(onClose, isOpen)

  const totalFeedback = versionGroups.reduce(
    (sum, vg) => sum + vg.activities.reduce((s, g) => s + g.feedback.length, 0),
    0
  )

  const filteredGroups = filter === 'all'
    ? versionGroups
    : versionGroups
        .map(vGroup => ({
          ...vGroup,
          activities: vGroup.activities
            .map(group => ({
              ...group,
              feedback: group.feedback.filter(f => f.sentiment === (filter === 'liked' ? 'like' : 'dislike')),
            }))
            .filter(group => group.feedback.length > 0),
        }))
        .filter(vGroup => vGroup.activities.length > 0)

  return (
    <>
      <div
        className={`feedback-panel-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />
      <aside
        className={`feedback-panel ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-labelledby="feedback-panel-title"
        aria-modal="true"
      >
        <header className="feedback-panel-header">
          <button className="feedback-panel-close" onClick={onClose} aria-label="Close feedback panel">
            {'\u2715'}
          </button>
          <h2 id="feedback-panel-title" className="feedback-panel-title">Feedback</h2>
          <div style={{ width: 48 }} />
        </header>

        <div className="feedback-panel-filters">
          {['all', 'liked', 'disliked'].map(tab => (
            <button
              key={tab}
              className={`feedback-filter-tab ${filter === tab ? 'active' : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab === 'all' ? 'All' : tab === 'liked' ? 'Liked' : 'Disliked'}
              {tab === 'all' && <span className="feedback-filter-count">{totalFeedback}</span>}
            </button>
          ))}
        </div>

        <div className="feedback-panel-content">
          {loading ? (
            <div className="feedback-panel-loading">Loading feedback...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="feedback-panel-empty">
              {totalFeedback === 0 ? 'No feedback received yet' : 'No matching feedback'}
            </div>
          ) : (
            filteredGroups.map(vGroup => (
              <div key={vGroup.versionId ?? 'unversioned'} className="feedback-version-group">
                <div className="feedback-version-header">
                  {vGroup.versionNumber != null
                    ? `v${vGroup.versionNumber}${vGroup.versionLabel ? ': ' + vGroup.versionLabel : ''}`
                    : 'Unversioned'}
                </div>
                {vGroup.activities.map(group => (
                  <div key={group.activityId ?? group.activityTitle} className="feedback-activity-group">
                    <div className="feedback-activity-header">
                      <span className="feedback-activity-title">{group.activityTitle || 'Unknown activity'}</span>
                      <span className="feedback-activity-counts">
                        {group.likes > 0 && <span className="feedback-count-like">{'\u{1F44D}'} {group.likes}</span>}
                        {group.dislikes > 0 && <span className="feedback-count-dislike">{'\u{1F44E}'} {group.dislikes}</span>}
                      </span>
                    </div>
                    {group.feedback.map(f => (
                      <div key={f.id} className="feedback-item">
                        <span className="feedback-item-icon">
                          {f.sentiment === 'like' ? '\u{1F44D}' : '\u{1F44E}'}
                        </span>
                        <div className="feedback-item-body">
                          <div className="feedback-item-meta">
                            <span className="feedback-item-name">{f.viewerName || 'Anonymous'}</span>
                            <span className="feedback-item-date">{formatDateTime(f.createdAt)}</span>
                          </div>
                          {f.message && <p className="feedback-item-message">{f.message}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  )
}
