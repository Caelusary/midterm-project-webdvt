import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  SCHEMA_VERSION,
  buildBackup,
  loadLedger,
  parseBackup,
  sanitiseBudget,
  sanitiseLedger,
  sanitiseRule,
  sanitiseSettings,
  sanitiseTransaction,
} from './schema'
import { KEYS } from './storage'

// A Map-backed stand-in for localStorage, so the loader runs as it would in a
// browser without needing a DOM environment.
function installStorage(initial = {}) {
  const store = new Map(Object.entries(initial))
  globalThis.window = {
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: key => store.delete(key),
    },
  }
  return store
}

const good = {
  id: 'a',
  description: 'Lunch',
  amount: 150,
  type: 'expense',
  category: 'Food',
  date: '2026-03-02',
  note: '',
  created_at: '2026-03-02T04:00:00.000Z',
}

describe('sanitiseTransaction', () => {
  it('keeps a valid row as it is', () => {
    expect(sanitiseTransaction(good)).toEqual(good)
  })

  it('rejects rows that are not objects', () => {
    for (const bad of [null, undefined, 42, 'row', [good]]) {
      expect(sanitiseTransaction(bad)).toBeNull()
    }
  })

  it('rejects zero, negative-zero, non-numeric and absurd amounts', () => {
    for (const amount of [0, -0, '', 'abc', NaN, Infinity, 1e12, null, undefined]) {
      expect(sanitiseTransaction({ ...good, amount })).toBeNull()
    }
  })

  it('reads formatted string amounts from older builds', () => {
    expect(sanitiseTransaction({ ...good, amount: '1,200.50' }).amount).toBe(1200.5)
  })

  it('reads a negative amount as its size and keeps the declared type', () => {
    const row = sanitiseTransaction({ ...good, amount: -80, type: 'expense' })
    expect(row.amount).toBe(80)
    expect(row.type).toBe('expense')
  })

  it('maps the legacy `kind` field to type, and defaults a missing type to expense', () => {
    const legacy = { ...good, type: undefined, kind: 'Income' }
    expect(sanitiseTransaction(legacy).type).toBe('income')
    expect(sanitiseTransaction({ ...good, type: 'weird' }).type).toBe('expense')
  })

  it('trims a full ISO timestamp down to the date, and rejects a missing date', () => {
    expect(sanitiseTransaction({ ...good, date: '2026-03-02T10:00:00Z' }).date).toBe('2026-03-02')
    expect(sanitiseTransaction({ ...good, date: 'yesterday' })).toBeNull()
    expect(sanitiseTransaction({ ...good, date: undefined })).toBeNull()
  })

  it('fills a missing id, description, category and note', () => {
    const row = sanitiseTransaction({ amount: 5, date: '2026-01-01', type: 'expense' })
    expect(row.id).toMatch(/[0-9a-f-]{36}/)
    expect(row.category).toBe('Other')
    expect(row.description).toBe('Other')
    expect(row.note).toBe('')
    expect(row.created_at).toBe('2026-01-01T00:00:00.000Z')
  })

  it('rounds sub-cent amounts', () => {
    expect(sanitiseTransaction({ ...good, amount: 10.006 }).amount).toBe(10.01)
  })
})

describe('sanitiseRule', () => {
  const rule = {
    id: 'r',
    description: 'Rent',
    amount: 8000,
    type: 'expense',
    category: 'Rent',
    frequency: 'monthly',
    day_of_month: 1,
    start_date: '2026-01-01',
    active: true,
  }

  it('keeps a valid monthly rule', () => {
    expect(sanitiseRule(rule)).toMatchObject(rule)
  })

  it('drops a rule with no type, amount or start date', () => {
    expect(sanitiseRule({ ...rule, type: undefined })).toBeNull()
    expect(sanitiseRule({ ...rule, amount: 0 })).toBeNull()
    expect(sanitiseRule({ ...rule, start_date: '' })).toBeNull()
  })

  it('falls back to the start day when day_of_month is out of range', () => {
    expect(sanitiseRule({ ...rule, day_of_month: 40, start_date: '2026-01-17' }).day_of_month).toBe(17)
  })

  it('keeps only real weekdays on a weekly rule, and drops one with none', () => {
    const weekly = { ...rule, frequency: 'weekly', weekdays: [1, '3', 9, 1] }
    expect(sanitiseRule(weekly).weekdays).toEqual([1, 3])
    expect(sanitiseRule({ ...weekly, weekdays: [] })).toBeNull()
  })
})

describe('sanitiseBudget and sanitiseSettings', () => {
  it('accepts a zero limit but not a negative one', () => {
    expect(sanitiseBudget({ category: 'Food', monthly_limit: 0 }).monthly_limit).toBe(0)
    expect(sanitiseBudget({ category: 'Food', monthly_limit: -5 })).toBeNull()
    expect(sanitiseBudget({ monthly_limit: 5 })).toBeNull()
  })

  it('falls back to safe settings', () => {
    expect(sanitiseSettings(undefined)).toEqual({ savings_goal: 0, currency: 'PHP' })
    expect(sanitiseSettings({ savings_goal: '5000', currency: 'USD' })).toEqual({
      savings_goal: 5000,
      currency: 'USD',
    })
    expect(sanitiseSettings({ savings_goal: -1, currency: 'XYZ' })).toEqual({
      savings_goal: 0,
      currency: 'PHP',
    })
  })
})

