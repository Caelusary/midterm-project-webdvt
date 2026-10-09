import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted rather than from Google Fonts: no render-blocking third-party
// request, works offline, and the CSP needs no outside hosts.
import '@fontsource-variable/plus-jakarta-sans'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
