import { categoryColor } from '../lib/format'

/**
 * Donut built from stroke-dasharray on concentric circles — no charting
 * library, and it inherits theme colours like everything else.
 *
 * Arc lengths come from the raw values rather than the rounded percentages
 * shown in the legend, so the ring always closes exactly instead of leaving a
 * hairline gap when the rounded figures sum to 99 or 101.
 *
 * slices: array of { label, value }
 */
export default function DonutChart({ slices, total, centerLabel, centerValue, size = 208 }) {
  const thickness = 28
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const safeTotal = total > 0 ? total : 1

  // Offsets are resolved up front rather than accumulated inside the map, so
  // nothing is being reassigned while React walks the tree.
  const segments = []
  for (const slice of slices) {
    const length = (slice.value / safeTotal) * circumference
    const previous = segments[segments.length - 1]
    segments.push({
      label: slice.label,
      length,
      offset: previous ? previous.offset + previous.length : 0,
    })
  }

  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img"
        aria-label={`Spending split across ${slices.length} categories`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={thickness}
          className="donut-track" />

        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((segment, index) => (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={thickness}
              stroke={categoryColor(index)}
              strokeDasharray={`${segment.length} ${circumference - segment.length}`}
              strokeDashoffset={-segment.offset}
            >
              <title>{segment.label}</title>
            </circle>
          ))}
        </g>
      </svg>

      <div className="donut-center">
        <span className="donut-center-label">{centerLabel}</span>
        <span className="donut-center-value">{centerValue}</span>
      </div>
    </div>
  )
}
