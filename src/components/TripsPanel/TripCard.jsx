import CountryShape from '../CountryShape'
import { countries } from '../../data/static/countries'
import { formatDateRange } from '../../utils/date'

export default function TripCard({ trip, onClick }) {
  const country = countries.find(c => c.code === trip.countryCode)
  const dateStr = formatDateRange(trip.startDate, trip.endDate)

  return (
    <div className="trip-card" data-testid="trip-card" onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="trip-card-header">
        {country && <CountryShape code={country.code} colors={country.colors} size={24} />}
        <span className="trip-card-country">{country?.name || trip.countryCode}</span>
        <span className={`trip-card-status status-${trip.status}`}>{trip.status}</span>
      </div>
      <div className="trip-card-name">{trip.name}</div>
      {dateStr && <div className="trip-card-dates">{dateStr}</div>}
    </div>
  )
}
