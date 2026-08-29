/**
 * Bamboo stalk that fills from the bottom as savings approach the goal.
 *
 * Two identical stalks are stacked: a muted one underneath and a green one on
 * top, revealed by clip-path. Clipping repaints without reflowing, so the
 * growth transition stays smooth — animating height instead would relayout the
 * card on every frame.
 */
export default function Bamboo({ progress = 0 }) {
  const clamped = Math.max(0, Math.min(1, progress))
  const hiddenFromTop = `${Math.round((1 - clamped) * 100)}%`

  return (
    <div className="bamboo" aria-hidden="true">
      <Stalk className="bamboo-track" />
      <Stalk className="bamboo-fill" style={{ clipPath: `inset(${hiddenFromTop} 0 0 0)` }} />
    </div>
  )
}

function Stalk({ className, style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 80 240" preserveAspectRatio="none"
      focusable="false">
      {/* culm */}
      <rect x="32" y="8" width="16" height="226" rx="8" />

      {/* nodes */}
      <rect x="29" y="58" width="22" height="5" rx="2.5" />
      <rect x="29" y="110" width="22" height="5" rx="2.5" />
      <rect x="29" y="162" width="22" height="5" rx="2.5" />

      {/* leaves */}
      <path d="M32 46c-10-4-18-12-20-22 11-1 21 4 25 13z" />
      <path d="M48 96c10-4 18-12 20-22-11-1-21 4-25 13z" />
      <path d="M32 150c-10-4-18-12-20-22 11-1 21 4 25 13z" />
      <path d="M48 200c10-4 18-12 20-22-11-1-21 4-25 13z" />
    </svg>
  )
}
