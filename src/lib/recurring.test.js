import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { materialiseRecurring, newRule } from './recurring'

// materialiseRecurring writes to the activity log on its way through. There is
// no DOM here, so stand in a throwaway store rather than let every run warn.
beforeEach(() => {
  const store = new Map()
  globalThis.window = {
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value),
    },
  }
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 2, 15)) // 15 March 2026
})

afterEach(() => {
  vi.useRealTimers()
  delete globalThis.window
})

const rule = (overrides = {}) => ({
  id: 'rule-1',
  description: 'Rent',
  amount: 8000,
  type: 'expense',
  category: 'Rent',
  note: '',
  frequency: 'monthly',
  day_of_month: 1,
  weekdays: [],
  start_date: '2026-01-01',
  active: true,
  ...overrides,
})

describe('materialiseRecurring', () => {
  it('posts one transaction for every date an active rule has already come due', () => {
    const { rows } = materialiseRecurring([rule()], [])

    expect(rows.map(row => row.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01'])
    expect(rows.every(row => row.recurring_rule_id === 'rule-1')).toBe(true)
    expect(rows[0].amount).toBe(8000)
  })

  it('posts nothing for a rule the user has paused', () => {
    expect(materialiseRecurring([rule({ active: false })], []).rows).toEqual([])
  })

  // The regression guard for the real bug: the form never sent an `active`
  // flag, so every newly created rule was born paused and posted nothing —
  // it rendered greyed out with a "Resume" button on it. This runs a rule
  // through the actual creation path rather than a hand-built fixture, so
  // dropping the default in newRule() fails here.
  it('posts transactions for a rule that was just created through newRule', () => {
    const created = newRule({
      description: 'Rent',
      amount: 8000,
      type: 'expense',
      category: 'Rent',
      note: '',
      frequency: 'monthly',
      day_of_month: 1,
      weekdays: [],
      start_date: '2026-01-01',
    })

    expect(created.active).toBe(true)
    expect(materialiseRecurring([created], []).rows).toHaveLength(3)
  })

  it('does not post a date the ledger already has for that rule', () => {
    const existing = [{ id: 't1', recurring_rule_id: 'rule-1', date: '2026-02-01' }]
    const { rows } = materialiseRecurring([rule()], existing)

    expect(rows.map(row => row.date)).toEqual(['2026-01-01', '2026-03-01'])
  })

  it('keeps rules apart when they fall due on the same day', () => {
    // The fingerprint is rule + date, not date alone, so two rules on the 1st
    // must both post.
    const rules = [rule(), rule({ id: 'rule-2', description: 'Allowance' })]
    const { rows } = materialiseRecurring(rules, [])

    expect(rows.filter(row => row.recurring_rule_id === 'rule-1')).toHaveLength(3)
    expect(rows.filter(row => row.recurring_rule_id === 'rule-2')).toHaveLength(3)
  })

  it('reports how far each rule caught up so the caller can move its watermark', () => {
    const { touched } = materialiseRecurring([rule()], [])
    expect(touched['rule-1']).toBe('2026-03-01')
  })

  it('advances the watermark even when every due date was already posted', () => {
    // Otherwise the same skipped dates get re-derived on every single load.
    const existing = ['2026-01-01', '2026-02-01', '2026-03-01'].map((date, index) => ({
      id: `t${index}`,
      recurring_rule_id: 'rule-1',
      date,
    }))
    const { rows, touched } = materialiseRecurring([rule()], existing)

    expect(rows).toEqual([])
    expect(touched['rule-1']).toBe('2026-03-01')
  })
})
