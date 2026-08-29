import { useState } from 'react'
import { useRecurring } from '../hooks/useRecurring'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../context/ToastContext'
import { categoryOptionsFor, TYPES } from '../constants'
import { currencySymbol, todayISO } from '../lib/format'
import { WEEKDAYS, describeSchedule, ordinal } from '../lib/period'
import { validateTransaction } from '../lib/validateTransaction'
import Select from '../components/Select'
import EmptyState from '../components/EmptyState'

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Every month' },
  { value: 'weekly', label: 'Certain days of the week' },
]

const DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => ({
  value: String(index + 1),
  label: index + 1 >= 29 ? `${ordinal(index + 1)} (or month end)` : ordinal(index + 1),
}))

const WEEKDAY_VALUES = [1, 2, 3, 4, 5]

const EMPTY_FORM = {
  description: '',
  amount: '',
  type: '',
  category: '',
  frequency: 'monthly',
  day_of_month: '1',
  weekdays: [],
  note: '',
}

export default function Recurring() {
  const { rules, addRule, updateRule, toggleRule, deleteRule } = useRecurring()
  const { currency, format } = useSettings()
  const { notify } = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const categoryOptions = categoryOptionsFor(form.type)
  const isWeekly = form.frequency === 'weekly'

  function setField(name, value) {
    setForm(current => ({ ...current, [name]: value }))
  }

  function toggleWeekday(day) {
    setForm(current => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter(value => value !== day)
        : [...current.weekdays, day],
    }))
  }

  function startEditing(rule) {
    setEditingId(rule.id)
    setErrors({})
    setForm({
      description: rule.description,
      amount: String(rule.amount),
      type: rule.type,
      category: rule.category,
      frequency: rule.frequency,
      day_of_month: String(rule.day_of_month ?? 1),
      weekdays: rule.weekdays ?? [],
      note: rule.note || '',
    })
  }

  function cancelEditing() {
    setEditingId(null)
    setErrors({})
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    // Rules carry a schedule instead of a date, so date validation is off.
    const found = validateTransaction(form, { requireDate: false })
    if (isWeekly && form.weekdays.length === 0) found.weekdays = 'Pick at least one day'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const payload = {
      description: form.description.trim(),
      amount: Number(form.amount),
      type: form.type,
      category: form.category,
      note: form.note.trim(),
      frequency: form.frequency,
      day_of_month: isWeekly ? null : Number(form.day_of_month),
      weekdays: isWeekly ? form.weekdays : [],
    }

    setBusy(true)
    const message = editingId
      ? await updateRule(editingId, payload)
      : await addRule({ ...payload, start_date: todayISO() })
    setBusy(false)

    if (message) {
      notify({ message: `Could not save the rule: ${message}`, tone: 'danger' })
      return
    }

    const wasEditing = Boolean(editingId)
    cancelEditing()
    notify({
      message: wasEditing ? 'Rule updated.' : 'Recurring rule saved.',
      tone: 'success',
    })
  }

  async function handleDelete(rule) {
    if (editingId === rule.id) cancelEditing()
    const message = await deleteRule(rule.id)
    notify(
      message
        ? { message: `Could not delete: ${message}`, tone: 'danger' }
        : { message: `Removed "${rule.description}". Transactions it already created are kept.` }
    )
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Recurring</h1>
          <p className="page-sub">Rent, allowance, the daily commute — logged automatically.</p>
        </div>
      </header>

      <div className="add-layout">
        <section className="panel">
          <h2>Your rules</h2>

          {rules.length === 0 ? (
            <EmptyState icon="repeat" title="Nothing recurring yet">
              <p className="hint">Add a rule and it posts itself from now on.</p>
            </EmptyState>
          ) : (
            <ul className="rule-list">
              {rules.map(rule => (
                <li key={rule.id}
                  className={`rule-row${rule.active ? '' : ' is-paused'}${
                    editingId === rule.id ? ' is-editing' : ''
                  }`}>
                  <span className={`row-badge ${rule.type === 'income' ? 'is-income' : 'is-expense'}`}
                    aria-hidden="true">
                    {rule.type === 'income' ? '↓' : '↑'}
                  </span>

                  <span className="row-main">
                    <span className="row-title">{rule.description}</span>
                    <span className="row-meta">
                      {rule.category} · {describeSchedule(rule)}
                      {rule.last_created_on ? ` · last posted ${rule.last_created_on}` : ''}
                    </span>
                  </span>

                  <span className={`row-amount ${rule.type === 'income' ? 'is-income' : 'is-expense'}`}>
                    {rule.type === 'income' ? '+' : '−'}{format(rule.amount)}
                  </span>

                  <span className="rule-actions">
                    <button type="button" className="link-button"
                      onClick={() => startEditing(rule)}>
                      {editingId === rule.id ? 'Editing…' : 'Edit'}
                    </button>
                    <button type="button"
                      className={`link-button${rule.active ? '' : ' is-resume'}`}
                      onClick={() => toggleRule(rule.id, !rule.active)}>
                      {rule.active ? 'Pause' : 'Resume'}
                    </button>
                    <button type="button" className="link-button is-muted"
                      onClick={() => handleDelete(rule)}>
                      Delete
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="add-aside">
          <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
            <h2>{editingId ? 'Edit rule' : 'New rule'}</h2>
            {editingId && (
              <p className="hint">
                Changes apply from the next due date. Transactions already posted stay as they are.
              </p>
            )}

            <div className="field">
              <label htmlFor="rule-description">Description</label>
              <input id="rule-description" value={form.description} placeholder="Lunch at campus"
                onChange={event => setField('description', event.target.value)} />
              {errors.description && <p className="error">{errors.description}</p>}
            </div>

            <div className="field">
              <label htmlFor="rule-amount">Amount</label>
              <div className="input-prefix">
                <span>{currencySymbol(currency)}</span>
                <input id="rule-amount" type="number" step="0.01" min="0" value={form.amount}
                  placeholder="0.00" onWheel={event => event.currentTarget.blur()}
                  onChange={event => setField('amount', event.target.value)} />
              </div>
              {errors.amount && <p className="error">{errors.amount}</p>}
            </div>

            <div className="field">
              <label htmlFor="rule-type">Type</label>
              <Select id="rule-type" value={form.type}
                onChange={next => setForm(current => ({ ...current, type: next, category: '' }))}
                options={TYPES} placeholder="Income or expense"
                invalid={Boolean(errors.type)} />
              {errors.type && <p className="error">{errors.type}</p>}
            </div>

            <div className="field">
              <label htmlFor="rule-category">Category</label>
              <Select id="rule-category" value={form.category}
                onChange={next => setField('category', next)} options={categoryOptions}
                disabled={!form.type}
                placeholder={form.type ? 'Choose a category' : 'Pick a type first'}
                invalid={Boolean(errors.category)} />
              {errors.category && <p className="error">{errors.category}</p>}
            </div>

            <div className="field">
              <label htmlFor="rule-frequency">Repeats</label>
              <Select id="rule-frequency" value={form.frequency}
                onChange={next => setField('frequency', next)} options={FREQUENCY_OPTIONS}
                ariaLabel="How often the rule repeats" />
            </div>

            {isWeekly ? (
              <div className="field">
                <label id="weekday-label">On these days</label>
                <div className="weekday-grid" role="group" aria-labelledby="weekday-label">
                  {WEEKDAYS.map(day => (
                    <button key={day.value} type="button"
                      className={`weekday${form.weekdays.includes(day.value) ? ' is-on' : ''}`}
                      aria-pressed={form.weekdays.includes(day.value)}
                      aria-label={day.label}
                      onClick={() => toggleWeekday(day.value)}>
                      {day.short}
                    </button>
                  ))}
                </div>
                <button type="button" className="link-button"
                  onClick={() => setField('weekdays', WEEKDAY_VALUES)}>
                  Select weekdays
                </button>
                {errors.weekdays && <p className="error">{errors.weekdays}</p>}
                <p className="hint">
                  One transaction per selected day, every week. Two days ticked means two
                  transactions a week.
                </p>
              </div>
            ) : (
              <div className="field">
                <label htmlFor="rule-day">Day of the month</label>
                <Select id="rule-day" value={form.day_of_month}
                  onChange={next => setField('day_of_month', next)} options={DAY_OPTIONS}
                  ariaLabel="Day of month" />
                <p className="hint">
                  Pick 29–31 for month end. In shorter months the rule lands on the last real day
                  instead of skipping.
                </p>
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="button button-primary" disabled={busy}>
                {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add rule'}
              </button>
              {editingId && (
                <button type="button" className="button" onClick={cancelEditing}>Cancel</button>
              )}
            </div>
          </form>
        </aside>
      </div>
    </>
  )
}
