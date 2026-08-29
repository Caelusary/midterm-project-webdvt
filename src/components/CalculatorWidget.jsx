import { useEffect, useRef } from 'react'
import { useCalculator } from '../context/CalculatorContext'
import { useSettings } from '../hooks/useSettings'

const KEYS = [
  { label: '7', kind: 'digit', value: '7' },
  { label: '8', kind: 'digit', value: '8' },
  { label: '9', kind: 'digit', value: '9' },
  { label: '÷', kind: 'operator', value: '/' },

  { label: '4', kind: 'digit', value: '4' },
  { label: '5', kind: 'digit', value: '5' },
  { label: '6', kind: 'digit', value: '6' },
  { label: '×', kind: 'operator', value: '*' },

  { label: '1', kind: 'digit', value: '1' },
  { label: '2', kind: 'digit', value: '2' },
  { label: '3', kind: 'digit', value: '3' },
  { label: '−', kind: 'operator', value: '-' },

  { label: '0', kind: 'digit', value: '0' },
  { label: '.', kind: 'digit', value: '.' },
  { label: '=', kind: 'equals' },
  { label: '+', kind: 'operator', value: '+' },
]

const KEYBOARD_OPERATORS = { '+': '+', '-': '-', '*': '*', '/': '/', x: '*' }

export default function CalculatorWidget() {
  const {
    open, setOpen, expression, total, hasInput,
    pushDigit, pushOperator, backspace, clear, equals,
  } = useCalculator()
  const { format } = useSettings()
  const displayRef = useRef(null)

  // Keep the tail of a long expression in view, the way a real display scrolls.
  useEffect(() => {
    const node = displayRef.current
    if (node) node.scrollLeft = node.scrollWidth
  }, [expression])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      // Leave real inputs alone — someone typing in a form is not typing here.
      const tag = event.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (/^[0-9.]$/.test(event.key)) {
        event.preventDefault()
        pushDigit(event.key)
      } else if (KEYBOARD_OPERATORS[event.key]) {
        event.preventDefault()
        pushOperator(KEYBOARD_OPERATORS[event.key])
      } else if (event.key === 'Backspace') {
        event.preventDefault()
        backspace()
      } else if (event.key === 'Enter' || event.key === '=') {
        event.preventDefault()
        equals()
      } else if (event.key.toLowerCase() === 'c') {
        event.preventDefault()
        clear()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen, pushDigit, pushOperator, backspace, clear, equals])

  function press(key) {
    if (key.kind === 'digit') pushDigit(key.value)
    else if (key.kind === 'operator') pushOperator(key.value)
    else equals()
  }

  return (
    <>
      <button type="button" className={`calc-fab${open ? ' is-open' : ''}`}
        onClick={() => setOpen(!open)} aria-expanded={open}
        aria-label={open ? 'Close calculator' : 'Open calculator'}>
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
            <path d="M8 7h8" />
            <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" />
          </svg>
        )}
        {!open && hasInput && <span className="calc-badge" aria-hidden="true" />}
      </button>

      {open && (
        <section className="calc-panel" aria-label="Calculator">
          <div className="calc-screen">
            <div className="calc-expression" ref={displayRef} aria-live="off">
              {expression || '0'}
            </div>
            <div className="calc-result" aria-live="polite">
              <span className="calc-equals" aria-hidden="true">=</span>
              {format(total)}
            </div>
          </div>

          <div className="calc-utility">
            <button type="button" className="calc-key is-utility" onClick={clear}>C</button>
            <button type="button" className="calc-key is-utility" onClick={backspace}
              aria-label="Backspace">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 5H9l-6 7 6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z" />
                <path d="M17 9l-5 6M12 9l5 6" />
              </svg>
            </button>
          </div>

          <div className="calc-keys">
            {KEYS.map(key => (
              <button key={key.label} type="button"
                className={`calc-key is-${key.kind}`}
                onClick={() => press(key)}>
                {key.label}
              </button>
            ))}
          </div>

          <p className="hint">Reads left to right — 10 + 5 × 2 is 30.</p>
        </section>
      )}
    </>
  )
}
