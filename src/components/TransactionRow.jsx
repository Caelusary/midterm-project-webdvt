import { memo } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../lib/format'

/**
 * Wrapped in memo because the Dashboard re-renders on state that has nothing
 * to do with the rows — every filter keystroke, and every keystroke in the
 * savings-goal field. Without it each of those re-renders every row on screen.
 *
 * memo is a shallow prop compare, so it only pays off if both props hold their
 * identity: `transaction` does because sortTransactions copies the array
 * without replacing untouched rows, and `format` does because useSettings
 * wraps it in useCallback on the currency.
 */
function TransactionRow({ transaction, format }) {
  const { id, description, category, date, amount, type } = transaction
  const isIncome = type === 'income'

  return (
    <Link to={`/transaction/${id}`} className="ledger-row">
      <span className={`row-badge ${isIncome ? 'is-income' : 'is-expense'}`} aria-hidden="true">
        {isIncome ? '↑' : '↓'}
      </span>

      <span className="row-main">
        <span className="row-title">{description}</span>
        <span className="row-meta">{category} · {formatDate(date)}</span>
      </span>

      <span className={`row-amount ${isIncome ? 'is-income' : 'is-expense'}`}>
        {isIncome ? '+' : '−'}{format(amount)}
      </span>
    </Link>
  )
}

export default memo(TransactionRow)
