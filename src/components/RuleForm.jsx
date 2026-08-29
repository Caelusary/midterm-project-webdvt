import { useState } from 'react'
import { categoryOptionsFor, TYPES } from '../constants'
import { WEEKDAYS, ordinal } from '../lib/period'
import { validateTransaction } from '../lib/validateTransaction'
import Select from './Select'
import MoneyInput from './MoneyInput'

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

// Stored rules keep numbers as numbers; the form keeps everything as strings so
// a half-typed value is never coerced while the user is still typing.
function formFromRule(rule) {
  if (!rule) return EMPTY_FORM
  return {
    description: rule.description,
    amount: String(rule.amount),
    type: rule.type,
    category: rule.category,
    frequency: rule.frequency,
    day_of_month: String(rule.day_of_month ?? 1),
    weekdays: rule.weekdays ?? [],
    note: rule.note || '',
  }
}

/**
 * The create/edit form for a recurring rule.
 *
 * Owns the draft and its validation; the page owns the rules themselves. The
 * split matters for switching between rules: the page gives this a `key` of the
 * rule being edited, so picking a different rule remounts the form with that
 * rule's values instead of syncing props into state through an effect.
 *
 * `onSave` returns an error message, or null when the save landed.
 */
export default function RuleForm({ editingRule, onSave, onCancel }) {
  const [form, setForm] = useState(() => formFromRule(editingRule))
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

  async function handleSubmit(event) {
    event.preventDefault()

    // Rules carry a schedule instead of a date, so date validation is off.
    const found = validateTransaction(form, { requireDate: false })
    if (isWeekly && form.weekdays.length === 0) found.weekdays = 'Pick at least one day'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    const message = await onSave({
      description: form.description.trim(),
      amount: Number(form.amount),
      type: form.type,
      category: form.category,
      note: form.note.trim(),
      frequency: form.frequency,
      day_of_month: isWeekly ? null : Number(form.day_of_month),
      weekdays: isWeekly ? form.weekdays : [],
    })
    setBusy(false)

    // Editing unmounts this form (the page drops the key), so only the create
    // case has to clear itself for the next rule.
    if (!message && !editingRule) {
      setForm(EMPTY_FORM)
      setErrors({})
    }
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit} noValidate>
      <h2>{editingRule ? 'Edit rule' : 'New rule'}</h2>
      {editingRule && (
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
        <MoneyInput id="rule-amount" value={form.amount} placeholder="0.00"
          onChange={amount => setField('amount', amount)} />
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
          <span id="weekday-label" className="field-label">On these days</span>
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
          {busy ? 'Saving…' : editingRule ? 'Save changes' : 'Add rule'}
        </button>
        {editingRule && (
          <button type="button" className="button" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  )
}
