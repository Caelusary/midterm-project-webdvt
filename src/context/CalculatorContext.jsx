import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { OPERATORS } from '../constants'
import { round2 } from '../lib/money'

const CalculatorContext = createContext(null)

const OPERATOR_VALUES = OPERATORS.map(op => op.value)

// '-8' starts with an operator character but is a number. Only a bare, single
// operator character is an operator — otherwise backspacing a negative result
// leaves a lone '-' that every later keystroke is then parsed against.
function isOperator(token) {
  return token.length === 1 && OPERATOR_VALUES.includes(token)
}

/**
 * Evaluate strictly left to right: 10 + 5 × 2 is 30, not 20. That is how a
 * basic pocket calculator behaves and how you would tally costs on paper.
 *
 * Returns null for division by zero so the caller can show an error rather
 * than a plausible wrong number.
 */
function evaluate(tokens) {
  if (tokens.length === 0) return 0

  // A trailing operator is ignored until its right-hand side is typed.
  const usable = isOperator(tokens[tokens.length - 1]) ? tokens.slice(0, -1) : tokens
  if (usable.length === 0) return 0

  let running = Number(usable[0])
  if (!Number.isFinite(running)) return null

  for (let index = 1; index < usable.length; index += 2) {
    const operator = usable[index]
    const value = Number(usable[index + 1])
    if (!Number.isFinite(value)) return null

    if (operator === '+') running += value
    else if (operator === '-') running -= value
    else if (operator === '*') running *= value
    else if (operator === '/') {
      if (value === 0) return null
      running /= value
    }
  }

  return Number.isFinite(running) ? round2(running) : null
}

export function CalculatorProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [tokens, setTokens] = useState([])

  const pushDigit = useCallback((digit) => {
    setTokens(current => {
      const last = current[current.length - 1]

      if (last === undefined || isOperator(last)) {
        if (digit === '.') return [...current, '0.']
        return [...current, digit]
      }

      // Refuse to grow past what a double can hold exactly.
      if (last.replace(/[^0-9]/g, '').length >= 15) return current

      // One decimal point per number, and no runaway leading zeros.
      if (digit === '.' && last.includes('.')) return current
      if (last === '0' && digit !== '.') return [...current.slice(0, -1), digit]

      return [...current.slice(0, -1), last + digit]
    })
  }, [])

  const pushOperator = useCallback((operator) => {
    setTokens(current => {
      if (current.length === 0) return current
      const last = current[current.length - 1]

      // Replace a trailing operator rather than stacking two.
      if (isOperator(last)) return [...current.slice(0, -1), operator]
      if (last.endsWith('.')) return [...current.slice(0, -1), last.slice(0, -1), operator]

      return [...current, operator]
    })
  }, [])

  const backspace = useCallback(() => {
    setTokens(current => {
      if (current.length === 0) return current
      const last = current[current.length - 1]

      if (isOperator(last)) return current.slice(0, -1)

      // A one-character number, or a sign plus one digit, disappears whole —
      // trimming '-8' to '-' would leave a token that parses as an operator.
      const trimmed = last.slice(0, -1)
      if (trimmed === '' || trimmed === '-') return current.slice(0, -1)

      return [...current.slice(0, -1), trimmed]
    })
  }, [])

  const clear = useCallback(() => setTokens([]), [])

  const result = useMemo(() => evaluate(tokens), [tokens])
  const hasError = result === null
  const total = hasError ? 0 : result

  // Human-readable form: what the display shows, and what gets appended to a
  // transaction's note so the figure stays explainable later.
  const expression = useMemo(() => {
    return tokens
      .map(token => (isOperator(token) ? OPERATORS.find(op => op.value === token).symbol : token))
      .join(' ')
  }, [tokens])

  // Collapse the running result into a fresh starting value.
  const equals = useCallback(() => {
    setTokens(current => {
      if (current.length === 0) return current
      const value = evaluate(current)
      return value === null ? current : [String(value)]
    })
  }, [])

  const value = useMemo(
    () => ({
      open,
      setOpen,
      tokens,
      expression,
      total,
      hasError,
      pushDigit,
      pushOperator,
      backspace,
      clear,
      equals,
      hasInput: tokens.length > 0,
    }),
    [open, tokens, expression, total, hasError, pushDigit, pushOperator, backspace, clear, equals]
  )

  return <CalculatorContext.Provider value={value}>{children}</CalculatorContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCalculator() {
  const context = useContext(CalculatorContext)
  if (!context) {
    throw new Error('useCalculator must be used inside a CalculatorProvider')
  }
  return context
}
