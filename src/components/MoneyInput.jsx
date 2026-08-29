import { useSettings } from '../hooks/useSettings'
import { currencySymbol } from '../lib/format'

/**
 * A number input with the active currency symbol attached.
 *
 * Every money field in the app goes through here, so the prefix markup, the
 * numeric defaults and the scroll guard cannot drift apart between pages. The
 * guard is the part worth centralising: without it a scroll over a focused
 * number input silently changes the amount, and it is easy to forget on a
 * fifth copy.
 *
 * onChange receives the raw string, not the event — callers store the draft as
 * typed and validate it later, so none of them wanted the event anyway.
 */
export default function MoneyInput({ value, onChange, min = '0', step = '0.01', ...rest }) {
  const { currency } = useSettings()

  return (
    <div className="input-prefix">
      <span>{currencySymbol(currency)}</span>
      <input type="number" min={min} step={step} value={value}
        onWheel={event => event.currentTarget.blur()}
        onChange={event => onChange(event.target.value)}
        {...rest} />
    </div>
  )
}
