import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import CalculatorWidget from './CalculatorWidget'

const MOBILE_QUERY = '(max-width: 768px)'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  const location = useLocation()
  const [lastPath, setLastPath] = useState(location.pathname)

  const menuButtonRef = useRef(null)
  const sidebarRef = useRef(null)
  const wasOpen = useRef(false)

  // Close the mobile drawer whenever the route changes — including via the
  // browser's back button. Adjusting state during render rather than in an
  // effect avoids a second render pass with the drawer still open.
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname)
    setMenuOpen(false)
  }

  // Widening past the breakpoint turns the drawer back into a static rail, so
  // the "open" state — and its focus trap — must not survive the change.
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    function onChange(event) {
      setIsMobile(event.matches)
      if (!event.matches) setMenuOpen(false)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  /**
   * While the drawer is open it behaves as a modal dialog: the keyboard moves
   * into it, Tab cycles within it rather than escaping to the page underneath,
   * and Escape closes it. Without this a keyboard user opens the menu and then
   * tabs blindly through content hidden behind the scrim.
   */
  useEffect(() => {
    if (!menuOpen) return
    const container = sidebarRef.current
    if (!container) return

    const items = () => Array.from(container.querySelectorAll(FOCUSABLE))
    items()[0]?.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = items()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  // Hand the keyboard back to the button that opened the drawer, so closing it
  // returns you where you were rather than to the top of the document.
  useEffect(() => {
    if (wasOpen.current && !menuOpen) menuButtonRef.current?.focus()
    wasOpen.current = menuOpen
  }, [menuOpen])

  const drawerOpen = menuOpen && isMobile

  return (
    <div className={`shell${menuOpen ? ' is-menu-open' : ''}`}>
      <header className="topbar">
        <button type="button" className="icon-button" ref={menuButtonRef}
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="sidebar-nav">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <span className="topbar-title">Budgy</span>
      </header>

      <aside
        className="sidebar"
        id="sidebar-nav"
        ref={sidebarRef}
        role={drawerOpen ? 'dialog' : undefined}
        aria-modal={drawerOpen ? 'true' : undefined}
        aria-label={drawerOpen ? 'Navigation' : undefined}
      >
        <Sidebar onNavigate={() => setMenuOpen(false)} />
      </aside>

      <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      {/* Keyed on the path so React remounts it per route, which restarts the
          entrance animation. Hidden from assistive tech while the drawer is
          open — the keyboard has already been moved out of it by then. */}
      <main className="content" aria-hidden={drawerOpen || undefined}>
        {/* Keyed on location.key, not pathname: navigating to the page you
            are already on is still a new navigation, and pages that read
            location.state on mount (the Add form's duplicate prefill) have to
            remount for that state to clear. */}
        <div className="page-enter" key={location.key}>
          <Outlet />
        </div>
      </main>

      <CalculatorWidget />
    </div>
  )
}
