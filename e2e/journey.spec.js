import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Budgy has no backend: everything is in this browser's localStorage, and each
// Playwright test gets a fresh browser context, so every test starts empty.

/** WCAG 2 A/AA scan that fails on serious or critical violations only. */
async function expectAccessible(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const blocking = results.violations.filter(v => ['serious', 'critical'].includes(v.impact))
  expect(
    blocking.flatMap(v => v.nodes.map(n => `${v.id}: ${n.target.join(' ')} (${n.any[0]?.message ?? ''})`)),
    `axe violations on ${label}`
  ).toEqual([])
}

/** Fails the test on any Content-Security-Policy violation or uncaught error. */
function watchForProblems(page) {
  const problems = []
  page.on('console', message => {
    if (message.type() === 'error' && /Content Security Policy|Refused to/i.test(message.text())) {
      problems.push(message.text())
    }
  })
  page.on('pageerror', error => problems.push(error.message))
  return problems
}

async function noSidewaysScroll(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

async function pick(page, label, option) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function addTransaction(page, { description, amount, type, category }) {
  await page.goto('/add')
  await page.getByLabel('Description').fill(description)
  await page.getByLabel('Amount').fill(String(amount))
  await pick(page, 'Type', type)
  await pick(page, 'Category', category)
  await page.getByRole('button', { name: 'Save transaction' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

function statValue(page, label) {
  return page
    .locator('.stat-card')
    .filter({ has: page.locator('.stat-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('.stat-value')
}

test('empty state on every primary screen', async ({ page }) => {
  const problems = watchForProblems(page)

  await page.goto('/')
  await expect(page.getByText('No transactions yet')).toBeVisible()
  await expect(statValue(page, 'Balance')).toHaveText('₱0.00')
  await expect(page.getByRole('link', { name: 'Add your first one' })).toBeVisible()
  await noSidewaysScroll(page)
  await expectAccessible(page, 'empty dashboard')

  for (const [path, heading] of [
    ['/summary', 'Summary'],
    ['/budgets', 'Budgets'],
    ['/recurring', 'Recurring'],
    ['/activity', 'Activity'],
    ['/settings', 'Settings'],
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    await noSidewaysScroll(page)
    await expectAccessible(page, `empty ${path}`)
  }

  expect(problems).toEqual([])
})

test('the daily journey: add, edit, delete, totals and chart update, persists on reload', async ({ page }) => {
  const problems = watchForProblems(page)

  await page.goto('/add')
  await expectAccessible(page, 'add form')

  // Validation: an empty submit names every missing field.
  await page.getByRole('button', { name: 'Save transaction' }).click()
  await expect(page.getByText('Description is required')).toBeVisible()
  await expect(page.getByText('Amount is required')).toBeVisible()
  await expectAccessible(page, 'add form with errors')

  await addTransaction(page, { description: 'Paycheck', amount: 1000, type: 'Income', category: 'Salary' })
  await addTransaction(page, { description: 'Groceries run', amount: 250.5, type: 'Expense', category: 'Food' })

  await expect(statValue(page, 'Balance')).toHaveText('₱749.50')
  await expect(statValue(page, 'Income')).toHaveText('₱1,000.00')
  await expect(statValue(page, 'Expenses')).toHaveText('₱250.50')
  await expect(page.locator('.ledger-row')).toHaveCount(2)
  await noSidewaysScroll(page)
  await expectAccessible(page, 'dashboard with data')

  // Edit the expense.
  await page.getByRole('link', { name: /Groceries run/ }).click()
  await expect(page.getByRole('heading', { name: 'Groceries run' })).toBeVisible()
  await expectAccessible(page, 'transaction detail')
  await page.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Amount').fill('300')
  await page.getByRole('button', { name: /Save/ }).click()
  await expect(page.getByText('Changes saved.')).toBeVisible()

  await page.goto('/')
  await expect(statValue(page, 'Expenses')).toHaveText('₱300.00')
  await expect(statValue(page, 'Balance')).toHaveText('₱700.00')

  // The chart follows the ledger.
  await page.goto('/summary')
  await expect(page.getByRole('img', { name: 'Spending split across 1 categories' })).toBeVisible()
  await expect(page.locator('.breakdown-item', { hasText: 'Food' })).toContainText('₱300.00')
  await noSidewaysScroll(page)
  await expectAccessible(page, 'summary with data')

  // Delete the income, then reload: what is on screen must be what was saved.
  await page.goto('/')
  await page.getByRole('link', { name: /Paycheck/ }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.locator('.ledger-row')).toHaveCount(1)
  await expect(statValue(page, 'Balance')).toContainText('300.00')
  await expect(statValue(page, 'Balance')).toHaveClass(/is-expense/)

  await page.reload()
  await expect(page.locator('.ledger-row')).toHaveCount(1)
  await expect(page.getByRole('link', { name: /Groceries run/ })).toBeVisible()
  await expect(statValue(page, 'Expenses')).toHaveText('₱300.00')

  expect(problems).toEqual([])
})

test('corrupt storage never blanks the app and the original is set aside', async ({ page }) => {
  const problems = watchForProblems(page)

  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem('budgy:transactions', '{this is not json')
    localStorage.setItem('budgy:settings', '"a string, not an object"')
    localStorage.setItem('budgy:budgets', '[null, 42, {"category": "Food", "monthly_limit": -5}]')
  })
  await page.reload()

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  const notice = page.locator('.storage-notice')
  await expect(notice).toContainText('could not be read and was set aside')
  await expect(page.getByText('No transactions yet')).toBeVisible()
  await expectAccessible(page, 'dashboard with storage notice')

  const recovered = await page.evaluate(() => JSON.parse(localStorage.getItem('budgy:recovered')))
  expect(recovered.transactions).toBe('{this is not json')

  // The app keeps working on top of the repaired storage.
  await notice.getByRole('button', { name: 'Dismiss' }).click()
  await expect(notice).toHaveCount(0)
  await addTransaction(page, { description: 'Coffee', amount: 90, type: 'Expense', category: 'Food' })
  await page.reload()
  await expect(page.getByRole('link', { name: /Coffee/ })).toBeVisible()
  await expect(page.locator('.storage-notice')).toHaveCount(0)

  expect(problems).toEqual([])
})

test('old-format and half-broken rows: the good ones still load', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.setItem(
      'budgy:transactions',
      JSON.stringify([
        { id: '1', description: 'Old format', amount: '1,500', kind: 'income', category: 'Salary', date: '2026-01-05T09:00:00Z' },
        { id: '2', description: 'Fine', amount: 40, type: 'expense', category: 'Food', date: '2026-01-06' },
        { id: '3', description: 'No amount', type: 'expense', date: '2026-01-07' },
        'garbage',
      ])
    )
  })
  await page.reload()

  await expect(page.locator('.ledger-row')).toHaveCount(2)
  await expect(statValue(page, 'Balance')).toHaveText('₱1,460.00')
  await expect(page.locator('.storage-notice')).toBeVisible()
})

test('backup download and restore round-trips the whole ledger', async ({ page }) => {
  await addTransaction(page, { description: 'Bonus', amount: 2000, type: 'Income', category: 'Gift' })
  await addTransaction(page, { description: 'Jeepney', amount: 13, type: 'Expense', category: 'Transport' })

  await page.goto('/settings')
  await expectAccessible(page, 'settings with data')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^budgy-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const backupPath = await download.path()
  const backup = JSON.parse(await readFile(backupPath, 'utf-8'))
  expect(backup.app).toBe('budgy')
  expect(backup.transactions).toHaveLength(2)

  // Simulate clearing the browser.
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.goto('/')
  await expect(page.getByText('No transactions yet')).toBeVisible()

  // A bad file is refused with a reason, and nothing changes.
  await page.goto('/settings')
  await page.getByTestId('backup-file').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello": "world"}'),
  })
  await expect(page.getByRole('alert')).toHaveText('That file is not a Budgy backup.')

  await page.getByTestId('backup-file').setInputFiles(backupPath)
  await expect(page.getByText(/Replace your 0 transactions with the 2 in/)).toBeVisible()
  await expectAccessible(page, 'restore confirmation')
  await page.getByRole('button', { name: 'Replace my data' }).click()
  await expect(page.getByText('Restored 2 transactions from the backup.')).toBeVisible()

  await page.goto('/')
  await expect(page.locator('.ledger-row')).toHaveCount(2)
  await expect(statValue(page, 'Balance')).toHaveText('₱1,987.00')
  await page.reload()
  await expect(page.locator('.ledger-row')).toHaveCount(2)
})

test('nothing scrolls sideways at 375px, with data and with the storage notice', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone-width check')
  await page.setViewportSize({ width: 375, height: 812 })
  await addTransaction(page, {
    description: 'A rather long description that has to wrap on a small phone screen',
    amount: 123456789.99,
    type: 'Expense',
    category: 'Load & Internet',
  })
  await page.evaluate(() => localStorage.setItem('budgy:rules', '"broken"'))
  await page.reload()
  await expect(page.locator('.storage-notice')).toBeVisible()

  for (const path of ['/', '/add', '/summary', '/budgets', '/recurring', '/activity', '/settings']) {
    await page.goto(path)
    await expect(page.locator('h1')).toBeVisible()
    await noSidewaysScroll(page)
  }
})
