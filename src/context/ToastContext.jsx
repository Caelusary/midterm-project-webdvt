import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

const DEFAULT_DURATION = 6000
// A toast you are meant to read *and* click needs longer than one you only
// read. Six seconds is not enough to notice an Undo, decide, and reach it.
const ACTION_DURATION = 12000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id)
    if (timer) {
      window.clearTimeout(timer.handle)
      timers.current.delete(id)
    }
    setToasts(current => current.filter(toast => toast.id !== id))
  }, [])

  const schedule = useCallback(
    (id, delay) => {
      const existing = timers.current.get(id)
      if (existing) window.clearTimeout(existing.handle)
      timers.current.set(id, {
        handle: window.setTimeout(() => dismiss(id), delay),
        remaining: delay,
        startedAt: Date.now(),
      })
    },
    [dismiss]
  )

  // Hovering holds the toast open — reaching for Undo should not be a race.
  const pause = useCallback((id) => {
    const timer = timers.current.get(id)
    if (!timer) return
    window.clearTimeout(timer.handle)
    timer.remaining = Math.max(1500, timer.remaining - (Date.now() - timer.startedAt))
  }, [])

  const resume = useCallback(
    (id) => {
      const timer = timers.current.get(id)
      if (!timer) return
      schedule(id, timer.remaining)
    },
    [schedule]
  )

  const notify = useCallback(
    ({ message, tone = 'info', actionLabel, onAction, duration }) => {
      const id = crypto.randomUUID()
      setToasts(current => [...current, { id, message, tone, actionLabel, onAction }])
      schedule(id, duration ?? (actionLabel ? ACTION_DURATION : DEFAULT_DURATION))
      return id
    },
    [schedule]
  )

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast is-${toast.tone}`}
            onMouseEnter={() => pause(toast.id)}
            onMouseLeave={() => resume(toast.id)}>
            <span className="toast-message">{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.onAction?.()
                  dismiss(toast.id)
                }}
              >
                {toast.actionLabel}
              </button>
            )}
            <button type="button" className="toast-close" aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside a ToastProvider')
  }
  return context
}
