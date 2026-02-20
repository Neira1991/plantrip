/**
 * Validate a password + confirmation pair.
 * @param {string} password
 * @param {string} confirmPassword
 * @returns {string|null} Error message, or null if valid.
 */
export function validatePassword(password, confirmPassword) {
  if (password !== confirmPassword) {
    return 'Passwords do not match'
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters'
  }
  return null
}
