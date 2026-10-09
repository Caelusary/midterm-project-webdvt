import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions } from '../hooks/useTransactions'
import { useSettings } from '../hooks/useSettings'
import { useBudgets, usePeriod } from '../hooks/useBudgets'
import {
  ALL_TIME, formatMonth, inMonthSuffix, inPeriod, latestMonth, monthOf, shiftMonth,
} from '../lib/period'
import { overBudgetCategories } from '../lib/budgets'
import { categoryColor } from '../lib/format'
import { cents, round2 } from '../lib/money'
import DonutChart from '../components/DonutChart'
import PeriodPicker from '../components/PeriodPicker'
import EmptyState from '../components/EmptyState'
import ThemeToggle from '../components/ThemeToggle'

const colorFor = categoryColor

/**
 * Spending more is bad, so a rise renders in the expense colour — the opposite
 * of how a change figure usually reads.
 */
function Delta({ current, previous, format, suffix }) {
  if (previous === null || previous === undefined) return null

  const change = current - previous
  if (previous === 0 && current === 0) return null

  if (previous === 0) {
    return <span className="delta is-up">new{suffix ? ` ${suffix}` : ''}</span>
  }

  const percent = Math.round((change / previous) * 100)
  if (change === 0) return <span className="delta is-flat">no change{suffix ? ` ${suffix}` : ''}</span>

  return (
    <span className={`delta ${change > 0 ? 'is-up' : 'is-down'}`}>
      {change > 0 ? '↑' : '↓'} {format(Math.abs(change))} ({Math.abs(percent)}%)
      {suffix ? ` ${suffix}` : ''}
    </span>
  )
}

export default function Summary() {
  const { transactions } = useTransactions()
  const { format } = useSettings()
  const { period, setPeriod } = usePeriod()
  const { budgets } = useBudgets()

  // Keeps a future-dated transaction reachable in the month stepper.
  const furthestMonth = useMemo(() => latestMonth(transactions), [transactions])

  const { breakdown, totalSpent, totalEarned, topCategory } = useMemo(() => {
    const totals = {}
    let spent = 0
    let earned = 0

    for (const item of transactions) {
      if (!inPeriod(item, period)) continue
      const amount = cents(item.amount)

      if (item.type === 'income') {
        earned += amount
        continue
      }
      totals[item.category] = (totals[item.category] || 0) + amount
      spent += amount
    }

    const rows = Object.entries(totals)
      .map(([category, amount]) => ({
        category,
        amount: amount / 100,
        percent: spent === 0 ? 0 : Math.round((amount / spent) * 100),
      }))
      .sort((a, b) => b.amount - a.amount)

    return {
      breakdown: rows,
      totalSpent: round2(spent / 100),
      totalEarned: round2(earned / 100),
      topCategory: rows[0] ?? null,
    }
  }, [transactions, period])

  // The same figures for the month before, so every number on this page can be
  // read as a change rather than a bare total. Skipped on "all time", which has
  // no meaningful predecessor.
  const previous = useMemo(() => {
    if (period === ALL_TIME) return null
    const previousMonth = shiftMonth(period, -1)

    const totals = {}
    let spent = 0

    for (const item of transactions) {
      if (item.type !== 'expense') continue
      if (monthOf(item.date) !== previousMonth) continue
      totals[item.category] = (totals[item.category] || 0) + cents(item.amount)
      spent += cents(item.amount)
    }

    for (const key of Object.keys(totals)) totals[key] = totals[key] / 100
    return { month: previousMonth, totals, spent: round2(spent / 100) }
  }, [transactions, period])

  const overBudget = useMemo(() => {
    if (period === ALL_TIME) return []
    return overBudgetCategories(transactions, budgets, period)
  }, [budgets, transactions, period])

  const savedRate = totalEarned > 0 ? Math.round(((totalEarned - totalSpent) / totalEarned) * 100) : null

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Summary</h1>
          <p className="page-sub">Where your money actually goes.</p>
        </div>
        <div className="page-head-actions">
          <ThemeToggle />
          <Link to="/budgets" className="button">Manage budgets</Link>
        </div>
      </header>

      <PeriodPicker period={period} onChange={setPeriod} furthestMonth={furthestMonth}>
        <span className="period-figure">
          <span className="period-figure-label">Spent</span>
          <span className="period-figure-value is-expense">{format(totalSpent)}</span>
        </span>
        {savedRate !== null && (
          <span className="period-figure">
            <span className="period-figure-label">Kept</span>
            <span className={`period-figure-value ${savedRate < 0 ? 'is-expense' : 'is-income'}`}>
              {savedRate}%
            </span>
          </span>
        )}
      </PeriodPicker>

      {breakdown.length === 0 ? (
        <EmptyState icon="chart" title={`No expenses recorded${inMonthSuffix(period)}`} />
      ) : (
        <>
          <section className="panel chart-panel">
            <DonutChart
              slices={breakdown.map(item => ({ label: item.category, value: item.amount }))}
              total={totalSpent}
              centerLabel="Total spent"
              centerValue={format(totalSpent)}
            />

            <div className="chart-side">
              <h2>Biggest drain</h2>
              <p className="chart-highlight">
                <span className="chart-swatch" style={{ background: colorFor(0) }} />
                {topCategory.category}
              </p>
              <p className="page-sub">
                {format(topCategory.amount)}, {topCategory.percent}% of everything you
                spent{inMonthSuffix(period)}, across {breakdown.length}{' '}
                {breakdown.length === 1 ? 'category' : 'categories'}.
              </p>

              {previous && (
                <p className="delta-line">
                  <Delta current={totalSpent} previous={previous.spent} format={format}
                    suffix={`vs ${formatMonth(previous.month).split(' ')[0]}`} />
                </p>
              )}

              {overBudget.length > 0 && (
                <p className="insight-warning">
                  Over budget in {overBudget.map(row => row.category).join(', ')}.{' '}
                  <Link to="/budgets">Review limits</Link>
                </p>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>By category</h2>
            <ul className="breakdown">
              {breakdown.map((item, index) => (
                <li key={item.category} className="breakdown-item">
                  <div className="breakdown-head">
                    <span className="breakdown-name">
                      <span className="chart-swatch" style={{ background: colorFor(index) }} />
                      {item.category}
                    </span>
                    <span className="breakdown-figures">
                      {format(item.amount)} <span className="breakdown-pct">{item.percent}%</span>
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill"
                      style={{
                        transform: `scaleX(${item.percent / 100})`,
                        background: colorFor(index),
                      }} />
                  </div>
                  {previous && (
                    <p className="delta-line">
                      <Delta current={item.amount} previous={previous.totals[item.category] ?? 0}
                        format={format} />
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  )
}
