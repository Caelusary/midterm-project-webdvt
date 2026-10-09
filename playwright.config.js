import { defineConfig, devices } from '@playwright/test'

// The daily journey against the production build (vite preview), on a phone
// and on desktop, since the layout switches to a drawer below 768px.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5948',
    // Animations off so axe never measures colours mid-fade.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 5948 --strictPort',
    url: 'http://localhost:5948',
    // Never reuse: another local project on the same port would answer the tests.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
