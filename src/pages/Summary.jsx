import { useMemo } from 'react';
import { useTransactions } from '../hooks/useTransactions';

export default function Summary() {
    const { transactions } = useTransactions()

    const breakdown = useMemo(() => {
        const totals = {}
        let total = 0
        for (const item of transactions) {
            if (item.type !== 'expense') continue
            totals[item.category] = (totals[item.category] || 0) + item.amount
            total += item.amount
        }
        return Object.entries(totals)
            .map(([category, amount]) => ({
                category,
                amount,
                percent: total === 0 ? 0 : Math.round((amount / total) * 100),
            }))
            .sort((a, b) => b.amount - a.amount)
    }, [transactions])

    const totalSpent = breakdown.reduce((sum, item) => sum + item.amount, 0)

    return (
        <>
            <h2>Spending by category</h2>

            {breakdown.length === 0 ? (
                <p className="empty">No expenses recorded yet.</p>
            ) : (
                <div className="card">
                    {breakdown.map(item => (
                        <div key={item.category} style={{ marginBottom: 14 }}>
                            <div className="row" style={{ borderBottom: 'none', padding: '0 0 6px'}}>
                                <span>{item.category}</span>
                                <span className="row-meta">${item.amount.toFixed(2)} · {item.percent}%</span>
                            </div>
                            <div className="bar-track">
                                <div className="bar-fill" style={{ width: `${item.percent}%` }} />
                            </div>
                        </div>
                    ))}
                    <p className="row-meta">Total spent: ${totalSpent.toFixed(2)}</p>
                </div>
            )}
        </>
    )
}