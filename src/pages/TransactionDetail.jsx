import { useState } from "react";
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTransactions } from "../hooks/useTransactions";
import { CATEGORIES } from "../constants";

export default function TransactionDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { transactions, updateTransaction, deleteTransaction } = useTransactions()
    const [form, setForm] = useState(null)

    const transaction = transactions.find(item => item.id === id)

    if (!transaction) {
        return (
            <>
                <p className="empty">That transaction doesn't exist.</p>
                <Link to="/">Back to dashboard</Link>
            </>
        )
    }

    function startEditing() {
        setForm({
            description: transaction.description,
            amount: String(transaction.amount),
            type: transaction.type,
            category: transaction.category,
            date: transaction.date,
            note: transaction.note || '',
        })
    }

    function handleChange(event) {
        const { name, value } = event.target
        setForm(current => ({ ...current, [name]: value}))
    }

    function handleSave(event) {
        event.preventDefault()
        if (!form.description.trim() || Number(form.amount) <= 0 || !form.date) return
        updateTransaction(id, {
            description: form.description.trim(),
            amount: Number(form.amount),
            type: form.type,
            category: form.category,
            date: form.date,
            note: form.note.trim(),
        })
        setForm(null)
    }

    function handleDelete() {
        if (window.confirm('Delete this transaction?')) {
            deleteTransaction(id)
            navigate('/')
        }
    }

    if (form) {
        return (
            <form className="card" onSubmit={handleSave} noValidate>
                <div className="field">
                    <label htmlFor="description">Description</label>
                    <input id="description" name="description" value={form.description} onChange={handleChange} />
                </div>
                <div className="field">
                    <label htmlFor="amount">Amount</label>
                    <input id="amount" name="amount" type="number" step="0.01" value={form.amount} onChange={handleChange} />
                </div>
                <div className="field">
                    <label htmlFor="type">Type</label>
                    <select id="type" name="type" value={form.type} onChange={handleChange}>
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                    </select>
                </div>
                <div className="field">
                    <label htmlFor="category">Category</label>
                    <select id="category" name="category" value={form.category} onChange={handleChange}>
                        {CATEGORIES.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label htmlFor="date">Date</label>
                    <input id="date" name="date" type="date" value={form.date} onChange={handleChange} />
                </div>
                <div className="field">
                    <label htmlFor="note">Note</label>
                    <textarea id="note" name="note" rows="2" value={form.note} onChange={handleChange} />
                </div>
                <button type="submit">Save changes</button>
                <button type="button" onClick={() => setForm(null)}>Cancel</button>
            </form>
        )
    }

    const isIncome = transaction.type === 'income'

    return (
        <div className="card">
            <Link to="/" className="row-meta">← Back to dashboard</Link>

            <h2>{transaction.description}</h2>
            <p className={isIncome ? 'income stat-value' : 'expense stat-value'}>
                {isIncome ? '+' : '-'}${transaction.amount.toFixed(2)}
            </p>

            <div className="row"><span className="row-meta">Type</span><span>{isIncome ? 'Income' : 'Expense'}</span></div>
            <div className="row"><span className="row-meta">Category</span><span>{transaction.category}</span></div>
            <div className="row"><span className="row-meta">Date</span><span>{transaction.date}</span></div>
            <div className="row"><span className="row-meta">Note</span><span>{transaction.note || '—'}</span></div>

            <p>
                <button type="button" onClick={startEditing}>Edit</button>
                <button type="button" className="danger" onClick={handleDelete}>Delete</button>
            </p>
        </div>
    )
}