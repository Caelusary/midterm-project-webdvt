import { CURRENCIES } from '../constants'
import { KEYS, newId, nowISO, readRaw, write } from './storage'

/**
 * The stored shape of the ledger, its version, and the one place that turns
 * whatever is in localStorage into rows the app can trust.
 *
 * Storage is only as trustworthy as whatever wrote it last: an older build of
 * Budgy, a hand edit in devtools, a write cut short by a closing tab. Every
 * page assumes a transaction has a string description, a positive amount and a
 * YYYY-MM-DD date, and one row that breaks that would take the whole Dashboard
 * down. So rows are repaired where the intent is clear and set aside where it
 * is not, and nothing that cannot be read is ever silently thrown away.
 */
export const SCHEMA_VERSION = 1

// Same ceiling the forms enforce, so a row cannot exist in storage that the
// UI would refuse to create.
const MAX_AMOUNT = 1000000000000

const DATE = /^\d{4}-\d{2}-\d{2}/
const TYPES = new Set(['income', 'expense'])

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Amounts have been seen as numbers, numeric strings and formatted strings
 * like "1,200.50". Negative values are how some ledgers mark an expense, so
 * the sign is returned separately rather than thrown away.
 */
function parseAmount(value) {
  const raw = typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value
  const number = Number(raw)
  if (raw === '' || raw === null || raw === undefined || !Number.isFinite(number)) return null
  return { value: Math.round(Math.abs(number) * 100) / 100, negative: number < 0 }
}

function parseDate(value) {
  const match = typeof value === 'string' ? value.match(DATE) : null
  return match ? match[0] : null
}

/** A transaction the app can render, or null when there is nothing to save. */
export function sanitiseTransaction(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null

  const amount = parseAmount(row.amount)
  const date = parseDate(row.date)
  if (!amount || amount.value <= 0 || amount.value >= MAX_AMOUNT || !date) return null

  // Older rows used `kind`. A row with neither is read as an expense: it is
  // a guess either way, and guessing income would inflate the balance.
  const declared = text(row.type || row.kind).toLowerCase()
  const type = TYPES.has(declared) ? declared : 'expense'
  // Categories from an older build stay as they are: renaming someone's data
  // to "Other" would lose the one thing they typed.
  const category = text(row.category) || 'Other'
  const description = text(row.description) || category

  return {
    ...row,
    id: text(row.id) || newId(),
    description: description.slice(0, 200),
    amount: amount.value,
    type,
    category,
    date,
    note: typeof row.note === 'string' ? row.note.slice(0, 500) : '',
    created_at: text(row.created_at) || `${date}T00:00:00.000Z`,
  }
}

/** A recurring rule, or null when it is missing what it needs to post. */
export function sanitiseRule(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null

  const amount = parseAmount(row.amount)
  const start = parseDate(row.start_date)
  const type = text(row.type).toLowerCase()
  if (!amount || amount.value <= 0 || amount.value >= MAX_AMOUNT || !start || !TYPES.has(type)) {
    return null
  }

  const frequency = row.frequency === 'weekly' ? 'weekly' : 'monthly'
  const rule = {
    ...row,
    id: text(row.id) || newId(),
    description: (text(row.description) || text(row.category) || 'Recurring').slice(0, 200),
    amount: amount.value,
    type,
    category: text(row.category) || 'Other',
    frequency,
    start_date: start,
    active: row.active !== false,
    created_at: text(row.created_at) || nowISO(),
  }

  if (frequency === 'monthly') {
    const day = Math.trunc(Number(row.day_of_month))
    rule.day_of_month = day >= 1 && day <= 31 ? day : Number(start.slice(8, 10)) || 1
  } else {
    const days = Array.isArray(row.weekdays) ? row.weekdays.map(Number) : []
    const valid = [...new Set(days.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))]
    if (valid.length === 0) return null
    rule.weekdays = valid
  }

  const last = parseDate(row.last_created_on)
  if (last) rule.last_created_on = last
  else delete rule.last_created_on

  return rule
}

/** A category budget, or null. A limit of 0 is valid and means "unset". */
export function sanitiseBudget(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const category = text(row.category)
  const limit = parseAmount(row.monthly_limit)
  if (!category || !limit || limit.negative || limit.value >= MAX_AMOUNT) return null
  return { ...row, category, monthly_limit: limit.value, updated_at: text(row.updated_at) || nowISO() }
}

export function sanitiseSettings(stored) {
  const goal = parseAmount(stored?.savings_goal)
  const currency = CURRENCIES.some(item => item.code === stored?.currency) ? stored.currency : 'PHP'
  return {
    savings_goal: goal && !goal.negative && goal.value < MAX_AMOUNT ? goal.value : 0,
    currency,
  }
}

/** Keeps the good rows of a list, counts the rest, and drops duplicate ids. */
function sanitiseList(list, sanitise) {
  const seen = new Set()
  const rows = []
  let dropped = 0

  for (const item of list) {
    const clean = sanitise(item)
    if (!clean) { dropped += 1; continue }
    if (seen.has(clean.id)) clean.id = newId()
    seen.add(clean.id)
    rows.push(clean)
  }
  return { rows, dropped }
}

