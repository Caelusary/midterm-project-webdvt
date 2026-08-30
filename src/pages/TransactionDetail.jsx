import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTransactions } from '../hooks/useTransactions'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../context/ToastContext'
import { formatDate } from '../lib/format'
import { validateTransaction } from '../lib/validateTransaction'
import TransactionFields from '../components/TransactionFields'
import EmptyState from '../components/EmptyState'

export default function TransactionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { transactions, error, updateTransaction, deleteTransaction, restoreTransaction } =
    useTransactions()
  const { format } = useSettings()
  const { notify } = useToast()
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')

  const transaction = transactions.find(item => item.id === id)

  if (error) {
    return (
      <EmptyState icon="missing" title="Couldn't load your transactions">
        <p className="error">{error}</p>
        <Link to="/" className="button">Back to dashboard</Link>
      </EmptyState>
    )
  }

  if (!transaction) {
    return (
      <EmptyState icon="missing" title="That transaction doesn't exist">
        <Link to="/" className="button">Back to dashboard</Link>
      </EmptyState>
    )
  }

  function startEditing() {
    setErrors({})
    setFailure('')
    setForm({
      description: transaction.description,
      amount: String(transaction.amount),
      type: transaction.type,
      category: transaction.category,
      date: transaction.date,
      note: transaction.note || '',
    })
  }

  function setField(patch) {
    setForm(current => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }))
  }

  async function handleSave(event) {
    event.preventDefault()
    const found = validateTransaction(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    const message = await updateTransaction(id, {
      description: form.description.trim(),
      amount: Number(form.amount),
      type: form.type,
      category: form.category,
      date: form.date,
      note: form.note.trim(),
    })
    setBusy(false)

    if (message) {
      setFailure(message)
      notify({ message: `Could not save: ${message}`, tone: 'danger' })
      return
    }
    setForm(null)
    notify({ message: 'Changes saved.', tone: 'success' })
  }

  // No confirm dialog: the toast offers Undo, which is both less friction and
  // more forgiving than asking someone to predict whether they meant it.
  async function handleDelete() {
    setBusy(true)
    const { message, removed } = await deleteTransaction(id)
    setBusy(false)

    if (message) {
      setFailure(message)
      notify({ message: `Could not delete: ${message}`, tone: 'danger' })
      return
    }

    navigate('/')
    notify({
      message: `Deleted "${removed?.description ?? 'transaction'}". You can also restore it later from Activity.`,
      actionLabel: 'Undo',
      onAction: async () => {
        const restoreError = await restoreTransaction(removed)
        notify(
          restoreError
            ? { message: `Could not restore: ${restoreError}`, tone: 'danger' }
            : { message: 'Transaction restored.', tone: 'success' }
        )
      },
    })
  }

  // Hands the fields to /add rather than opening a second entry surface, so
  // there is still exactly one place a transaction gets created.
  function duplicate() {
    navigate('/add', {
      state: {
        prefill: {
          description: transaction.description,
          amount: String(transaction.amount),
          type: transaction.type,
          category: transaction.category,
          note: transaction.note || '',
        },
      },
    })
  }

  if (form) {
    return (
      <>
        <header className="page-head">
          <div>
            <h1>Edit transaction</h1>
            <p className="page-sub">Change any detail and save.</p>
          </div>
        </header>

        <form className="panel form-panel" onSubmit={handleSave} noValidate>
          <TransactionFields form={form} errors={errors} onField={setField} notePlaceholder="Note" />

          {failure && <p className="error">{failure}</p>}

          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="button" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      </>
    )
  }

  const isIncome = transaction.type === 'income'

  return (
    <>
      <Link to="/" className="back-link" aria-label="Back to dashboard">←</Link>

      <article className="panel detail-panel">
        <span className={`detail-tag ${isIncome ? 'is-income' : 'is-expense'}`}>
          {isIncome ? 'Income' : 'Expense'}
        </span>

        <h1 className="detail-title">{transaction.description}</h1>
        <p className={`detail-amount ${isIncome ? 'is-income' : 'is-expense'}`}>
          {isIncome ? '+' : '−'}{format(transaction.amount)}
        </p>

        <dl className="detail-list">
          <div><dt>Category</dt><dd>{transaction.category}</dd></div>
          <div><dt>Date</dt><dd>{formatDate(transaction.date)}</dd></div>
          <div><dt>Note</dt><dd>{transaction.note || '—'}</dd></div>
        </dl>

        {failure && <p className="error">{failure}</p>}

        <div className="form-actions">
          <button type="button" className="button button-primary" onClick={startEditing}>Edit</button>
          <button type="button" className="button" onClick={duplicate}>Duplicate</button>
          <button type="button" className="button button-danger" onClick={handleDelete} disabled={busy}>
            {busy ? 'Working…' : 'Delete'}
          </button>
        </div>
      </article>
    </>
  )
}
