import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransactions } from '../hooks/useTransactions'
import { CATEGORIES } from '../constants'

const EMPTY_FORM = {
    description: '',
    amount: '',
    type: 'expense',
    category: 'Food',
    date: '',
    note: '',
}

function validate(form) {
    const errors = {}
    if (!form.description.trim()) errors.description = 'Description is required'
    if (!form.amount) errors.amount = 'Amount is required'
    else if (Number(form.amount) <= 0) errors.amount = 'Amount must be greater than 0'
    if (!form.date) errors.date = 'Date is required'
    return errors
}

export default function AddTransaction() {
    const { addTransaction } = useTransactions()
    const navigate = useNavigate()
    const [form, setForm] = useState(EMPTY_FORM)
    const [errors, setErrors] = useState({})

    function handleChange(event) {
        const { name, value } = event.target
        setForm(current => ({ ...current, [name]: value}))
    }

    function handleSubmit(event) {
        event.preventDefault()
        const found = validate(form)
        setErrors(found)
        if(Object.keys(found).length > 0) return

        addTransaction({
            description: form.description.trim(),
            amount: Number(form.amount),
            type: form.type,
            category: form.category,
            date: form.date,
            note: form.note.trim(),
        })
        navigate('/')
    }

    return (
        <form className="card" onSubmit={handleSubmit} noValidate>
            <div className="field">
                <label htmlFor="description">Description</label>
                <input id="description" name="description" value={form.description} onChange={handleChange} placeholder="Weekly Groceries" />
                {errors.description && <p className="error">{errors.description}</p>}
            </div>

            <div className="field">
                <label htmlFor="amount">Amount</label>
                <input id="amount" name="amount" type="number" step="0.01" value={form.amount} onChange={handleChange} placeholder="420" />
                {errors.amount && <p className="error">{errors.amount}</p>}
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
                {errors.date && <p className="error">{errors.date}</p>}
            </div>

            <div className="field">
                <label htmlFor="note">Note (optional)</label>
                <textarea id="note" name="note" rows="2" value={form.note} onChange={handleChange} />
            </div>

            <button type="submit">Save transaction</button>
        </form>
    )
}