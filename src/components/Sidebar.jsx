import { NavLink } from 'react-router-dom'
import Panda from './Panda'

const LINKS = [
  {
    to: '/',
    label: 'Dashboard',
    end: true,
    icon: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  },
  { to: '/add', label: 'Add', icon: <path d="M12 5v14M5 12h14" /> },
  { to: '/summary', label: 'Summary', icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  {
    to: '/budgets',
    label: 'Budgets',
    icon: <><path d="M3 7h18v12H3z" /><path d="M3 11h18" /><path d="M8 7V4h8v3" /></>,
  },
  {
    to: '/recurring',
    label: 'Recurring',
    icon: <><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></>,
  },
  {
    to: '/activity',
    label: 'Activity',
    icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  },
]

// Settings rather than navigation, so it sits in its own section below the rule.
const SETTINGS_LINK = {
  to: '/settings',
  label: 'Settings',
  icon: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
}

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export default function Sidebar({ onNavigate }) {
  return (
    <div className="sidebar-inner">
      <div className="brand">
        <Panda size={52} />
        <div>
          <span className="brand-name">Budgy</span>
          <span className="brand-sub">Your budgeting buddy</span>
        </div>
      </div>

      <hr className="sidebar-rule" />

      <nav className="sidebar-nav">
        {LINKS.map(link => (
          <NavLink key={link.to} to={link.to} end={link.end} onClick={onNavigate}
            className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
            <Icon>{link.icon}</Icon>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-tail">
        <hr className="sidebar-rule" />
        <NavLink to={SETTINGS_LINK.to} onClick={onNavigate}
          className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
          <Icon>{SETTINGS_LINK.icon}</Icon>
          {SETTINGS_LINK.label}
        </NavLink>
      </div>
    </div>
  )
}
