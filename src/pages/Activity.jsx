import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { clearActivity, deleteActivityEntry, readActivity } from '../lib/activity'
import EmptyState from '../components/EmptyState'
import Select from '../components/Select'

const FILTERS = [
  { value: 'all', label: 'Everything' },
  { value: 'deleted', label: 'Deletions only' },
  { value: 'transaction', label: 'Transactions' },
  { value: 'budget', label: 'Budgets' },
  { value: 'rule', label: 'Recurring rules' },
  { value: 'settings', label: 'Settings' },
]

const ACTION_LABEL = {
  created: 'Added',
  updated: 'Changed',
  deleted: 'Deleted',
  restored: 'Restored',
}

function timeAgo(value) {
  const then = new Date(value)
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`

  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Activity() {
  const { transactions, rules, restoreTransaction, restoreRule } = useData()
  const { notify } = useToast()

  // The log comes straight out of localStorage, so there is nothing to wait
  // for and no load to fail — read it once on mount and keep it in state.
  const [entries, setEntries] = useState(readActivity)
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)

  const visible = useMemo(() => {
    if (filter === 'all') return entries
    if (filter === 'deleted') return entries.filter(entry => entry.action === 'deleted')
    return entries.filter(entry => entry.entity === filter)
  }, [entries, filter])

  // A snapshot exists only on deletions, and only while the row is still gone.
  function canRestore(entry) {
    if (entry.action !== 'deleted' || !entry.snapshot) return false
    if (entry.entity === 'transaction') {
      return !transactions.some(item => item.id === entry.entity_id)
    }
    if (entry.entity === 'rule') {
      return !rules.some(rule => rule.id === entry.entity_id)
    }
    return false
  }

  async function handleRestore(entry) {
    setBusyId(entry.id)
    const message =
      entry.entity === 'transaction'
        ? await restoreTransaction(entry.snapshot)
        : await restoreRule(entry.snapshot)
    setBusyId(null)

    if (message) {
      notify({ message: `Could not restore: ${message}`, tone: 'danger' })
      return
    }

    notify({ message: 'Restored.', tone: 'success' })
    setEntries(readActivity())
  }

  function handleForget(entry) {
    setBusyId(entry.id)
    const message = deleteActivityEntry(entry.id)
    setBusyId(null)

    if (message) {
      notify({ message: `Could not remove: ${message}`, tone: 'danger' })
      return
    }
    setEntries(current => current.filter(item => item.id !== entry.id))
  }

  function handleClearAll() {
    if (!window.confirm('Clear the whole log? Anything not yet restored can no longer be.')) return

    const message = clearActivity()
    if (message) {
      notify({ message: `Could not clear: ${message}`, tone: 'danger' })
      return
    }
    setEntries([])
    notify({ message: 'Activity log cleared.' })
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="page-sub">Everything you have changed, and a way back from deletions.</p>
        </div>
        {entries.length > 0 && (
          <button type="button" className="button" onClick={handleClearAll}>Clear log</button>
        )}
      </header>

      <div className="ledger-controls">
        <div className="filters">
          <Select value={filter} onChange={setFilter} options={FILTERS}
            ariaLabel="Filter activity" />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="repeat"
          title={entries.length === 0 ? 'Nothing logged yet' : 'Nothing matches that filter'}>
          {entries.length === 0 && (
            <p className="hint">Adding, editing and deleting all leave a record here.</p>
          )}
        </EmptyState>
      ) : (
        <section className="panel">
          <ul className="activity-list">
            {visible.map(entry => (
              <li key={entry.id} className={`activity-row is-${entry.action}`}>
                <span className={`activity-tag is-${entry.action}`}>
                  {ACTION_LABEL[entry.action] ?? entry.action}
                </span>

                <span className="row-main">
                  <span className="row-title">{entry.summary}</span>
                  {entry.detail && <span className="row-meta">{entry.detail}</span>}
                </span>

                <span className="activity-time">{timeAgo(entry.created_at)}</span>

                <span className="activity-actions">
                  {entry.entity === 'transaction' &&
                    entry.entity_id &&
                    transactions.some(item => item.id === entry.entity_id) && (
                      <Link className="link-button" to={`/transaction/${entry.entity_id}`}>View</Link>
                    )}

                  {canRestore(entry) && (
                    <button type="button" className="link-button is-resume"
                      disabled={busyId === entry.id}
                      onClick={() => handleRestore(entry)}>
                      {busyId === entry.id ? 'Restoring…' : 'Restore'}
                    </button>
                  )}

                  <button type="button" className="link-button is-muted"
                    disabled={busyId === entry.id}
                    onClick={() => handleForget(entry)}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
