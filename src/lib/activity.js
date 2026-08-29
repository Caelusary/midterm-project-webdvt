import { KEYS, newId, nowISO, read, write } from './storage'

/**
 * Append-only record of what the user did, newest first.
 *
 * Capped rather than unbounded: the log shares a ~5MB localStorage budget with
 * the ledger itself, and a deletion snapshot is a whole transaction row. Two
 * hundred entries is far more than the page ever shows at once.
 */
const LIMIT = 200

/**
 * Writes are best-effort on purpose: failing to log something must never fail
 * the action the user actually asked for. A missing log line is a much smaller
 * problem than a transaction that would not save because logging broke.
 */
export function logActivity(entry) {
  logActivities([entry])
}

/** Same contract, for one action that produces several entries at once. */
export function logActivities(entries) {
  if (entries.length === 0) return

  const stamped = entries.map(entry => ({ id: newId(), created_at: nowISO(), ...entry }))
  const error = write(KEYS.activity, [...stamped, ...readActivity()].slice(0, LIMIT))
  if (error) console.warn('Could not write activity log:', error)
}

export function readActivity() {
  return read(KEYS.activity, [])
}

export function deleteActivityEntry(id) {
  return write(KEYS.activity, readActivity().filter(entry => entry.id !== id))
}

export function clearActivity() {
  return write(KEYS.activity, [])
}

/** Human-readable one-liner for a transaction event. */
export function describeTransaction(row) {
  const sign = row.type === 'income' ? '+' : '−'
  return `${row.description} · ${sign}${row.amount} · ${row.category}`
}
