# Budgy — your budgeting buddy

A multi-page personal budget tracker built with React and Vite, storing
everything in your browser. Log income and expenses, set a monthly limit for
every spending category, automate recurring entries, see where your money
actually goes, and watch a bamboo stalk fill as you approach a savings goal.

There are no accounts and no server: the app is static files, and the ledger
lives in `localStorage` on whichever device you opened it on.

**Live:** https://midterm-project-webdvt-two.vercel.app/
**Repo:** https://github.com/Caelusary/midterm-project-webdvt

## Running locally

Requires Node 20.19+ (or 22.12+). No configuration, no environment variables,
no database to provision.

```bash
npm install
```

```bash
npm run dev
```

## Pages

| Route | Page | What it does |
|---|---|---|
| `/` | Dashboard | Balance, income and expenses for the selected month, savings goal with the bamboo, searchable and sortable transaction list, over-budget warnings |
| `/add` | Add Transaction | Validated form, with a live preview, projected balance, and remaining budget for the chosen category |
| `/transaction/:id` | Transaction Detail | Full details at its own URL; edit, duplicate, or delete with undo |
| `/summary` | Summary | Spending by category as a donut and a ranked breakdown, with month-over-month change, plus the light/dark theme toggle |
| `/budgets` | Budgets | A monthly limit for each of the twelve expense categories |
| `/recurring` | Recurring | Rules that post themselves monthly or on chosen weekdays |
| `/activity` | Activity | Everything you have changed, and a way back from deletions |
| `/settings` | Settings | Theme, currency, CSV export |

## Required concepts — where each one lives

**React Router** — [`src/App.jsx`](src/App.jsx). Eight routes with distinct
URLs, not conditionally-rendered sections, nested inside a `Layout` route that
supplies the sidebar. Deep links work: pasting `/transaction/<id>` loads that
transaction directly, and `vercel.json` rewrites every path to `index.html` so
this survives a hard refresh in production.

**Context API** — four providers, composed in `App.jsx`:

- [`ThemeContext`](src/context/ThemeContext.jsx) — light/dark, applied by setting
  `data-theme` on `<html>`. Every colour in [`index.css`](src/index.css) is a CSS
  variable declared twice, so one attribute restyles the whole app. The choice
  persists to `localStorage`, and an inline script in `index.html` applies it
  before first paint to avoid a flash of the wrong theme.
- [`DataContext`](src/context/DataContext.jsx) — transactions, settings, budgets
  and recurring rules, loaded once per page load.
- [`ToastContext`](src/context/ToastContext.jsx) — notifications, including the
  undo action after a delete.
- [`CalculatorContext`](src/context/CalculatorContext.jsx) — the floating
  calculator's state, which persists as you navigate.

Nothing is prop-drilled; the deepest prop chain in the app is a single callback
from `Layout` to `Sidebar`.

**Custom hook** — [`src/hooks/useTransactions.js`](src/hooks/useTransactions.js)
handles all reading and writing of transactions to persistent storage, exposing
`transactions`, `error`, `addTransaction`, `updateTransaction`,
`deleteTransaction` and `restoreTransaction`. Every page that touches
transactions uses it; no page touches storage directly and no persistence logic
is duplicated anywhere. It reads from `DataContext`, so one load serves every
page rather than each route re-reading on navigation. Sibling hooks follow the
same shape: [`useSettings`](src/hooks/useSettings.js),
[`useBudgets`](src/hooks/useBudgets.js),
[`useRecurring`](src/hooks/useRecurring.js).

**Performance optimization** —
[`src/components/TransactionRow.jsx`](src/components/TransactionRow.jsx) is
wrapped in `React.memo`. Without it, every keystroke in the search box and every
filter change re-renders all 25 visible rows even though no row's data changed.
Supporting it, [`Dashboard.jsx`](src/pages/Dashboard.jsx) wraps the period
filter, the totals, the filtered-and-sorted list and the over-budget check in
`useMemo`, and the `format` function the rows receive is `useCallback`-stable in
`useSettings` — an unstable function prop would silently defeat the memo.

Two further optimizations worth noting: `Intl` formatters are constructed once
and cached in [`src/lib/format.js`](src/lib/format.js) rather than per call
(measured at ~22µs and ~85µs to construct versus under 1µs to reuse, which is
roughly 12ms per render on a mid-range phone), and the ledger paginates at 25
rows with a "load more".