describe('sanitiseLedger', () => {
  it('counts dropped rows, renames duplicate ids and keeps one budget per category', () => {
    const result = sanitiseLedger({
      transactions: [good, { ...good }, { amount: 'x' }],
      rules: 'not a list',
      budgets: [
        { category: 'Food', monthly_limit: 100 },
        { category: 'Food', monthly_limit: 200 },
      ],
      settings: null,
    })
    expect(result.transactions).toHaveLength(2)
    expect(new Set(result.transactions.map(row => row.id)).size).toBe(2)
    expect(result.rules).toEqual([])
    expect(result.budgets).toEqual([expect.objectContaining({ monthly_limit: 200 })])
    expect(result.dropped).toBe(1)
  })
})

describe('loadLedger', () => {
  let store
  afterEach(() => { delete globalThis.window })

  describe('first visit', () => {
    beforeEach(() => { store = installStorage() })

    it('loads an empty ledger and writes only the version', () => {
      const ledger = loadLedger()
      expect(ledger.transactions).toEqual([])
      expect(ledger.notice).toBe('')
      expect([...store.keys()]).toEqual([KEYS.schema])
    })
  })

  it('migrates unversioned data and stamps the version', () => {
    store = installStorage({
      [KEYS.transactions]: JSON.stringify([{ ...good, amount: '150' }]),
    })
    const ledger = loadLedger()
    expect(ledger.transactions[0].amount).toBe(150)
    expect(JSON.parse(store.get(KEYS.transactions))[0].amount).toBe(150)
    expect(store.get(KEYS.schema)).toBe(String(SCHEMA_VERSION))
    expect(ledger.notice).toBe('')
  })

  it('survives unparseable JSON and sets the original aside', () => {
    store = installStorage({ [KEYS.transactions]: '{not json', [KEYS.settings]: '[]' })
    const ledger = loadLedger()
    expect(ledger.transactions).toEqual([])
    expect(ledger.settings.currency).toBe('PHP')
    expect(ledger.notice).toMatch(/set aside/)
    const recovered = JSON.parse(store.get(KEYS.recovered))
    expect(recovered.transactions).toBe('{not json')
    expect(recovered.settings).toBe('[]')
  })

  it('keeps the good rows when only some are broken', () => {
    store = installStorage({
      [KEYS.transactions]: JSON.stringify([good, null, { amount: -0 }, 'junk']),
      [KEYS.schema]: '1',
    })
    const ledger = loadLedger()
    expect(ledger.transactions).toEqual([good])
    expect(ledger.notice).not.toBe('')
    expect(JSON.parse(store.get(KEYS.recovered)).transactions).toContain('junk')
  })

  it('never writes back over data from a newer version', () => {
    const newer = JSON.stringify([good, 'future-format-row'])
    store = installStorage({ [KEYS.transactions]: newer, [KEYS.schema]: '99' })
    const ledger = loadLedger()
    expect(ledger.transactions).toEqual([good])
    expect(store.get(KEYS.transactions)).toBe(newer)
  })

  it('treats blocked storage as an empty ledger instead of throwing', () => {
    globalThis.window = {
      localStorage: {
        getItem: () => { throw new Error('SecurityError') },
        setItem: () => { throw new Error('SecurityError') },
      },
    }
    expect(loadLedger().transactions).toEqual([])
  })
})

describe('backup files', () => {
  it('round-trips through buildBackup and parseBackup', () => {
    const backup = buildBackup({
      transactions: [good],
      rules: [],
      budgets: [{ category: 'Food', monthly_limit: 500, updated_at: 'x' }],
      settings: { savings_goal: 1000, currency: 'USD' },
    })
    const { data, error } = parseBackup(JSON.stringify(backup))
    expect(error).toBeUndefined()
    expect(data.transactions).toEqual([good])
    expect(data.settings).toEqual({ savings_goal: 1000, currency: 'USD' })
  })

  it('accepts a bare list of transactions', () => {
    expect(parseBackup(JSON.stringify([good])).data.transactions).toHaveLength(1)
  })

  it('explains what is wrong with a bad file', () => {
    expect(parseBackup('nope').error).toMatch(/not valid JSON/)
    expect(parseBackup('{"app":"other"}').error).toMatch(/not a Budgy backup/)
    expect(parseBackup(JSON.stringify({ app: 'budgy', version: 99 })).error).toMatch(/newer/)
    expect(parseBackup(JSON.stringify({ app: 'budgy', transactions: [] })).error).toMatch(/nothing/)
  })
})
