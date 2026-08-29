import { useCallback } from 'react'
import { useData } from '../context/DataContext'
import { formatMoney } from '../lib/format'

/**
 * Preferences: the savings goal the bamboo grows toward and the display
 * currency. Exposes a bound formatter so components never have to pass the
 * currency code around.
 */
export function useSettings() {
  const { savingsGoal, currency, updateSettings } = useData()

  const format = useCallback((amount) => formatMoney(amount, currency), [currency])

  return { savingsGoal, currency, updateSettings, format }
}
