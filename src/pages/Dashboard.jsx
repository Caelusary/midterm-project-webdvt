import { useMemo, useState } from "react"
import { useTransactions } from '../hooks/useTransactions'
import { CATEGORIES } from '../constants'
import TransactionRow from "../components/TransactionRow"

export default function Dashboard() {
    const { transactions } = useTransactions()
    const [category, setCategory] = useState('all')
    const [type, setType] = useState('all')

    const totals = useMemo(() => {
        let income = 0
        let expenses = 0
        for (const item of transactions) {
            if (item.type === 'income') income += item.amount
            else expenses += item.amount
        }
        return { income, expenses, balance: income - expenses }
    }, [transactions])

    const visible = useMemo(() => {
        return transactions.filter(item=> {
            const matchesCategory = category === 'all' || item.category === category
            const matchesType = type === 'all' || item.type === type
            return matchesCategory && matchesType
        })
    }, [transactions, category, type])

    return (
        <>
            <div className="stats">
                <div className="card">
                    <div className="stat-label">Balance</div>
                    <div className="stat-value">${totals.balance.toFixed(2)}</div>
                </div>

                <div className="card">
                    <div className="stat-label">Income</div>
                    <div className="stat-value income">${totals.income.toFixed(2)}</div>
                </div>

                <div className="card">
                    <div className="stat-label">Expenses</div>
                    <div className="stat-value expense">${totals.expenses.toFixed(2)}</div>
                </div>
            </div>

            <div className="filters">
                <select value={category} onChange={event => setCategory(event.target.value)}>
                    <option value="all">All categories</option>
                    {CATEGORIES.map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
                <select value={type} onChange={event => setType(event.target.value)}>
                    <option value="all">All types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                </select>
            </div>

            {visible.length === 0 ? (
                <p className="empty">No transactions to show.</p>
            ) : (
                visible.map(item => <TransactionRow key={item.id} transaction={item} />)
            )}
        </>
    )
}