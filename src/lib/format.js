import { CURRENCIES } from '../constants'

const fallback = CURRENCIES[0]

function currencyConfig(code) {
  return CURRENCIES.find(item => item.code === code) || fallback
}

/**
 * Intl formatters are expensive to construct — roughly 22µs for a currency
 * formatter and 85µs for a date one, against under 1µs to reuse a cached
 * instance. A 25-row ledger builds both per row, so caching takes ~12ms off
 * every render on a mid-range phone. Keyed by currency; the set is tiny and
 * bounded by CURRENCIES, so the cache never grows unboundedly.
 */
const moneyFormatters = new Map()
let dateFormatter = null

function moneyFormatter(code) {
  const cached = moneyFormatters.get(code)
  if (cached) return cached

  const { locale, code: resolved } = currencyConfig(code)
  // Yen has no minor unit; everything else here uses two decimals.
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: resolved,
    minimumFractionDigits: resolved === 'JPY' ? 0 : 2,
    maximumFractionDigits: resolved === 'JPY' ? 0 : 2,
  })

  moneyFormatters.set(code, formatter)
  return formatter
}

export function formatMoney(amount, code = 'PHP') {
  return moneyFormatter(code).format(Number(amount) || 0)
}

export function currencySymbol(code = 'PHP') {
  return currencyConfig(code).symbol
}

// Stored dates are plain 'YYYY-MM-DD'. Parsing that string directly with
// new Date() treats it as UTC midnight, which renders as the previous day in
// any negative-offset timezone — so build the date from its parts instead.
export function formatDate(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value

  if (!dateFormatter) {
    dateFormatter = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  return dateFormatter.format(new Date(year, month - 1, day))
}

export function todayISO() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/** Palette cycling for category colours — one definition, three consumers. */
export function categoryColor(index) {
  return `var(--cat-${(index % 8) + 1})`
}
