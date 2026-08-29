import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { KEYS, newId, nowISO, read, write } from '../lib/storage'
import { ALL_TIME } from '../lib/period'
import { materialiseRecurring, newRule } from '../lib/recurring'
import { describeTransaction, logActivities, logActivity } from '../lib/activity'

const DataContext = createContext(null)

const EMPTY_SETTINGS = { savings_goal: 0, currency: 'PHP' }

/**
 * The whole ledger, held in state and mirrored into localStorage.
 *
 * Every mutation writes storage first and only updates state once that
 * succeeds, so what is on screen is always what was actually saved. The write
 * is synchronous, so there is no optimistic-update-and-rollback step to get
 * wrong — but these functions stay async so pages can keep awaiting them.
 */
export function DataProvider({ children }) {
  const boot = bootstrap()
  const [transactions, setTransactions] = useState(boot.transactions)
  const [settings, setSettings] = useState(boot.settings)
  const [budgets, setBudgets] = useState(boot.budgets)
  const [rules, setRules] = useState(boot.rules)
  // Fixed for the life of the page: the only way loading the ledger can fail
  // is storage being unavailable, which will not change while the tab is open.
  const error = boot.error
  // Opens on every transaction, not the current month: the Dashboard is
  // specified as listing all transactions, and a first-time visitor whose data
  // spans months should not have to find the period control to see it. Budgets
  // moves the period to a month itself, because a monthly limit needs one.
  const [period, setPeriod] = useState(ALL_TIME)

  // Mirrors the lists so a mutation can capture the pre-change rows
  // synchronously. Reading state inside a setState updater instead would run
  // during React's render phase, which is the wrong place to be writing to
  // storage from.
  const transactionsRef = useRef(transactions)
  const budgetsRef = useRef(budgets)
  const rulesRef = useRef(rules)

  // Synced after commit rather than during render. Mutations run from event
  // handlers, which always happen after effects have flushed, so these are
  // current by the time anything reads them.
  useEffect(() => {
    transactionsRef.current = transactions
    budgetsRef.current = budgets
    rulesRef.current = rules
  })

  // ---- transactions -------------------------------------------------------

  const addTransaction = useCallback(async (input) => {
    const row = { ...input, id: newId(), created_at: nowISO() }
    const next = sortTransactions([row, ...transactionsRef.current])

    const failure = write(KEYS.transactions, next)
    if (failure) return failure

    setTransactions(next)
    logActivity({
      action: 'created',
      entity: 'transaction',
      entity_id: row.id,
      summary: 'Added a transaction',
      detail: describeTransaction(row),
    })
    return null
  }, [])

  const updateTransaction = useCallback(async (id, updates) => {
    const previous = transactionsRef.current.find(item => item.id === id) ?? null
    const next = sortTransactions(
      transactionsRef.current.map(item => (item.id === id ? { ...item, ...updates } : item))
    )

    const failure = write(KEYS.transactions, next)
    if (failure) return failure

    setTransactions(next)
    logActivity({
      action: 'updated',
      entity: 'transaction',
      entity_id: id,
      summary: 'Edited a transaction',
      detail: describeTransaction({ ...previous, ...updates }),
    })
    return null
  }, [])

  const deleteTransaction = useCallback(async (id) => {
    const removed = transactionsRef.current.find(item => item.id === id) ?? null
    const next = transactionsRef.current.filter(item => item.id !== id)

    const failure = write(KEYS.transactions, next)
    if (failure) return { message: failure, removed: null }

    setTransactions(next)
    // The snapshot is what makes this restorable from the log later, long
    // after the undo toast has gone.
    logActivity({
      action: 'deleted',
      entity: 'transaction',
      entity_id: id,
      summary: 'Deleted a transaction',
      detail: removed ? describeTransaction(removed) : '',
      snapshot: removed,
    })
    return { message: null, removed }
  }, [])

  // Undo re-inserts the exact row, id included, so links to it still resolve
  // and nothing downstream notices it ever left.
  const restoreTransaction = useCallback(async (row) => {
    if (!row) return 'Nothing to restore.'
    if (transactionsRef.current.some(item => item.id === row.id)) {
      return 'That transaction is already back.'
    }

    const next = sortTransactions([row, ...transactionsRef.current])
    const failure = write(KEYS.transactions, next)
    if (failure) return failure

    setTransactions(next)
    logActivity({
      action: 'restored',
      entity: 'transaction',
      entity_id: row.id,
      summary: 'Restored a transaction',
      detail: describeTransaction(row),
    })
    return null
  }, [])

  // ---- settings, budgets, rules -------------------------------------------

  const updateSettings = useCallback(
    async (updates) => {
      const previous = settings
      const next = normaliseSettings({ ...settings, ...updates })

      const failure = write(KEYS.settings, next)
      if (failure) return failure

      setSettings(next)

      // One entry per field that genuinely moved. The Settings page submits
      // every field, so comparing against the previous value is what keeps a
      // save with nothing changed from filling the log with noise.
      const changes = []
      if (updates.currency !== undefined && updates.currency !== previous.currency) {
        changes.push({
          summary: 'Changed the currency',
          detail: `${previous.currency} → ${updates.currency}`,
        })
      }
      if (
        updates.savings_goal !== undefined &&
        Number(updates.savings_goal) !== Number(previous.savings_goal)
      ) {
        changes.push({
          summary: 'Changed the savings goal',
          detail: `${previous.savings_goal} → ${updates.savings_goal}`,
        })
      }

      logActivities(changes.map(change => ({ action: 'updated', entity: 'settings', ...change })))
      return null
    },
    [settings]
  )

  const setBudget = useCallback(async (category, monthlyLimit) => {
    const next = [
      ...budgetsRef.current.filter(item => item.category !== category),
      { category, monthly_limit: monthlyLimit, updated_at: nowISO() },
    ]

    const failure = write(KEYS.budgets, next)
    if (failure) return failure

    setBudgets(next)
    logActivity({
      action: 'updated',
      entity: 'budget',
      summary: `Set the ${category} budget`,
      detail: `Monthly limit ${monthlyLimit}`,
    })
    return null
  }, [])

  const removeBudget = useCallback(async (category) => {
    const next = budgetsRef.current.filter(item => item.category !== category)

    const failure = write(KEYS.budgets, next)
    if (failure) return failure

    setBudgets(next)
    logActivity({
      action: 'deleted',
      entity: 'budget',
      summary: `Removed the ${category} budget`,
    })
    return null
  }, [])

  const addRule = useCallback(async (input) => {
    const rule = newRule(input)
    const nextRules = sortRules([...rulesRef.current, rule])

    const failure = write(KEYS.rules, nextRules)
    if (failure) return failure

    setRules(nextRules)
    logActivity({
      action: 'created',
      entity: 'rule',
      entity_id: rule.id,
      summary: 'Added a recurring rule',
      detail: rule.description,
    })

    // A new rule can already owe months of transactions if its start date is
    // in the past, so it catches up now rather than on the next load.
    const generated = materialiseRecurring([rule], transactionsRef.current)
    if (generated.rows.length === 0) return null

    const nextTransactions = sortTransactions([...generated.rows, ...transactionsRef.current])
    const transactionFailure = write(KEYS.transactions, nextTransactions)
    if (transactionFailure) return transactionFailure

    setTransactions(nextTransactions)

    const stamped = nextRules.map(item =>
      generated.touched[item.id] ? { ...item, last_created_on: generated.touched[item.id] } : item
    )
    const watermarkFailure = write(KEYS.rules, stamped)
    if (watermarkFailure) return watermarkFailure

    setRules(sortRules(stamped))
    return null
  }, [])

  // Editing a rule changes what it posts from now on. It deliberately leaves
  // last_created_on alone, so already-posted transactions stay as they were
  // and the new schedule simply takes over from the next due date.
  const updateRule = useCallback(async (id, updates) => {
    const previous = rulesRef.current.find(rule => rule.id === id) ?? null
    const next = sortRules(rulesRef.current.map(r => (r.id === id ? { ...r, ...updates } : r)))

    const failure = write(KEYS.rules, next)
    if (failure) return failure

    setRules(next)
    logActivity({
      action: 'updated',
      entity: 'rule',
      entity_id: id,
      summary: 'Edited a recurring rule',
      detail: updates.description ?? previous?.description ?? '',
    })
    return null
  }, [])

  /**
   * Resuming advances the watermark to today, so a rule paused in January and
   * resumed in August posts from August rather than silently back-filling
   * seven months of rent on the next page load.
   */
  const toggleRule = useCallback(async (id, active) => {
    const previous = rulesRef.current.find(rule => rule.id === id) ?? null
    const updates = active
      ? { active: true, last_created_on: new Date().toISOString().slice(0, 10) }
      : { active: false }

    const next = sortRules(rulesRef.current.map(r => (r.id === id ? { ...r, ...updates } : r)))

    const failure = write(KEYS.rules, next)
    if (failure) return failure

    setRules(next)
    logActivity({
      action: 'updated',
      entity: 'rule',
      entity_id: id,
      summary: active ? 'Resumed a recurring rule' : 'Paused a recurring rule',
      detail: previous?.description ?? '',
    })
    return null
  }, [])

  const deleteRule = useCallback(async (id) => {
    const removed = rulesRef.current.find(rule => rule.id === id) ?? null
    const next = rulesRef.current.filter(rule => rule.id !== id)

    const failure = write(KEYS.rules, next)
    if (failure) return failure

    setRules(next)
    logActivity({
      action: 'deleted',
      entity: 'rule',
      entity_id: id,
      summary: 'Deleted a recurring rule',
      detail: removed ? removed.description : '',
      snapshot: removed,
    })
    return null
  }, [])

  /** Puts a deleted recurring rule back from its logged snapshot. */
  const restoreRule = useCallback(async (row) => {
    if (!row) return 'Nothing to restore.'
    if (rulesRef.current.some(rule => rule.id === row.id)) {
      return 'That rule is already back.'
    }

    const next = sortRules([...rulesRef.current, row])
    const failure = write(KEYS.rules, next)
    if (failure) return failure

    setRules(next)
    logActivity({
      action: 'restored',
      entity: 'rule',
      entity_id: row.id,
      summary: 'Restored a recurring rule',
      detail: row.description,
    })
    return null
  }, [])

  const value = useMemo(
    () => ({
      transactions,
      error,
      period,
      setPeriod,
      restoreRule,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      restoreTransaction,
      savingsGoal: settings.savings_goal,
      currency: settings.currency,
      updateSettings,
      budgets,
      setBudget,
      removeBudget,
      rules,
      addRule,
      updateRule,
      toggleRule,
      deleteRule,
    }),
    [
      transactions,
      error,
      period,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      restoreTransaction,
      settings,
      updateSettings,
      budgets,
      setBudget,
      removeBudget,
      rules,
      addRule,
      updateRule,
      toggleRule,
      deleteRule,
      restoreRule,
    ]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

/**
 * Loads the ledger and lets any active recurring rules catch up, exactly once
 * per page load.
 *
 * This is deliberately not an effect. Storage is synchronous, so there is
 * nothing to wait for — an effect would only buy a second render pass and a
 * spinner nobody sees, and it would run twice under React's development
 * double-invoke. Memoising at module scope makes the repeat call free and the
 * catch-up unrepeatable, whatever React does with the render.
 */
let booted = null

function bootstrap() {
  if (booted) return booted

  const rules = sortRules(read(KEYS.rules, []))
  const transactions = sortTransactions(read(KEYS.transactions, []))
  const generated = materialiseRecurring(rules, transactions)

  let error = ''
  let nextTransactions = transactions
  let nextRules = rules

  if (generated.rows.length > 0) {
    const caughtUp = sortTransactions([...generated.rows, ...transactions])

    // Transactions first, watermarks second. Failing between the two means the
    // next load retries, which the fingerprint check makes harmless — the
    // reverse order would skip a month forever.
    const failure = write(KEYS.transactions, caughtUp)

    if (failure) {
      error = failure
    } else {
      nextTransactions = caughtUp
      nextRules = sortRules(
        rules.map(rule =>
          generated.touched[rule.id]
            ? { ...rule, last_created_on: generated.touched[rule.id] }
            : rule
        )
      )

      const watermarkFailure = write(KEYS.rules, nextRules)
      if (watermarkFailure) {
        error = watermarkFailure
        nextRules = rules
      }
    }
  }

  booted = {
    transactions: nextTransactions,
    rules: nextRules,
    budgets: read(KEYS.budgets, []),
    settings: normaliseSettings(read(KEYS.settings, {})),
    error,
  }
  return booted
}

// Stored JSON is only as trustworthy as whatever wrote it last, and a
// savings_goal that came back as a string would break every comparison
// downstream.
function normaliseSettings(stored) {
  return {
    savings_goal: Number(stored?.savings_goal) || EMPTY_SETTINGS.savings_goal,
    currency: stored?.currency || EMPTY_SETTINGS.currency,
  }
}

function sortTransactions(list) {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    // Same day: newest entry first.
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  })
}

// Weekly rules carry no day_of_month; park them after the monthly ones rather
// than letting null coerce to 0 and jump to the top.
function sortRules(list) {
  return [...list].sort((a, b) => (a.day_of_month ?? 99) - (b.day_of_month ?? 99))
}

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used inside a DataProvider')
  }
  return context
}
