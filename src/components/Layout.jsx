import { NavLink, Outlet } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

export default function Layout() {
    return (
        <>
            <header className="nav">
                <span className="brand">Budget Tracker</span>
                <nav>
                    <NavLink to="/" end>Dashboard</NavLink>
                    <NavLink to="/add">Add</NavLink>
                    <NavLink to="/summary">Summary</NavLink>
                    <ThemeToggle />
                </nav>
            </header>
            <main className="page">
                <Outlet />
            </main>
        </>
    )
}