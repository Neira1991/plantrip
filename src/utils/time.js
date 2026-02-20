/**
 * Time and duration formatting utilities.
 */

/**
 * Format a duration in minutes to a compact string.
 * formatDuration(90)  => "1h30m"
 * formatDuration(60)  => "1h"
 * formatDuration(45)  => "45m"
 * formatDuration(0)   => ""
 */
export function formatDuration(mins) {
  if (!mins) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${m}m`
}

/**
 * Format a "HH:MM" time string to 12-hour format.
 * formatTime("14:30") => "2:30 PM"
 * formatTime("09:05") => "9:05 AM"
 */
export function formatTime(timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}
