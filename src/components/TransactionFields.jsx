import { categoryOptionsFor, TYPES } from '../constants'
import { currencySymbol } from '../lib/format'
import { useSettings } from '../hooks/useSettings'
import { useCalculator } from '../context/CalculatorContext'
import Select from './Select'

/**
 * The transaction form's fields, shared by the Add page and the Detail page's
 * edit mode. Both owned an identical copy before this existed, which is how
 * they drifted — one said "Note (optional)", the other "Note".
 *
 * Each page keeps its own state and submit handler; only the markup and the
 * type→category coupling live here.
 */
export default function TransactionFields({ form, errors, onField, notePlaceholder }) {
  const { currency, format } = useSettings()
  const { total: calcTotal, expression, hasInput: hasCalcInput, hasError } = useCalculator()

  // Switching type invalidates the chosen category — "Rent" is not income.
  function handleTypeChange(nextType) {
    onField({ type: nextType, category: '' })
  }

  // The tape goes into the note so the figure stays explainable months later.
  function applyCalculator() {
    onField(current => ({
      amount: String(calcTotal),
      note: current.note.trim() ? `${current.note.trim()} · ${expression}` : expression,
    }))
  }

  return (
    <>
      <div className="field">
        <label htmlFor="description">Description</label>
        <input id="description" value={form.description} maxLength={200}
          placeholder="Weekly groceries"
          onChange={event => onField({ description: event.target.value })} />
        {errors.description && <p className="error">{errors.description}</p>}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="amount">Amount</label>
          <div className="input-prefix">
            <span>{currencySymbol(currency)}</span>
            <input id="amount" type="number" step="0.01" min="0" value={form.amount}
              placeholder="0.00" onWheel={event => event.currentTarget.blur()}
              onChange={event => onField({ amount: event.target.value })} />
          </div>
          {errors.amount && <p className="error">{errors.amount}</p>}
          {hasCalcInput && !hasError && (
            <button type="button" className="link-button" onClick={applyCalculator}>
              Use calculator total ({format(calcTotal)})
            </button>
          )}
        </div>

        <div className="field">
          <label htmlFor="date">Date</label>
          <input id="date" type="date" value={form.date}
            onChange={event => onField({ date: event.target.value })} />
          {errors.date && <p className="error">{errors.date}</p>}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="type">Type</label>
          <Select id="type" value={form.type} onChange={handleTypeChange}
            options={TYPES} placeholder="Income or expense"
            invalid={Boolean(errors.type)} />
          {errors.type && <p className="error">{errors.type}</p>}
        </div>

        <div className="field">
          <label htmlFor="category">Category</label>
          <Select id="category" value={form.category}
            onChange={next => onField({ category: next })}
            options={categoryOptionsFor(form.type)} disabled={!form.type}
            placeholder={form.type ? 'Choose a category' : 'Pick a type first'}
            invalid={Boolean(errors.category)} />
          {errors.category && <p className="error">{errors.category}</p>}
        </div>
      </div>

      <div className="field">
        <label htmlFor="note">{notePlaceholder ?? 'Note (optional)'}</label>
        <textarea id="note" rows="2" value={form.note} maxLength={500}
          onChange={event => onField({ note: event.target.value })} />
        {errors.note && <p className="error">{errors.note}</p>}
      </div>
    </>
  )
}
