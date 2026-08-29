import { inPeriod } from './period'
import { cents, isOver, round2 } from './money'

/**
 * Expense totals per category for a period. One implementation, used by the
 * Dashboard, Summary, Budgets and the Add form — they previously each had
 * their own, and they disagreed about whether a zero limit counted as "over".
 */
export function spendByCategory(transactions, period) {
  const totals = {}

  for (const item of transactions) {
    if (item.type !== 'expense') continue
    if (!inPeriod(item, period)) continue
    totals[item.category] = (totals[item.category] ?? 0) + cents(item.amount)
  }

  for (const key of Object.keys(totals)) totals[key] = totals[key] / 100
  return totals
}

/** Categories whose spending has passed a set limit. A limit of 0 means unset. */
export function overBudgetCategories(transactions, budgets, period) {
  const spent = spendByCategory(transactions, period)

  return budgets
    .map(budget => ({
      category: budget.category,
      limit: Number(budget.monthly_limit) || 0,
      spent: spent[budget.category] ?? 0,
    }))
    .filter(row => row.limit > 0 && isOver(row.spent, row.limit))
    .sort((a, b) => b.spent - b.limit - (a.spent - a.limit))
}

/** Net balance across every transaction given. */
export function netBalance(transactions) {
  const total = transactions.reduce((running, item) => {
    const amount = cents(item.amount)
    return item.type === 'income' ? running + amount : running - amount
  }, 0)
  return round2(total / 100)
}
