import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider ({ children }) {
    const [theme, setTheme] = useState (() => localStorage.getItem('budget-theme') || 'light')
    
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme) 
        localStorage.setItem('budget-theme', theme)
    }, [theme])

    const toggleTheme = useCallback(() => {
        setTheme(current => (current === 'light' ? 'dark' : 'light'))
    }, [])

    const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-dsiable-next-line react-refresh/only-export-components
export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used inside a ThemeProvider')
    } 
    return context
}