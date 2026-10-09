import { describe, expect, it } from 'vitest'
import { netBalance, overBudgetCategories, spendByCategory } from './budgets'
import { ALL_TIME, inPeriod, latestMonth } from './period'
import { cents, isOver, round2 } from './money'

const tx = (overrides = {}) => ({
  type: 'expense',
  category: 'Food',
  amount: 100,
  date: '2026-03-15',
  ...overrides,
})

describe('spendByCategory', () => {
  it('sums expenses per category and ignores income', () => {
    const totals = spendByCategory(
      [
        tx({ amount: 120.5 }),
        tx({ amount: 79.5 }),
        tx({ category: 'Transport', amount: 40 }),
        tx({ type: 'income', category: 'Salary', amount: 5000 }),
      ],
      ALL_TIME
    )
    expect(totals).toEqual({ Food: 200, Transport: 40 })
  })

  it('only counts the month asked for, edges included', () => {
    const rows = [
      tx({ date: '2026-02-28', amount: 1 }),
      tx({ date: '2026-03-01', amount: 10 }),
      tx({ date: '2026-03-31', amount: 20 }),
      tx({ date: '2026-04-01', amount: 100 }),
    ]
    expect(spendByCategory(rows, '2026-03')).toEqual({ Food: 30 })
  })

  it('adds cents exactly where floats would drift', () => {
    const rows = Array.from({ length: 10 }, () => tx({ amount: 0.1 }))
    expect(spendByCategory(rows, ALL_TIME).Food).toBe(1)
  })

  it('returns an empty object for an empty ledger', () => {
    expect(spendByCategory([], ALL_TIME)).toEqual({})
  })
})

describe('netBalance', () => {
  it('is income minus expenses', () => {
    expect(
      netBalance([tx({ type: 'income', amount: 1000 }), tx({ amount: 250.25 })])
    ).toBe(749.75)
  })

  it('goes negative when spending passes income', () => {
    expect(netBalance([tx({ type: 'income', amount: 10 }), tx({ amount: 30 })])).toBe(-20)
  })

  it('is zero for no transactions', () => {
    expect(netBalance([])).toBe(0)
  })

  it('stays exact at very large amounts', () => {
    const huge = 999999999999.99
    expect(netBalance([tx({ type: 'income', amount: huge }), tx({ amount: 0.99 })])).toBe(
      999999999999
    )
  })

  it('treats a non-numeric amount as zero rather than NaN', () => {
    expect(netBalance([tx({ type: 'income', amount: 'abc' }), tx({ amount: 5 })])).toBe(-5)
  })
})

describe('overBudgetCategories', () => {
  const march = [tx({ amount: 300 }), tx({ amount: 250 }), tx({ category: 'Rent', amount: 5000 })]

  it('lists categories over their limit, worst first', () => {
    const over = overBudgetCategories(
      march,
      [
        { category: 'Food', monthly_limit: 500 },
        { category: 'Rent', monthly_limit: 4000 },
      ],
      '2026-03'
    )
    expect(over.map(row => row.category)).toEqual(['Rent', 'Food'])
  })

  it('does not count spending exactly at the limit as over', () => {
    const rows = [tx({ amount: 100.1 }), tx({ amount: 199.9 }), tx({ amount: 200 })]
    expect(overBudgetCategories(rows, [{ category: 'Food', monthly_limit: 500 }], '2026-03')).toEqual([])
  })

  it('treats a zero or missing limit as unset, not as over', () => {
    expect(
      overBudgetCategories(
        march,
        [
          { category: 'Food', monthly_limit: 0 },
          { category: 'Rent', monthly_limit: 'not a number' },
        ],
        '2026-03'
      )
    ).toEqual([])
  })

  it('ignores spending from another month', () => {
    expect(overBudgetCategories(march, [{ category: 'Food', monthly_limit: 1 }], '2026-04')).toEqual([])
  })
})

describe('money helpers', () => {
  it('rounds to cents and compares in cents', () => {
    expect(cents(0.1 + 0.2)).toBe(30)
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(isOver(500.00000000000006, 500)).toBe(false)
    expect(isOver(500.01, 500)).toBe(true)
  })

  it('reads junk as zero', () => {
    expect(cents(undefined)).toBe(0)
    expect(cents('')).toBe(0)
    expect(cents(NaN)).toBe(0)
  })
})

describe('period helpers', () => {
  it('includes everything for all time', () => {
    expect(inPeriod(tx({ date: '1999-01-01' }), ALL_TIME)).toBe(true)
  })

  it('finds the furthest month even when it is in the future', () => {
    expect(latestMonth([tx({ date: '2026-01-02' }), tx({ date: '2027-05-01' })])).toBe('2027-05')
    expect(latestMonth([])).toBeNull()
  })
})
