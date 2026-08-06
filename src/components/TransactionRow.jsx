import { memo } from 'react'
import { Link } from 'react-router-dom'

function TransactionRow({ transaction }) {
    const { id, description, category, date, amount, type } = transaction
    const isIncome = type === 'income'

    return (
        <Link to={`/transaction/${id}`} className="row">
            <div>
                <div>{description}</div>
                <div className="row-meta">{category} · {date}</div>
            </div>
            <div className={isIncome ? 'income' : 'expense'}>
                {isIncome ? '+' : '-'}${amount.toFixed(2)}
            </div>
        </Link>
    )
}

export default memo(TransactionRow)