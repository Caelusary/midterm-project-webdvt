/**
 * Browser-local persistence.
 *
 * Everything the app owns lives under one prefix in localStorage. There is no
 * server and no account, so "your data" means "this browser's data" — clearing
 * site data clears the ledger, and a different browser starts empty.
 */

const PREFIX = 'budgy:'

export const KEYS = {
  transactions: `${PREFIX}transactions`,
  settings: `${PREFIX}settings`,
  budgets: `${PREFIX}budgets`,
  rules: `${PREFIX}rules`,
  activity: `${PREFIX}activity`,
}

/**
 * Reads a key, falling back on anything that would otherwise throw.
 *
 * localStorage is not guaranteed: Safari's private mode and a browser set to
 * block site data both make it unavailable, and hand-edited or half-written
 * JSON parses to garbage. None of those should take the app down, so a bad
 * read is treated as an empty one.
 */
export function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw)
    if (parsed === null || parsed === undefined) return fallback

    // Parsing is not enough: hand-edited or half-written JSON can be valid and
    // still be the wrong shape, and spreading an object where a list is
    // expected throws inside bootstrap() — during render, where the error
    // boundary's Reload button just hits it again. The fallback describes the
    // shape the caller needs, so anything that disagrees is treated as absent.
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback
    if (typeof fallback === 'object') {
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback
    }
    return parsed
  } catch {
    return fallback
  }
}

/**
 * Writes a key, returning an error message or null rather than throwing, so
 * callers can check the result and leave state untouched when a write fails.
 */
export function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return null
  } catch (error) {
    // Quota is the one failure worth naming: it is recoverable by the user,
    // and it is what a few thousand transactions will eventually hit.
    if (error?.name === 'QuotaExceededError' || error?.code === 22) {
      return 'Browser storage is full. Export your data, then clear some of the activity log.'
    }
    return 'Could not save — this browser is blocking local storage.'
  }
}

export function newId() {
  return crypto.randomUUID()
}

export function nowISO() {
  return new Date().toISOString()
}
