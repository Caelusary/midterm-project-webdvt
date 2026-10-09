import { useState } from 'react'
import { useRecurring } from '../hooks/useRecurring'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../context/ToastContext'
import { todayISO } from '../lib/format'
import { describeSchedule } from '../lib/period'
import RuleForm from '../components/RuleForm'
import EmptyState from '../components/EmptyState'

export default function Recurring() {
  const { rules, addRule, updateRule, toggleRule, deleteRule } = useRecurring()
  const { format } = useSettings()
  const { notify } = useToast()
  const [editingId, setEditingId] = useState(null)

  const editingRule = rules.find(rule => rule.id === editingId) ?? null

  /** Returns an error message, or null when the save landed. */
  async function saveRule(payload) {
    const message = editingId
      ? await updateRule(editingId, payload)
      : await addRule({ ...payload, start_date: todayISO() })

    if (message) {
      notify({ message: `Could not save the rule: ${message}`, tone: 'danger' })
      return message
    }

    const wasEditing = Boolean(editingId)
    setEditingId(null)
    notify({
      message: wasEditing ? 'Rule updated.' : 'Recurring rule saved.',
      tone: 'success',
    })
    return null
  }

  async function handleDelete(rule) {
    if (editingId === rule.id) setEditingId(null)
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
          <p className="page-sub">Rent, allowance, the daily commute, logged automatically.</p>
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
                    {rule.type === 'income' ? '↑' : '↓'}
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
                      onClick={() => setEditingId(rule.id)}>
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
          {/* Keyed on the rule being edited: switching targets remounts the form
              with that rule's values rather than syncing props into state. */}
          <RuleForm key={editingId ?? 'new'} editingRule={editingRule}
            onSave={saveRule} onCancel={() => setEditingId(null)} />
        </aside>
      </div>
    </>
  )
}
