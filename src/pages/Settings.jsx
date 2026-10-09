import { useRef, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useData } from '../context/DataContext'
import { useSettings } from '../hooks/useSettings'
import { useTransactions } from '../hooks/useTransactions'
import { useToast } from '../context/ToastContext'
import { CURRENCIES } from '../constants'
import { downloadCsv, downloadJson, transactionsToCsv } from '../lib/exportCsv'
import { backupFilename, buildBackup, parseBackup } from '../lib/schema'
import { todayISO } from '../lib/format'
import Select from '../components/Select'
import ThemeToggle from '../components/ThemeToggle'

const CURRENCY_OPTIONS = CURRENCIES.map(item => ({ value: item.code, label: item.label }))

export default function Settings() {
  const { theme } = useTheme()
  const { currency, updateSettings } = useSettings()
  const { transactions } = useTransactions()
  const { rules, budgets, settings, replaceLedger } = useData()
  const { notify } = useToast()
  const fileInput = useRef(null)
  // A parsed backup waiting for the user to confirm it should replace the ledger.
  const [pending, setPending] = useState(null)
  const [importError, setImportError] = useState('')

  function handleBackup() {
    downloadJson(
      backupFilename(todayISO()),
      buildBackup({ transactions, rules, budgets, settings })
    )
    notify({ message: 'Backup downloaded. Keep it somewhere safe.', tone: 'success' })
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    // Cleared so picking the same file again still fires a change.
    event.target.value = ''
    setPending(null)
    setImportError('')
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setImportError('That file is too large to be a Budgy backup.')
      return
    }
    const result = parseBackup(await file.text())
    if (result.error) setImportError(result.error)
    else setPending({ name: file.name, data: result.data })
  }

  async function confirmRestore() {
    const message = await replaceLedger(pending.data)
    if (message) {
      setImportError(`Could not restore: ${message}`)
      return
    }
    const count = pending.data.transactions.length
    setPending(null)
    notify({
      message: `Restored ${count} ${count === 1 ? 'transaction' : 'transactions'} from the backup.`,
      tone: 'success',
    })
  }

  function handleExport() {
    if (transactions.length === 0) {
      notify({ message: 'Nothing to export yet.', tone: 'danger' })
      return
    }
    downloadCsv(`budgy-transactions-${todayISO()}.csv`, transactionsToCsv(transactions))
    notify({ message: `Exported ${transactions.length} transactions.`, tone: 'success' })
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="page-sub">Preferences and your data.</p>
        </div>
      </header>

      <section className="panel settings-section">
        <div className="settings-head">
          <h2>Appearance</h2>
          <p className="page-sub">
            Currently {theme === 'dark' ? 'dark' : 'light'}. Applies across every page.
          </p>
        </div>
        <ThemeToggle />
      </section>

      <section className="panel settings-section">
        <div className="settings-head">
          <h2>Currency</h2>
          <p className="page-sub">How every amount is displayed.</p>
        </div>
        <div className="settings-control">
          <Select
            value={currency}
            onChange={next => updateSettings({ currency: next })}
            options={CURRENCY_OPTIONS}
            ariaLabel="Display currency"
          />
        </div>
      </section>

      <section className="panel">
        <p className="hint">
          Changing currency swaps the symbol and number formatting only. Amounts you have
          already recorded are not converted. ₱1,000 becomes $1,000, not its exchange-rate
          equivalent.
        </p>
      </section>

      <section className="panel backup-panel" aria-labelledby="backup-heading">
        <div className="settings-head">
          <h2 id="backup-heading">Back up and restore</h2>
          <p className="page-sub">
            A backup file holds every transaction, recurring rule, budget and setting. Restoring
            one replaces what is in this browser.
          </p>
        </div>
        <div className="backup-actions">
          <button type="button" className="button button-primary" onClick={handleBackup}>
            Download backup
          </button>
          <button type="button" className="button" onClick={() => fileInput.current?.click()}>
            Restore from file
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden
            aria-label="Backup file to restore" data-testid="backup-file" onChange={handleFile} />
        </div>

        {importError && <p className="error" role="alert">{importError}</p>}

        {pending && (
          <div className="backup-confirm" role="group" aria-labelledby="backup-confirm-text">
            <p id="backup-confirm-text">
              Replace your {transactions.length}{' '}
              {transactions.length === 1 ? 'transaction' : 'transactions'} with the{' '}
              {pending.data.transactions.length} in <strong>{pending.name}</strong>?
              {pending.data.dropped > 0 &&
                ` ${pending.data.dropped} unreadable ${pending.data.dropped === 1 ? 'row' : 'rows'} will be skipped.`}
            </p>
            <div className="backup-actions">
              <button type="button" className="button button-danger" onClick={confirmRestore}>
                Replace my data
              </button>
              <button type="button" className="button" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel settings-section">
        <div className="settings-head">
          <h2>Export to a spreadsheet</h2>
          <p className="page-sub">
            Every transaction as a CSV you can open in Excel or Sheets. {transactions.length}{' '}
            {transactions.length === 1 ? 'row' : 'rows'}.
          </p>
        </div>
        <button type="button" className="button" onClick={handleExport}>Download CSV</button>
      </section>

      <section className="panel">
        <h2>Where your data lives</h2>
        <p className="page-sub">
          Budgy stores everything in this browser and nowhere else. There is no account and
          nothing is uploaded. Clearing your browsing data clears the ledger with it, and
          opening Budgy in a different browser or on another device starts you empty. A backup
          file is how you keep a copy, or move your data to another device.
        </p>
      </section>
    </>
  )
}
