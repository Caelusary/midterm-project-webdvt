export const ALL_TIME = 'all'

export const WEEKDAYS = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 0, short: 'Sun', label: 'Sunday' },
]

/** 'YYYY-MM' for the month a 'YYYY-MM-DD' date falls in. */
export function monthOf(date) {
  return String(date).slice(0, 7)
}

export function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(month, delta) {
  const [year, index] = month.split('-').map(Number)
  const date = new Date(year, index - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function formatMonth(month) {
  if (month === ALL_TIME) return 'All time'
  const [year, index] = month.split('-').map(Number)
  return new Date(year, index - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function isFutureMonth(month) {
  return month > currentMonth()
}

export function inPeriod(transaction, period) {
  return period === ALL_TIME || monthOf(transaction.date) === period
}

function daysInMonth(month) {
  const [year, index] = month.split('-').map(Number)
  return new Date(year, index, 0).getDate()
}

function toISO(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function parseISO(value) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * The day a monthly rule lands on in a given month.
 *
 * Asking for the 31st in February gives the 28th (or 29th) rather than
 * silently skipping the month — so "the 31st" reads as end-of-month.
 */
export function monthlyDate(month, dayOfMonth) {
  const day = Math.min(dayOfMonth, daysInMonth(month))
  return `${month}-${String(day).padStart(2, '0')}`
}

/**
 * Every date a rule should have fired on, from the day after it last fired
 * (or its start date) through today. Returns 'YYYY-MM-DD' strings.
 */
export function dueDates(rule, today = new Date()) {
  return rule.frequency === 'weekly' ? weeklyDueDates(rule, today) : monthlyDueDates(rule, today)
}

function monthlyDueDates(rule, today) {
  const dates = []
  const startMonth = rule.last_created_on
    ? shiftMonth(monthOf(rule.last_created_on), 1)
    : monthOf(rule.start_date)

  let cursor = startMonth
  const limit = monthOf(toISO(today))

  // Bounded so a corrupt start_date cannot spin forever.
  for (let guard = 0; guard < 240 && cursor <= limit; guard += 1) {
    const candidate = monthlyDate(cursor, rule.day_of_month)
    if (candidate >= rule.start_date && parseISO(candidate) <= today) {
      dates.push(candidate)
    }
    cursor = shiftMonth(cursor, 1)
  }

  return dates
}

function weeklyDueDates(rule, today) {
  const wanted = new Set((rule.weekdays ?? []).map(Number))
  if (wanted.size === 0) return []

  const dates = []
  const begin = rule.last_created_on ? parseISO(rule.last_created_on) : parseISO(rule.start_date)
  if (rule.last_created_on) begin.setDate(begin.getDate() + 1)

  const cursor = new Date(begin)
  const startISO = rule.start_date

  // Two years of catch-up is far more than any real gap, and keeps a bad
  // start_date from looping indefinitely.
  for (let guard = 0; guard < 800 && cursor <= today; guard += 1) {
    const iso = toISO(cursor)
    if (wanted.has(cursor.getDay()) && iso >= startISO) dates.push(iso)
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

export function describeSchedule(rule) {
  if (rule.frequency === 'weekly') {
    const names = WEEKDAYS.filter(day => (rule.weekdays ?? []).includes(day.value)).map(d => d.short)
    if (names.length === 0) return 'Weekly'
    if (names.length === 7) return 'Every day'
    if (names.length === 5 && !names.includes('Sat') && !names.includes('Sun')) return 'Every weekday'
    return `Every ${names.join(', ')}`
  }

  if (rule.day_of_month >= 29) return 'End of each month'
  return `${ordinal(rule.day_of_month)} of each month`
}

export function ordinal(day) {
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th'
  return `${day}${suffix}`
}
