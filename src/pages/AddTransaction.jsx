import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTransactions } from '../hooks/useTransactions'
import { useSettings } from '../hooks/useSettings'
import { useBudgets } from '../hooks/useBudgets'
import { useToast } from '../context/ToastContext'
import { formatDate, todayISO } from '../lib/format'
import { formatMonth, monthOf } from '../lib/period'
import { netBalance, spendByCategory } from '../lib/budgets'
import { isOver, round2 } from '../lib/money'
import { validateTransaction } from '../lib/validateTransaction'
import TransactionFields from '../components/TransactionFields'

// A function, not a constant: as a module-level object the date would be
// frozen at import, so a tab left open overnight would file under yesterday.
function emptyForm() {
  return {
    description: '',
    amount: '',
    type: '',
    category: '',
    date: todayISO(),
    note: '',
  }
}

export default function AddTransaction() {
  const { transactions, addTransaction } = useTransactions()
  const { format } = useSettings()
  const { budgets } = useBudgets()
  const { notify } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  // Arriving from a Duplicate action. The date deliberately resets to today —
  // you are logging this again now, not re-dating the original.
  const prefill = location.state?.prefill
  const [form, setForm] = useState(() =>
    prefill ? { ...emptyForm(), ...prefill, date: todayISO() } : emptyForm()
  )
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState('')

  const balance = useMemo(() => netBalance(transactions), [transactions])

  // Budget position for the chosen category, in the month this transaction is
  // dated — not the month currently being viewed elsewhere in the app.
  const budgetView = useMemo(() => {
    if (!form.category || !form.type) return null

    const month = monthOf(form.date || todayISO())
    const spent =
      form.type === 'expense'
        ? spendByCategory(transactions, month)[form.category] ?? 0
        : round2(
            transactions
              .filter(
                item =>
                  item.type === 'income' &&
                  item.category === form.category &&
                  monthOf(item.date) === month
              )
              .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
          )

    const limit =
      form.type === 'expense'
        ? Number(budgets.find(item => item.category === form.category)?.monthly_limit) || 0
        : 0

    return { month, spent, limit }
  }, [transactions, budgets, form.category, form.type, form.date])

  const amountValue = Number(form.amount) || 0
  const isIncome = form.type === 'income'

  // The preview has three states, not two. Until a type is picked the row is
  // neither income nor expense, and `isIncome ? … : …` would quietly render it
  // as an expense — a red −₱0.00 asserting something the user never entered.
  const hasType = Boolean(form.type)
  const tone = !hasType ? 'is-unset' : isIncome ? 'is-income' : 'is-expense'

  // Accepts either a patch object or a function of the current form, so a
  // field can be set from the value of another (the calculator appends a note).
  function setField(patch) {
    setForm(current => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const found = validateTransaction(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    setFailure('')
    const message = await addTransaction({
      description: form.description.trim(),
      amount: Number(form.amount),
      type: form.type,
      category: form.category,
      date: form.date,
      note: form.note.trim(),
    })
    setSubmitting(false)

    if (message) {
      setFailure(message)
      notify({ message: `Could not save: ${message}`, tone: 'danger' })
      return
    }

    navigate('/')
    notify({ message: `Added "${form.description.trim()}".`, tone: 'success' })
  }

  const projected = budgetView ? budgetView.spent + amountValue : 0
  const willBeOver = budgetView?.limit > 0 && isOver(projected, budgetView.limit)

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{prefill ? 'Duplicate transaction' : 'Add transaction'}</h1>
          <p className="page-sub">
            {prefill
              ? 'Copied from an existing entry, dated today. Change anything before saving.'
              : 'Log money in or money out.'}
          </p>
        </div>
      </header>

      <div className="add-layout">
        <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
          <TransactionFields form={form} errors={errors} onField={setField} />

          {failure && <p className="error">{failure}</p>}

          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save transaction'}
            </button>
            <button type="button" className="button" onClick={() => navigate('/')}>Cancel</button>
          </div>
        </form>

        <aside className="add-aside">
          <div className="panel">
            <span className="stat-label">Preview</span>
            <div className="preview-row">
              <span className={`row-badge ${tone}`} aria-hidden="true">
                {hasType ? (isIncome ? '↑' : '↓') : '•'}
              </span>
              <span className="row-main">
                <span className={`row-title${form.description ? '' : ' is-placeholder'}`}>
                  {form.description || 'Description'}
                </span>
                <span className="row-meta">
                  {form.category || 'Category'} · {formatDate(form.date) || 'Date'}
                </span>
              </span>
              <span className={`row-amount ${tone}`}>
                {amountValue > 0
                  ? `${hasType ? (isIncome ? '+' : '−') : ''}${format(amountValue)}`
                  : '—'}
              </span>
            </div>
            <p className="hint">This is how it will appear on your dashboard.</p>
          </div>

          <div className="panel">
            <span className="stat-label">After saving</span>
            <p className="aside-figure">
              {format(isIncome ? balance + amountValue : balance - amountValue)}
            </p>
            <p className="hint">
              Balance now {format(balance)}
              {amountValue > 0 && form.type
                ? ` · ${isIncome ? 'up' : 'down'} ${format(amountValue)}`
                : ''}
            </p>
          </div>

          <div className="panel">
            {!budgetView ? (
              <>
                <span className="stat-label">Budget</span>
                <p className="hint">
                  Pick a type and category to see how much of its budget is left.
                </p>
              </>
            ) : budgetView.limit > 0 ? (
              <>
                <span className="stat-label">{form.category} budget</span>
                <p className="aside-figure">
                  {format(Math.max(0, budgetView.limit - budgetView.spent))}
                  <span className="budget-summary-of">left</span>
                </p>

                <div className="bar-track">
                  <div
                    className={`bar-fill${isOver(budgetView.spent, budgetView.limit) ? ' is-over' : ''}`}
                    style={{
                      transform: `scaleX(${Math.min(1, budgetView.spent / budgetView.limit)})`,
                    }}
                  />
                </div>

                <p className="hint">
                  {format(budgetView.spent)} of {format(budgetView.limit)} used in{' '}
                  {formatMonth(budgetView.month)}.
                  {amountValue > 0 && (
                    <>
                      {' '}This takes you to {format(projected)}
                      {willBeOver ? `, ${format(projected - budgetView.limit)} over.` : '.'}
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <span className="stat-label">{form.category} this month</span>
                <p className="aside-figure">{format(budgetView.spent)}</p>
                <p className="hint">
                  {isIncome
                    ? 'Budgets apply to expenses only.'
                    : <>No limit set. <Link to="/budgets">Set one</Link> to track it here.</>}
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
