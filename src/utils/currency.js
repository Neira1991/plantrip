export const CURRENCY_OPTIONS = [
  { code: 'EUR', label: 'EUR (\u20AC)' },
  { code: 'USD', label: 'USD ($)' },
  { code: 'GBP', label: 'GBP (\u00A3)' },
  { code: 'JPY', label: 'JPY (\u00A5)' },
  { code: 'CHF', label: 'CHF' },
  { code: 'CAD', label: 'CAD ($)' },
  { code: 'AUD', label: 'AUD ($)' },
  { code: 'NZD', label: 'NZD ($)' },
  { code: 'SEK', label: 'SEK (kr)' },
  { code: 'NOK', label: 'NOK (kr)' },
  { code: 'DKK', label: 'DKK (kr)' },
  { code: 'PLN', label: 'PLN (z\u0142)' },
  { code: 'CZK', label: 'CZK (K\u010D)' },
  { code: 'HUF', label: 'HUF (Ft)' },
  { code: 'THB', label: 'THB (\u0E3F)' },
  { code: 'BRL', label: 'BRL (R$)' },
  { code: 'MXN', label: 'MXN ($)' },
  { code: 'INR', label: 'INR (\u20B9)' },
  { code: 'KRW', label: 'KRW (\u20A9)' },
  { code: 'TRY', label: 'TRY (\u20BA)' },
]

const formatterCache = {}

export function formatPrice(price, currency = 'EUR') {
  if (price == null) return null
  const key = currency
  if (!formatterCache[key]) {
    try {
      formatterCache[key] = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    } catch {
      // Fallback for unknown currency codes
      return `${price.toFixed(2)} ${currency}`
    }
  }
  return formatterCache[key].format(price)
}
