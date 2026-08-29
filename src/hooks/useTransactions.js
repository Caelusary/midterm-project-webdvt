import { useData } from '../context/DataContext'

/**
 * Reading and writing transactions to persistent storage (this browser's
 * localStorage).
 *
 * Every page uses this one hook — no page touches storage directly and no
 * persistence logic is duplicated anywhere. Writes go to storage first and
 * only reach state once they land, so what is on screen is always what was
 * actually saved.
 */
export function useTransactions() {
  const {
    transactions,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
  } = useData()

  return {
    transactions,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    restoreTransaction,
  }
}
