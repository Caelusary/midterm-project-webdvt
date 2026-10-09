// Applies the saved theme before first paint so dark mode never flashes light.
// A separate file rather than an inline script, so the Content-Security-Policy
// can forbid inline scripts outright. Wrapped because storage can be blocked.
try {
  if (localStorage.getItem('budget-theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
} catch {
  // Blocked storage just means the default light theme.
}
