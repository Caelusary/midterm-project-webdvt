import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The production security headers live in vercel.json. `vite preview` serves
// the same ones, so the e2e suite runs under the real Content-Security-Policy
// and a policy that blocks something the app needs fails a test, not a deploy.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf-8'))
const securityHeaders = Object.fromEntries(
  vercel.headers
    .find(rule => rule.source === '/(.*)')
    .headers.map(({ key, value }) => [key, value])
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: { headers: securityHeaders },
  // Vitest runs the unit tests under src/; e2e/ belongs to Playwright.
  test: { include: ['src/**/*.test.{js,jsx}'] },
  build: {
    // Fonts stay files: inlined as data: URIs they would need font-src data:
    // in the CSP, and they would be re-downloaded inside every CSS change.
    assetsInlineLimit: filePath => (/\.woff2?$/.test(filePath) ? false : undefined),
  },
})
