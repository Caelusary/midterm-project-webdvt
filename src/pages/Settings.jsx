import { useTheme } from '../context/ThemeContext'
import { useSettings } from '../hooks/useSettings'
import { useTransactions } from '../hooks/useTransactions'
import { useToast } from '../context/ToastContext'
import { CURRENCIES } from '../constants'
import { downloadCsv, transactionsToCsv } from '../lib/exportCsv'
import { todayISO } from '../lib/format'
import Select from '../components/Select'
import ThemeToggle from '../components/ThemeToggle'

const CURRENCY_OPTIONS = CURRENCIES.map(item => ({ value: item.code, label: item.label }))

export default function Settings() {
  const { theme } = useTheme()
  const { currency, updateSettings } = useSettings()
  const { transactions } = useTransactions()
  const { notify } = useToast()

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
          Changing currency swaps the symbol and number formatting only — amounts you have
          already recorded are not converted. ₱1,000 becomes $1,000, not its exchange-rate
          equivalent.
        </p>
      </section>

      <section className="panel settings-section">
        <div className="settings-head">
          <h2>Export your data</h2>
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
          Budgy stores everything in this browser and nowhere else — there is no account and
          nothing is uploaded. Clearing your browsing data clears the ledger with it, and
          opening Budgy in a different browser or on another device starts you empty. The CSV
          export above is the way to keep a copy.
        </p>
      </section>
    </>
  )
}