Route-level code splitting was considered and rejected: what is left of the
bundle is essentially React and React Router, both of which load on the first
screen regardless, so splitting buys little for the cost of a loading flash on
every navigation.

## Data

Five keys in `localStorage`, all namespaced under `budgy:`. See
[`src/lib/storage.js`](src/lib/storage.js).

| Key | Holds |
|---|---|
| `budgy:transactions` | `{ id, description, amount, type, category, date, note, recurring_rule_id, created_at }` |
| `budgy:settings` | Savings goal and display currency |
| `budgy:budgets` | Monthly limit per category |
| `budgy:rules` | Description, amount, type, category, schedule, and a `last_created_on` watermark |
| `budgy:activity` | The change log, newest first, capped at 200 entries |

Every read is defensive: a missing key, a browser blocking site data, or
hand-edited JSON all fall back to empty rather than taking the app down. Every
write returns an error message or `null`, and a mutation only updates React
state once the write has actually landed — so what is on screen is always what
was saved.

Amounts are stored positive with `type` carrying the sign, which keeps the
balance math and category totals straightforward. Money is compared in integer
cents ([`src/lib/money.js`](src/lib/money.js)) — summing two-decimal floats
produced totals like `500.00000000000006`, which read as over budget and
rendered "Over by ₱0.00".

Dates are plain `YYYY-MM-DD` strings and are always parsed from their parts, never
via `new Date('2026-08-07')`, which would be read as UTC midnight and render as
the previous day in a negative-offset timezone.

## Recurring rules

Rules post either monthly on a chosen day (1–31, clamping to the last real day
so a "31st" rule still fires in February) or weekly on chosen weekdays. On load
the app posts anything that came due while you were away.

The catch-up is idempotent: generated rows carry a `recurring_rule_id`, and any
`(rule, date)` pair already present in the ledger is skipped, so a replay is a
no-op rather than a duplicate. It runs exactly once per page load, before the
first render, rather than in an effect — storage is synchronous, so there is
nothing to wait for and no second render pass to pay for.

Transactions are written before the watermark advances. Failing between the two
means the next load simply retries, which the deduplication makes harmless; the
reverse order would skip a month forever.

Pausing a rule and resuming it later advances the watermark to the resume date,
so a rule paused in January and resumed in August posts from August rather than
silently back-filling seven months.

## Privacy and security

There is no account, no server, and no network request carrying your data
anywhere. Everything is written to `localStorage` on the device you are using,
which has straightforward consequences worth stating plainly:

- Anyone with access to the browser profile can read the ledger. There is no
  password on it, because there is nothing to authenticate against.
- Clearing site data clears the ledger with it. The CSV export on the Settings
  page is the way to keep a copy.
- Nothing syncs. A second browser, or a second device, starts empty.

`vercel.json` sets a Content Security Policy, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` and `frame-ancestors 'none'`. With no
backend, `connect-src` is `'self'` — the deployed app makes no cross-origin
requests at all beyond the Google Fonts stylesheet.

CSV export escapes fields per RFC 4180 and neutralises leading `=`, `+`, `-` and
`@` so a description cannot execute as a formula in a spreadsheet.

`npm audit` reports an advisory against `react-router` for an RSC-mode CSRF
bypass. It is not reachable here — this app uses `BrowserRouter` with no RSC, no
server actions and no server — and the suggested remedy is a breaking downgrade,
so it is deliberately not applied.

## Known limitations

Changing the display currency changes the symbol and number formatting only;
existing amounts are not converted, since real conversion would need a rates API
and a stored base currency.

The activity log keeps the most recent 200 entries. It shares a roughly 5MB
storage budget with the ledger itself, and a deletion snapshot is a whole
transaction row, so it is capped rather than unbounded.

If storage is full or unavailable — a browser configured to block site data, or
Safari's private mode — writes fail with a message saying so, rather than
appearing to succeed and vanishing on reload.

## Deploying

Import the repository on Vercel. It detects Vite automatically, and there is
nothing to configure: no environment variables, no external services, no
runtime. `vercel.json` handles the SPA rewrite and the security headers.
