import { useData } from '../context/DataContext'

/** Per-category monthly spending limits. */
export function useBudgets() {
  const { budgets, setBudget, removeBudget } = useData()
  return { budgets, setBudget, removeBudget }
}

/** The month currently being viewed, shared by the Dashboard, Insights and Budgets. */
export function usePeriod() {
  const { period, setPeriod } = useData()
  return { period, setPeriod }
}
