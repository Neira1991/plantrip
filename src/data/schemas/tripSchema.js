import { countries } from '../static/countries'

export function validateTrip(data) {
  const errors = []

  if (!data.countryCode) {
    errors.push('Country is required')
  } else if (!countries.find(c => c.code === data.countryCode)) {
    errors.push('Invalid country')
  }

  if (!data.startDate && !data.start_date) {
    errors.push('Start date is required')
  }

  if (data.name && data.name.length > 200) {
    errors.push('Trip name must be 200 characters or less')
  }

  if (data.notes && data.notes.length > 10000) {
    errors.push('Notes must be 10,000 characters or less')
  }

  if (data.currency && !/^[A-Z]{3}$/.test(data.currency)) {
    errors.push('Currency must be a 3-letter ISO code')
  }

  return { valid: errors.length === 0, errors }
}
