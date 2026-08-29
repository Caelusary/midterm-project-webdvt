import { useData } from '../context/DataContext'

/** Recurring rules — rent, allowance, the daily commute. */
export function useRecurring() {
  const { rules, addRule, updateRule, toggleRule, deleteRule } = useData()
  return { rules, addRule, updateRule, toggleRule, deleteRule }
}
