import { countries } from '../static/countries'

export function validateTrip(data) {
  const errors = []

  if (!data.countryCode) {
    errors.push('Country is required')
  } else if (!countries.find(c => c.code === data.countryCode)) {
    errors.push('Invalid country')
  }

  if (data.name && data.name.length > 200) {
    errors.push('Trip name must be 200 characters or less')
  }

  if (data.startDate && data.endDate) {
    if (new Date(data.endDate) < new Date(data.startDate)) {
      errors.push('End date must be after start date')
    }
  }

  if (data.notes && data.notes.length > 10000) {
    errors.push('Notes must be 10,000 characters or less')
  }

  return { valid: errors.length === 0, errors }
}
