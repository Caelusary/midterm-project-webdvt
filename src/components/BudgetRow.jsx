import { useState } from 'react'
import { useSettings } from '../hooks/useSettings'
import { isOver } from '../lib/money'
import MoneyInput from './MoneyInput'

export default function BudgetRow({ category, spent, limit, color, onSave, onRemove }) {
  const { format } = useSettings()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const ratio = limit > 0 ? spent / limit : 0
  const percent = Math.round(ratio * 100)
  // Compared in cents: four amounts summing to exactly the limit would
  // otherwise land a hair above it and report "Over by ₱0.00".
  const over = limit > 0 && isOver(spent, limit)
  const close = !over && ratio >= 0.8

  function startEditing() {
    setDraft(limit ? String(limit) : '')
    setEditing(true)
  }

  async function save(event) {
    event.preventDefault()
    // required + min="1" mean the browser blocks empty, zero and negative
    // before this runs; this stays as a guard, not as the user-facing message.
    const next = Number(draft)
    if (!Number.isFinite(next) || next <= 0) return
    setBusy(true)
    await onSave(category, next)
    setBusy(false)
    setEditing(false)
  }

  return (
    <li className="budget-row">
      <div className="breakdown-head">
        <span className="breakdown-name">
          <span className="chart-swatch" style={{ background: color }} />
          {category}
        </span>

        {limit > 0 ? (
          <span className={`breakdown-figures${over ? ' is-expense' : ''}`}>
            {format(spent)} <span className="breakdown-pct">of {format(limit)}</span>
          </span>
        ) : (
          <span className="breakdown-figures">
            {format(spent)} <span className="breakdown-pct">no limit</span>
          </span>
        )}
      </div>

      <div className="bar-track">
        <div className={`bar-fill${over ? ' is-over' : ''}${limit > 0 ? '' : ' is-unset'}`}
          style={{
            transform: `scaleX(${limit > 0 ? Math.min(1, ratio) : 0})`,
            // Left unset when there is no limit so the stylesheet can colour it
            // without needing !important to beat an inline value.
            background: limit > 0 ? (over ? 'var(--expense)' : color) : undefined,
          }} />
      </div>

      <div className="budget-foot">
        <span className={`budget-status${over ? ' is-over' : close ? ' is-close' : ''}`}>
          {limit > 0
            ? over
              ? `Over by ${format(spent - limit)}`
              : `${format(limit - spent)} left · ${percent}% used`
            : 'No limit set'}
        </span>

        {editing ? (
          <form className="budget-form" onSubmit={save}>
            <MoneyInput min="1" step="1" required autoFocus value={draft}
              onChange={setDraft} aria-label={`Monthly limit for ${category}`} />
            <button type="submit" className="button button-primary" disabled={busy}>Save</button>
            <button type="button" className="button" onClick={() => setEditing(false)}>Cancel</button>
          </form>
        ) : (
          <span className="budget-actions">
            <button type="button" className="link-button" onClick={startEditing}>
              {limit > 0 ? 'Edit limit' : 'Set limit'}
            </button>
            {limit > 0 && (
              <button type="button" className="link-button is-muted"
                onClick={() => onRemove(category)}>
                Remove
              </button>
            )}
          </span>
        )}
      </div>
    </li>
  )
}
