/**
 * Date formatting utilities.
 *
 * All functions that accept a date-only string (YYYY-MM-DD) append 'T00:00:00'
 * to avoid timezone-shift issues when constructing a Date.
 */

/** "Wed, Jan 8" */
export function formatDateWithDay(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "Jan 8" */
export function formatDateShort(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  })
}

/** "Jan 8, 3:45 PM" — for ISO timestamps (with time component) */
export function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** "Wed, Jan 8, 2025" */
export function formatDateFull(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

/** "Jan 8, 2025" (no weekday) */
function formatDateWithYear(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

/** "Jan 8, 2025 – Jan 18, 2025" (returns null when both dates are absent) */
export function formatDateRange(start, end) {
  if (!start) return null
  const s = formatDateWithYear(start)
  if (!end) return s
  const e = formatDateWithYear(end)
  return `${s} \u2013 ${e}`
}
