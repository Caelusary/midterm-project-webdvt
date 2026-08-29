import { ALL_TIME, currentMonth, formatMonth, shiftMonth } from '../lib/period'

/**
 * Month stepper with an all-time escape hatch, plus room on the right for a
 * figure — so the bar carries information rather than only controls.
 *
 * Stepping forward stops at this month, or at `furthestMonth` when something
 * is dated later than that.
 */
export default function PeriodPicker({ period, onChange, furthestMonth, children }) {
  const isAll = period === ALL_TIME
  const nextMonth = isAll ? null : shiftMonth(period, 1)

  // Normally there is nothing past this month to look at, but a transaction
  // dated ahead of today has to stay reachable — otherwise it counts toward
  // the balance from a month the stepper refuses to visit.
  const lastMonth =
    furthestMonth && furthestMonth > currentMonth() ? furthestMonth : currentMonth()
  const canGoForward = !isAll && nextMonth <= lastMonth

  return (
    <div className="period-bar">
      <div className="period-picker">
        <button type="button" className="period-step" aria-label="Previous month" disabled={isAll}
          onClick={() => onChange(shiftMonth(period, -1))}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>

        <span className="period-label">{formatMonth(period)}</span>

        <button type="button" className="period-step" aria-label="Next month" disabled={!canGoForward}
          onClick={() => onChange(nextMonth)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <span className="period-divider" aria-hidden="true" />

        <button type="button" className="period-scope" aria-pressed={isAll}
          onClick={() => onChange(isAll ? currentMonth() : ALL_TIME)}>
          {isAll ? 'Viewing all time' : 'All time'}
        </button>
      </div>

      {children && <div className="period-figures">{children}</div>}
    </div>
  )
}
