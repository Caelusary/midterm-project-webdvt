import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { DataProvider } from './context/DataContext'
import { ToastProvider } from './context/ToastContext'
import { CalculatorProvider } from './context/CalculatorContext'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AddTransaction from './pages/AddTransaction'
import TransactionDetail from './pages/TransactionDetail'
import Summary from './pages/Summary'
import Budgets from './pages/Budgets'
import Recurring from './pages/Recurring'
import Activity from './pages/Activity'
import Settings from './pages/Settings'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <DataProvider>
            <CalculatorProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="add" element={<AddTransaction />} />
                    <Route path="transaction/:id" element={<TransactionDetail />} />
                    <Route path="summary" element={<Summary />} />
                    <Route path="budgets" element={<Budgets />} />
                    <Route path="recurring" element={<Recurring />} />
                    <Route path="activity" element={<Activity />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="*" element={<p className="empty">Page not found.</p>} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </CalculatorProvider>
          </DataProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