/**
 * Cleans a whole ledger: the shape shared by what is in storage and what a
 * backup file contains. `dropped` counts rows that could not be repaired.
 */
export function sanitiseLedger({ transactions, rules, budgets, settings }) {
  const t = sanitiseList(Array.isArray(transactions) ? transactions : [], sanitiseTransaction)
  const r = sanitiseList(Array.isArray(rules) ? rules : [], sanitiseRule)
  const b = sanitiseList(Array.isArray(budgets) ? budgets : [], sanitiseBudget)

  // One budget per category; the later entry wins, matching setBudget().
  const byCategory = new Map(b.rows.map(row => [row.category, row]))

  return {
    transactions: t.rows,
    rules: r.rows,
    budgets: [...byCategory.values()],
    settings: sanitiseSettings(settings),
    dropped: t.dropped + r.dropped + b.dropped,
  }
}

const LEDGER_KEYS = ['transactions', 'rules', 'budgets', 'settings']

/**
 * Reads, repairs and migrates the stored ledger.
 *
 * Anything that could not be read whole (unparseable JSON, the wrong shape,
 * rows past repair) is copied verbatim to a recovery key before the cleaned
 * version is written back, so a bug in this function can never cost someone
 * their data: the original is still there to recover by hand.
 *
 * Data written by a newer build (a higher version) is read but never written
 * back, so opening an old tab cannot downgrade it.
 */
export function loadLedger() {
  const raw = {}
  const expected = { transactions: 'array', rules: 'array', budgets: 'array', settings: 'object' }
  const unreadable = {}

  for (const name of LEDGER_KEYS) {
    const result = readRaw(KEYS[name])
    raw[name] = result.value
    const shapeOk =
      result.status !== 'ok' ||
      (expected[name] === 'array'
        ? Array.isArray(result.value)
        : result.value !== null && typeof result.value === 'object' && !Array.isArray(result.value))
    if (result.status === 'corrupt' || !shapeOk) {
      unreadable[name] = result.raw
      raw[name] = undefined
    }
  }

  const version = Number(readRaw(KEYS.schema).value) || 0
  const clean = sanitiseLedger(raw)
  const corruptKeys = Object.keys(unreadable)
  const repaired = clean.dropped > 0 || corruptKeys.length > 0

  let notice = ''
  if (repaired) {
    const recovered = { saved_at: nowISO(), from_version: version, ...unreadable }
    // Rows that were dropped are kept with their whole original list.
    if (clean.dropped > 0) {
      for (const name of ['transactions', 'rules', 'budgets']) {
        if (Array.isArray(raw[name])) recovered[name] = JSON.stringify(raw[name])
      }
    }
    write(KEYS.recovered, recovered)
    notice =
      'Some saved data could not be read and was set aside. Everything else loaded normally.'
  }

  const shouldWrite = version <= SCHEMA_VERSION && (repaired || version < SCHEMA_VERSION)
  if (shouldWrite) {
    let failure = null
    for (const name of LEDGER_KEYS) {
      // A key that was never there stays absent rather than being written as
      // an empty default: a first visit should leave storage untouched.
      if (raw[name] === undefined && !unreadable[name]) continue
      failure = failure || write(KEYS[name], clean[name])
    }
    if (!failure) write(KEYS.schema, SCHEMA_VERSION)
  }

  return { ...clean, notice }
}

// ---- backup files ---------------------------------------------------------

export const BACKUP_APP = 'budgy'

export function buildBackup({ transactions, rules, budgets, settings }) {
  return {
    app: BACKUP_APP,
    version: SCHEMA_VERSION,
    exported_at: nowISO(),
    transactions,
    rules,
    budgets,
    settings,
  }
}

/**
 * Parses the text of a backup file. Returns `{ data }` with a cleaned ledger,
 * or `{ error }` with a sentence the user can act on.
 */
export function parseBackup(textContent) {
  let parsed
  try {
    parsed = JSON.parse(textContent)
  } catch {
    return { error: 'That file is not a Budgy backup (it is not valid JSON).' }
  }

  // A bare list of transactions is accepted too, for anyone who saved one by hand.
  if (Array.isArray(parsed)) parsed = { app: BACKUP_APP, transactions: parsed }

  if (!parsed || typeof parsed !== 'object' || parsed.app !== BACKUP_APP) {
    return { error: 'That file is not a Budgy backup.' }
  }
  if (Number(parsed.version) > SCHEMA_VERSION) {
    return { error: 'That backup is from a newer version of Budgy. Reload the page and try again.' }
  }

  const data = sanitiseLedger(parsed)
  if (data.transactions.length === 0 && data.rules.length === 0 && data.budgets.length === 0) {
    return { error: 'That backup has nothing in it to restore.' }
  }
  return { data }
}

export function backupFilename(date) {
  return `budgy-backup-${date}.json`
}
