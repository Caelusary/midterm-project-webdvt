import { describe, expect, it } from 'vitest'
import { ALL_TIME, dueDates, inMonthSuffix, latestMonth, monthOf, shiftMonth } from './period'

const monthlyRule = (overrides = {}) => ({
  frequency: 'monthly',
  day_of_month: 31,
  start_date: '2026-01-01',
  ...overrides,
})

describe('shiftMonth', () => {
  it('rolls over the year going forwards and backwards', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })
})

describe('monthOf', () => {
  it('reads the month straight off the date string rather than parsing a Date', () => {
    // Parsing '2026-03-01' as a Date and reading getMonth() gives February in
    // any timezone behind UTC. Slicing the string cannot drift.
    expect(monthOf('2026-03-01')).toBe('2026-03')
  })
})

describe('dueDates for a monthly rule', () => {
  it('lands on the last real day of a short month instead of skipping it', () => {
    const dates = dueDates(monthlyRule(), new Date(2026, 2, 15)) // 15 Mar 2026

    expect(dates).toContain('2026-02-28') // asked for the 31st
    expect(dates).toContain('2026-01-31')
  })

  it('never fires before the rule started', () => {
    const rule = monthlyRule({ day_of_month: 1, start_date: '2026-02-15' })
    const dates = dueDates(rule, new Date(2026, 2, 15))

    // 1 Feb is in range of the loop but predates the rule itself.
    expect(dates).not.toContain('2026-02-01')
    expect(dates).toEqual(['2026-03-01'])
  })

  it('never fires ahead of today', () => {
    const rule = monthlyRule({ day_of_month: 28, start_date: '2026-01-01' })
    const dates = dueDates(rule, new Date(2026, 0, 15)) // 15 Jan, before the 28th

    expect(dates).toEqual([])
  })

  it('resumes from the month after it last fired, not from its start date', () => {
    const rule = monthlyRule({ day_of_month: 1, last_created_on: '2026-02-01' })
    const dates = dueDates(rule, new Date(2026, 3, 10)) // 10 Apr 2026

    expect(dates).toEqual(['2026-03-01', '2026-04-01'])
  })
})

describe('latestMonth', () => {
  it('finds the furthest month even when the rows are not in date order', () => {
    const rows = [{ date: '2026-03-10' }, { date: '2026-09-01' }, { date: '2026-05-20' }]
    expect(latestMonth(rows)).toBe('2026-09')
  })

  it('returns null for an empty ledger so the stepper falls back to this month', () => {
    expect(latestMonth([])).toBeNull()
  })
})

describe('inMonthSuffix', () => {
  it('adds nothing for all time, so sentences do not read "recorded in All time"', () => {
    expect(inMonthSuffix(ALL_TIME)).toBe('')
  })

  it('reads as a sentence ending for a real month', () => {
    expect(inMonthSuffix('2026-08')).toMatch(/^ in \w+ 2026$/)
  })
})
