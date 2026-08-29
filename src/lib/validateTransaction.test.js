import { describe, expect, it } from 'vitest'
import { validateTransaction } from './validateTransaction'
import { todayISO } from './format'

const validForm = (overrides = {}) => ({
  description: 'Weekly groceries',
  amount: '1200',
  type: 'expense',
  category: 'Groceries',
  date: todayISO(),
  note: '',
  ...overrides,
})

describe('validateTransaction', () => {
  it('accepts a fully filled transaction', () => {
    expect(validateTransaction(validForm())).toEqual({})
  })

  it('rejects a description that is only whitespace', () => {
    // Trimming matters: '   ' passes a naive truthiness check but stores blank.
    const errors = validateTransaction(validForm({ description: '   ' }))
    expect(errors.description).toBeTruthy()
  })

  it.each([
    ['zero', '0'],
    ['negative', '-50'],
    ['non-numeric', 'abc'],
  ])('rejects a %s amount', (_label, amount) => {
    expect(validateTransaction(validForm({ amount })).amount).toBeTruthy()
  })

  it('rejects a date far enough in the future to be a typo', () => {
    const errors = validateTransaction(validForm({ date: '2099-01-01' }))
    expect(errors.date).toBeTruthy()
  })

  it('skips date validation for recurring rules, which carry a schedule instead', () => {
    const errors = validateTransaction(validForm({ date: '' }), { requireDate: false })
    expect(errors.date).toBeUndefined()
  })

  it('reports every problem at once rather than one at a time', () => {
    // The form renders all errors together, so validation cannot stop early.
    const errors = validateTransaction(validForm({ description: '', amount: '', category: '' }))
    expect(Object.keys(errors).sort()).toEqual(['amount', 'category', 'description'])
  })
})
