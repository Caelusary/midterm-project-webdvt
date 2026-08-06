import { useCallback, useState } from "react";

const STORAGE_KEY = 'budget-transactions'

function readFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

export function useTransactions() {
    const [transactions, setTransactions] =
useState(readFromStorage)

    const persist = useCallback((updater) => {
        setTransactions(current => {
            const next = updater(current)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
            return next
        })
    }, [])

    const addTransaction = useCallback((transaction) => {
        const entry = { ...transaction, id: crypto.randomUUID() }
        persist(current => [entry, ...current])
    }, [persist])

    const updateTransaction = useCallback((id, updates) => {
        persist(current => current.map(item => (item.id === id ? { ...item, ...updates } : item)))
    }, [persist])

    const deleteTransaction = useCallback((id) => {
        persist(current => current.filter(item => item.id !== id))
    }, [persist])

    return { transactions, addTransaction, updateTransaction, deleteTransaction }
}