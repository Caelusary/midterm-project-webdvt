import { describe, expect, it } from 'vitest'
import { cents, isOver, round2 } from './money'

describe('money', () => {
  // The reason this module exists. Summing these four in floating point gives
  // 500.00000000000006, which compared naively reads as over a ₱500 limit and
  // renders the nonsense "Over by ₱0.00".
  it('does not report a budget as exceeded when spending lands exactly on it', () => {
    const spent = [64.4, 217.8, 217.8] // ₱500.00 to the centavo
    const total = spent.reduce((running, value) => running + value, 0)

    expect(total).toBe(500.00000000000006) // what floating point actually gives
    expect(total > 500).toBe(true) // so a naive comparison calls this over budget
    expect(isOver(round2(total), 500)).toBe(false) // comparing in cents does not
  })

  it('reports a budget as exceeded when spending is genuinely over, even by a centavo', () => {
    expect(isOver(500.01, 500)).toBe(true)
  })

  it('rounds half-centavo amounts rather than truncating them', () => {
    expect(cents(0.005)).toBe(1)
    expect(cents(10.994)).toBe(1099)
  })

  it('treats a missing or unparseable amount as zero instead of NaN', () => {
    expect(cents(undefined)).toBe(0)
    expect(cents('not a number')).toBe(0)
  })
})
