import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

/**
 * Light/dark for the whole app, kept in one place so no component has to pass
 * a theme prop down to reach the toggle.
 *
 * This is the one module that touches localStorage directly instead of going
 * through lib/storage.js, and the key is deliberately un-prefixed. The inline
 * script in index.html reads the same raw key before the first paint so a dark
 * user never sees a white flash — it runs before any module loads, so it can't
 * import a helper, and both sides have to agree on the exact key and format.
 *
 * Both accesses are guarded: a browser set to block site data throws on
 * localStorage, and losing the theme is not a reason to fail to boot.
 */
const STORAGE_KEY = 'budget-theme'

function storedTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(storedTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Preference won't survive the session. The app still works.
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(current => (current === 'light' ? 'dark' : 'light'))
  }, [])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider')
  }
  return context
}
