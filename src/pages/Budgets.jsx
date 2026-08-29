import { useEffect, useMemo } from 'react'
import { useTransactions } from '../hooks/useTransactions'
import { useSettings } from '../hooks/useSettings'
import { useBudgets, usePeriod } from '../hooks/useBudgets'
import { useToast } from '../context/ToastContext'
import { CATEGORIES_BY_TYPE } from '../constants'
import { ALL_TIME, currentMonth, inMonthSuffix, latestMonth } from '../lib/period'
import { spendByCategory } from '../lib/budgets'
import { categoryColor } from '../lib/format'
import { cents, isOver, round2 } from '../lib/money'
import PeriodPicker from '../components/PeriodPicker'
import BudgetRow from '../components/BudgetRow'

export default function Budgets() {
  const { transactions, error } = useTransactions()
  const { format } = useSettings()
  const { period, setPeriod } = usePeriod()
  const { budgets, setBudget, removeBudget } = useBudgets()
  const { notify } = useToast()

  // A limit is a monthly figure, so "all time" is not a scope it can be
  // compared against — lifetime spending against a monthly cap reads as wildly
  // over budget once the ledger spans more than one month. Landing here from
  // another page moves the shared period to this month rather than showing a
  // comparison that is arithmetically meaningless.
  useEffect(() => {
    if (period === ALL_TIME) setPeriod(currentMonth())
    // Mount only: re-running this would fight the user picking "All time".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keeps a future-dated transaction reachable in the month stepper.
  const furthestMonth = useMemo(() => latestMonth(transactions), [transactions])

  const spentByCat = useMemo(
    () => spendByCategory(transactions, period),
    [transactions, period]
  )

  const limitByCategory = useMemo(
    () => Object.fromEntries(budgets.map(item => [item.category, Number(item.monthly_limit) || 0])),
    [budgets]
  )

  // Every expense category always gets a row, whether or not it has a limit or
  // any spending — so there is nothing to "add", only limits to fill in.
  const rows = useMemo(() => {
    return CATEGORIES_BY_TYPE.expense.map(category => ({
      category,
      spent: spentByCat[category] ?? 0,
      limit: limitByCategory[category] ?? 0,
    }))
  }, [spentByCat, limitByCategory])

  const totals = useMemo(() => {
    let budgeted = 0
    let spentUnderBudget = 0
    let over = 0

    for (const row of rows) {
      if (row.limit <= 0) continue
      budgeted += cents(row.limit)
      spentUnderBudget += cents(row.spent)
      if (isOver(row.spent, row.limit)) over += 1
    }

    return {
      budgeted: round2(budgeted / 100),
      spentUnderBudget: round2(spentUnderBudget / 100),
      over,
      withLimits: rows.filter(row => row.limit > 0).length,
    }
  }, [rows])

  async function handleSave(category, limit) {
    const message = await setBudget(category, limit)
    notify(
      message
        ? { message: `Could not save the limit: ${message}`, tone: 'danger' }
        : { message: `${category} limit set to ${format(limit)}.`, tone: 'success' }
    )
  }

  async function handleRemove(category) {
    const message = await removeBudget(category)
    notify(
      message
        ? { message: `Could not remove: ${message}`, tone: 'danger' }
        : { message: `${category} limit removed.`, tone: 'success' }
    )
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Budgets</h1>
          <p className="page-sub">A monthly limit for every spending category.</p>
        </div>
      </header>

      <PeriodPicker period={period} onChange={setPeriod} furthestMonth={furthestMonth}>
        <span className="period-figure">
          <span className="period-figure-label">Budgeted</span>
          <span className="period-figure-value">{format(totals.budgeted)}</span>
        </span>
        <span className="period-figure">
          <span className="period-figure-label">Over</span>
          <span className={`period-figure-value ${totals.over > 0 ? 'is-expense' : ''}`}>
            {totals.over}
          </span>
        </span>
      </PeriodPicker>

      {error && (
        <p className="insight-warning dashboard-warning">
          Couldn&apos;t load your transactions: {error}
        </p>
      )}

      {period === ALL_TIME && (
        <p className="hint hint-standalone">
          Limits are monthly. Pick a single month to compare spending against them.
        </p>
      )}

      <section className="panel">
        <div className="budget-summary">
          <span className="stat-label">Spent against limits</span>
          <p className="aside-figure">
            {format(totals.spentUnderBudget)}
            <span className="budget-summary-of">of {format(totals.budgeted)}</span>
          </p>
          <p className="hint">
            {totals.withLimits === 0
              ? 'No limits set yet — pick a category below to start.'
              : `${totals.withLimits} of ${rows.length} categories have a limit${inMonthSuffix(period)}.${totals.over > 0 ? ` ${totals.over} over.` : ''}`}
          </p>
        </div>

        <ul className="breakdown budget-list">
          {rows.map((row, index) => (
            <BudgetRow
              key={row.category}
              category={row.category}
              spent={row.spent}
              limit={row.limit}
              color={categoryColor(index)}
              onSave={handleSave}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      </section>
    </>
  )
}
