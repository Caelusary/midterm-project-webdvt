import { memo } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../lib/format'

/**
 * Wrapped in memo because the Dashboard re-renders on every filter keystroke
 * and on every theme change. Without it each of those re-renders every row in
 * the ledger; with it React skips any row whose transaction object is
 * unchanged, which is all of them.
 */
function TransactionRow({ transaction, format }) {
  const { id, description, category, date, amount, type } = transaction
  const isIncome = type === 'income'

  return (
    <Link to={`/transaction/${id}`} className="ledger-row">
      <span className={`row-badge ${isIncome ? 'is-income' : 'is-expense'}`} aria-hidden="true">
        {isIncome ? '↓' : '↑'}
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
