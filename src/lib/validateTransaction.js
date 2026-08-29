import { todayISO } from './format'

// Mirrors the CHECK constraints on public.transactions. The database is the
// real guard; this exists to give a readable message before the round trip.
const MAX_AMOUNT = 1000000000000

function yearsFromToday(years) {
  const [year, month, day] = todayISO().split('-').map(Number)
  return `${year + years}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Shared by the Add form and the Detail page's edit form, so a transaction
 * can't be created invalid and then edited into an invalid state.
 *
 * `requireDate` is off for recurring rules, which carry a schedule instead.
 */
export function validateTransaction(form, { requireDate = true } = {}) {
  const errors = {}

  if (!form.description.trim()) errors.description = 'Description is required'
  else if (form.description.trim().length > 200) errors.description = 'Keep it under 200 characters'

  const amount = Number(form.amount)
  if (!form.amount) errors.amount = 'Amount is required'
  else if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'Amount must be greater than 0'
  else if (amount >= MAX_AMOUNT) errors.amount = 'That amount is too large'

  if (!form.type) errors.type = 'Choose income or expense'
  if (!form.category) errors.category = 'Category is required'

  if (requireDate) {
    if (!form.date) errors.date = 'Date is required'
    else if (form.date > yearsFromToday(1)) errors.date = 'That date is too far in the future'
    else if (form.date < '1970-01-01') errors.date = 'That date is too far in the past'
  }

  if (form.note && form.note.length > 500) errors.note = 'Keep the note under 500 characters'

  return errors
}
