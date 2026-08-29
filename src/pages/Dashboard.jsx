import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions } from '../hooks/useTransactions'
import { useSettings } from '../hooks/useSettings'
import { useBudgets, usePeriod } from '../hooks/useBudgets'
import { useToast } from '../context/ToastContext'
import { ALL_CATEGORIES, TYPES } from '../constants'
import { currencySymbol } from '../lib/format'
import { ALL_TIME, formatMonth, inPeriod } from '../lib/period'
import { netBalance, overBudgetCategories } from '../lib/budgets'
import { cents, round2 } from '../lib/money'
import TransactionRow from '../components/TransactionRow'
import PeriodPicker from '../components/PeriodPicker'
import Bamboo from '../components/Bamboo'
import EmptyState from '../components/EmptyState'
import Select from '../components/Select'

const PAGE_SIZE = 25

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  ...ALL_CATEGORIES.map(name => ({ value: name, label: name })),
]

const TYPE_OPTIONS = [{ value: 'all', label: 'All types' }, ...TYPES]

const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Largest amount' },
  { value: 'amount-asc', label: 'Smallest amount' },
]

export default function Dashboard() {
  const { transactions, error } = useTransactions()
  const { savingsGoal, currency, updateSettings, format } = useSettings()
  const { period, setPeriod } = usePeriod()
  const { budgets } = useBudgets()
  const { notify } = useToast()

  const [category, setCategory] = useState('all')
  const [type, setType] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('date-desc')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState('')

  const periodTransactions = useMemo(
    () => transactions.filter(item => inPeriod(item, period)),
    [transactions, period]
  )

  // Accumulated in integer cents; summing floats here produced totals like
  // 500.00000000000006, which then read as over budget.
  const totals = useMemo(() => {
    let income = 0
    let expenses = 0
    for (const item of periodTransactions) {
      if (item.type === 'income') income += cents(item.amount)
      else expenses += cents(item.amount)
    }
    return {
      income: round2(income / 100),
      expenses: round2(expenses / 100),
      net: round2((income - expenses) / 100),
    }
  }, [periodTransactions])

  // The goal is cumulative, so it is measured against everything ever — not
  // whichever month happens to be on screen.
  const lifetimeBalance = useMemo(() => netBalance(transactions), [transactions])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    // "1,200" and "₱1200" should both find a 1200 amount.
    const numeric = needle.replace(/[^0-9.]/g, '')

    const matched = periodTransactions.filter(item => {
      if (category !== 'all' && item.category !== category) return false
      if (type !== 'all' && item.type !== type) return false
      if (!needle) return true

      if (
        item.description.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle) ||
        (item.note || '').toLowerCase().includes(needle)
      ) {
        return true
      }

      return numeric.length > 0 && String(Number(item.amount)).includes(numeric)
    })

    const sorted = [...matched]
    sorted.sort((a, b) => {
      if (sort === 'amount-desc') return Number(b.amount) - Number(a.amount)
      if (sort === 'amount-asc') return Number(a.amount) - Number(b.amount)
      if (sort === 'date-asc') return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
      return a.date > b.date ? -1 : a.date < b.date ? 1 : 0
    })
    return sorted
  }, [periodTransactions, category, type, query, sort])

  // Categories whose limit is already blown this month, surfaced here rather
  // than only on the two pages you have to go looking for. Shared helper, so
  // this page can't disagree with Insights and Budgets about what "over" means.
  const overBudget = useMemo(() => {
    if (period === ALL_TIME || budgets.length === 0) return []
    return overBudgetCategories(transactions, budgets, period).map(row => row.category)
  }, [budgets, transactions, period])

  const progress = savingsGoal > 0 ? lifetimeBalance / savingsGoal : 0
  const percent = Math.max(0, Math.min(100, Math.round(progress * 100)))
  const page = visible.slice(0, shown)

  function changePeriod(next) {
    setPeriod(next)
    setShown(PAGE_SIZE)
  }

  function startEditingGoal() {
    setGoalDraft(savingsGoal ? String(savingsGoal) : '')
    setEditingGoal(true)
  }

  async function saveGoal(event) {
    event.preventDefault()
    const next = Number(goalDraft)
    if (!Number.isFinite(next) || next < 0) return
    setEditingGoal(false)
    const message = await updateSettings({ savings_goal: next })
    notify(
      message
        ? { message: `Could not save the goal: ${message}`, tone: 'danger' }
        : { message: 'Savings goal updated.', tone: 'success' }
    )
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">Your money at a glance.</p>
        </div>
      </header>

      <PeriodPicker period={period} onChange={changePeriod}>
        <span className="period-figure">
          <span className="period-figure-label">Entries</span>
          <span className="period-figure-value">{periodTransactions.length}</span>
        </span>
        <span className="period-figure">
          <span className="period-figure-label">Net</span>
          <span className={`period-figure-value ${totals.net < 0 ? 'is-expense' : 'is-income'}`}>
            {format(totals.net)}
          </span>
        </span>
      </PeriodPicker>

      <section className="stat-grid">
        {/* Deliberately not period-scoped. The period's own net is already in
            the picker strip above; this is the running balance, which should
            not change when someone flicks between months. */}
        <article className="stat-card is-feature">
          <span className="stat-label">Balance</span>
          <span className={`stat-value ${lifetimeBalance < 0 ? 'is-expense' : ''}`}>
            {format(lifetimeBalance)}
          </span>
          <span className="stat-note">All time — total income minus total expenses</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Income</span>
          <span className="stat-value is-income">{format(totals.income)}</span>
        </article>
        <article className="stat-card">
          <span className="stat-label">Expenses</span>
          <span className="stat-value is-expense">{format(totals.expenses)}</span>
        </article>
      </section>

      {error && (
        <p className="insight-warning dashboard-warning">
          Couldn&apos;t load your transactions: {error}
        </p>
      )}

      {overBudget.length > 0 && (
        <p className="insight-warning dashboard-warning">
          Over budget in {overBudget.join(', ')} this month.{' '}
          <Link to="/budgets">Review limits</Link>
        </p>
      )}

      <section className="goal-card">
        <Bamboo progress={progress} />

        <div className="goal-body">
          <span className="stat-label">Savings goal</span>

          {editingGoal ? (
            <form className="goal-form" onSubmit={saveGoal}>
              <div className="input-prefix">
                <span>{currencySymbol(currency)}</span>
                <input type="number" min="0" step="1" value={goalDraft} autoFocus
                  onWheel={event => event.currentTarget.blur()}
                  onChange={event => setGoalDraft(event.target.value)}
                  aria-label="Savings goal amount" />
              </div>
              <button type="submit" className="button button-primary">Save</button>
              <button type="button" className="button" onClick={() => setEditingGoal(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <>
              <span className="goal-value">
                {savingsGoal > 0 ? format(savingsGoal) : 'Not set yet'}
              </span>
              {savingsGoal > 0 && (
                <p className="goal-progress">
                  <strong>{percent}%</strong> there — {format(lifetimeBalance)} saved of all time,
                  {' '}{format(Math.max(0, savingsGoal - lifetimeBalance))} to go
                </p>
              )}
              <button type="button" className="button" onClick={startEditingGoal}>
                {savingsGoal > 0 ? 'Change goal' : 'Set a goal'}
              </button>
            </>
          )}
        </div>

      </section>

      <section className="ledger">
        <div className="ledger-head">
          <h2>Transactions</h2>
          <span className="ledger-count">
            {visible.length} {visible.length === 1 ? 'match' : 'matches'}
          </span>
        </div>

        <div className="ledger-controls">
          <div className="search-field">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input type="search" value={query} placeholder="Search description, category, note or amount"
              aria-label="Search transactions"
              onChange={event => { setQuery(event.target.value); setShown(PAGE_SIZE) }} />
          </div>

          <div className="filters">
            <Select value={category} onChange={next => { setCategory(next); setShown(PAGE_SIZE) }}
              options={CATEGORY_OPTIONS} ariaLabel="Filter by category" />
            <Select value={type} onChange={next => { setType(next); setShown(PAGE_SIZE) }}
              options={TYPE_OPTIONS} ariaLabel="Filter by type" />
            <Select value={sort} onChange={next => { setSort(next); setShown(PAGE_SIZE) }}
              options={SORT_OPTIONS} ariaLabel="Sort transactions" />
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={transactions.length === 0 ? 'ledger' : 'search'}
            title={
              transactions.length === 0
                ? 'No transactions yet'
                : periodTransactions.length === 0
                  ? `Nothing recorded in ${formatMonth(period)}`
                  : 'Nothing matches those filters'
            }
          >
            {transactions.length === 0 && (
              <Link to="/add" className="button button-primary">Add your first one</Link>
            )}
          </EmptyState>
        ) : (
          <>
            <div className="ledger-list">
              {page.map(item => (
                <TransactionRow key={item.id} transaction={item} format={format} />
              ))}
            </div>

            {visible.length > page.length && (
              <div className="load-more">
                <button type="button" className="button" onClick={() => setShown(current => current + PAGE_SIZE)}>
                  Load {Math.min(PAGE_SIZE, visible.length - page.length)} more
                </button>
                <span className="hint">
                  Showing {page.length} of {visible.length}
                </span>
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}
