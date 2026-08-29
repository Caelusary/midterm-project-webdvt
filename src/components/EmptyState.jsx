const ICONS = {
  ledger: <><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h8M8 17h4" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  repeat: <><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  missing: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" /></>,
}

export default function EmptyState({ icon = 'ledger', title, children }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round">
          {ICONS[icon] ?? ICONS.ledger}
        </svg>
      </span>
      <p className="empty-title">{title}</p>
      {children}
    </div>
  )
}
