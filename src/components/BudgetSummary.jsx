import { formatPrice } from '../utils/currency'

export default function BudgetSummary({ budget, currency, className = '' }) {
  if (!budget || !budget.grandTotal || budget.grandTotal <= 0) return null

  return (
    <div className={`budget-summary${className ? ` ${className}` : ''}`} data-testid="budget-summary">
      <h3 className="budget-title">Budget</h3>
      {budget.activitiesTotal > 0 && (
        <div className="budget-row">
          <span>Activities</span>
          <span>{formatPrice(budget.activitiesTotal, currency)}</span>
        </div>
      )}
      {budget.accommodationTotal > 0 && (
        <div className="budget-row">
          <span>Accommodation</span>
          <span>{formatPrice(budget.accommodationTotal, currency)}</span>
        </div>
      )}
      {budget.transportTotal > 0 && (
        <div className="budget-row">
          <span>Transport</span>
          <span>{formatPrice(budget.transportTotal, currency)}</span>
        </div>
      )}
      <div className="budget-row budget-total">
        <span>Total</span>
        <span>{formatPrice(budget.grandTotal, currency)}</span>
      </div>
    </div>
  )
}
