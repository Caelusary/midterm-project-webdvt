# Budgy — your budgeting buddy

A multi-page personal budget tracker built with React and Vite, storing
everything in your browser. Log income and expenses, set a monthly limit for
every spending category, automate recurring entries, see where your money
actually goes, and watch a bamboo stalk fill as you approach a savings goal.

There are no accounts and no server: the app is static files, and the ledger
lives in `localStorage` on whichever device you opened it on.

**Live:** https://midterm-project-webdvt-two.vercel.app/
**Repo:** https://github.com/Caelusary/midterm-project-webdvt

> Preparing for the oral defence? [**QA.md**](QA.md) has likely questions and
> worked answers, including the follow-ups behind the obvious ones.

## Running locally

Requires Node 20.19+ (or 22.12+). No configuration, no environment variables,
no database to provision.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

## Pages

| Route | Page | What it does |
|---|---|---|
| `/` | Dashboard | Lifetime balance, plus income and expenses for the selected month, savings goal with the bamboo, searchable and sortable transaction list, over-budget warnings |
| `/add` | Add Transaction | Validated form, with a live preview, projected balance, and remaining budget for the chosen category |
| `/transaction/:id` | Transaction Detail | Full details at its own URL; edit, duplicate, or delete with undo |
| `/summary` | Summary | Spending by category as a donut and a ranked breakdown, with month-over-month change, plus the light/dark theme toggle |
| `/budgets` | Budgets | A monthly limit for each of the twelve expense categories |
| `/recurring` | Recurring | Rules that post themselves monthly or on chosen weekdays |
| `/activity` | Activity | Everything you have changed, and a way back from deletions |
| `/settings` | Settings | Theme, currency, CSV export |

## Required concepts — where each one lives

### React Router

Eight routes with their own URLs, defined in [`src/App.jsx`](src/App.jsx) and
nested inside a `Layout` route that supplies the sidebar.

The test for whether these are *real* routes rather than tabs: paste
`/summary` straight into the address bar and it loads. A conditionally-rendered
section has no URL to paste. `/transaction/:id` takes the id from the URL, so
deep links to a single transaction work too, and `vercel.json` rewrites every
path to `index.html` so this holds on the deployed site and not just locally.

### Context API

Four providers, composed in `App.jsx`:

- [`ThemeContext`](src/context/ThemeContext.jsx) — light/dark
- [`DataContext`](src/context/DataContext.jsx) — transactions, settings, budgets
  and recurring rules, loaded once per page load
- [`ToastContext`](src/context/ToastContext.jsx) — notifications, including undo
  after a delete
- [`CalculatorContext`](src/context/CalculatorContext.jsx) — the floating
  calculator, which keeps its state as you navigate

The theme is the one the brief asks about. The toggle sits on Summary and
Settings, but the theme has to reach every page — passing it down as a prop
would mean `Layout`, `Sidebar` and every page accepting a prop most of them
don't use, purely to hand it further down. That is prop drilling, and Context
avoids it: any component calls `useTheme()` and gets the value directly.

Applying it is one line of state and no re-styling: the provider sets
`data-theme` on `<html>`, and every colour in [`index.css`](src/index.css) is a
CSS variable declared twice, once per theme. An inline script in `index.html`
reads the saved choice before the first paint, so a dark-mode user never sees a
white flash while React boots.

Nothing is prop-drilled; the deepest prop chain in the app is a single callback
from `Layout` to `Sidebar`.

### Custom hook

[`src/hooks/useTransactions.js`](src/hooks/useTransactions.js) handles all
reading and writing of transactions, exposing `transactions`, `error`,
`addTransaction`, `updateTransaction`, `deleteTransaction` and
`restoreTransaction`.

Reusable here means **no page contains storage logic**. Dashboard, Add, Detail
and Summary all call this one hook, so a fix to how saving works happens in one
place instead of four. It reads from `DataContext`, so one load serves every
page rather than each route re-reading on navigation.

Sibling hooks follow the same shape: [`useSettings`](src/hooks/useSettings.js),
[`useBudgets`](src/hooks/useBudgets.js),
[`useRecurring`](src/hooks/useRecurring.js).

### Performance optimization

[`src/components/TransactionRow.jsx`](src/components/TransactionRow.jsx) is
wrapped in `React.memo`.

When a parent re-renders, React re-renders its children by default. The
Dashboard re-renders on things that have nothing to do with the rows — every
keystroke in the search box, every keystroke in the savings-goal field — so
without `memo` all 25 visible rows re-run for a change that affected none of
them. `memo` skips a component whose props haven't changed.

**What makes it actually work** is that both props keep their identity between
renders. `memo` compares props by reference, so an unstable prop defeats it
silently:

- `transaction` — re-sorting copies the array without rebuilding the objects
  inside, so untouched rows stay the same object.
- `format` — wrapped in `useCallback` in
  [`useSettings`](src/hooks/useSettings.js), so it is the same function every
  render unless the currency changes. Passing `format={a => format(a)}` inline
  would create a new function each render and the memo would do nothing.

Supporting it, [`Dashboard.jsx`](src/pages/Dashboard.jsx) wraps the period
filter, the totals, the filtered-and-sorted list and the over-budget check in
`useMemo`.

A second optimization of a different kind: the search box uses
`useDeferredValue`, so filtering and sorting the whole ledger no longer blocks
the keystroke — the input updates immediately and the list catches up. `memo`
avoids work; `useDeferredValue` reorders it.

Two more worth noting: `Intl` formatters are constructed once and cached in
[`src/lib/format.js`](src/lib/format.js) rather than per call, and the ledger
paginates at 25 rows with a "load more".

Route-level code splitting was considered and rejected: what is left of the
bundle is essentially React and React Router, both of which load on the first
screen regardless, so splitting buys little for the cost of a loading flash on
every navigation.

## Tests

```bash
npm test
```

29 tests across four files, run with Vitest. They cover the pure logic, which is
where the edge cases live and where tests are cheapest — no DOM and no React
required:

| File | Covers |
|---|---|
| [`money.test.js`](src/lib/money.test.js) | the floating-point problem, including the exact case that rendered "Over by ₱0.00" |
| [`period.test.js`](src/lib/period.test.js) | month-end clamping, schedule start and end bounds, year rollover |
| [`validateTransaction.test.js`](src/lib/validateTransaction.test.js) | required fields, amount and date bounds, all errors reported at once |
| [`recurring.test.js`](src/lib/recurring.test.js) | catch-up generation, deduplication, watermarks |

One of these is a regression guard for a real bug: newly created recurring
rules were silently paused and posted nothing. Fixing it meant moving rule
creation into `newRule()` in [`recurring.js`](src/lib/recurring.js), where a
test could reach it — the test fails if the bug is reintroduced.

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
hand-edited JSON all fall back to empty rather than taking the app down. Reads
also check the *shape* of what came back, not just that it parsed — a stored
value of the wrong type would otherwise crash during startup, where the error
screen's own Reload button could not recover from it.

Every write returns an error message or `null`, and a mutation only updates
React state once the write has actually landed — so what is on screen is always
what was saved.

Amounts are stored positive with `type` carrying the sign, which keeps the
balance math and category totals straightforward. Money is compared in integer
cents ([`src/lib/money.js`](src/lib/money.js)) — summing two-decimal floats
produced totals like `500.00000000000006`, which read as over budget and
rendered "Over by ₱0.00".

Dates are plain `YYYY-MM-DD` strings and are always parsed from their parts, never
via `new Date('2026-08-07')`, which would be read as UTC midnight and render as
the previous day in a negative-offset timezone.

## Reading the interface

The app applies one rule everywhere: **the arrow shows which way the number
moved, and the colour says whether that is good for you.** Income points up in
green because it raises your balance; an expense points down in red. On the
Summary page, spending higher than last month points up in *red* — the number
rose, and that is not good news. The arrow reports direction, the colour reports
judgement.

The period bar opens on the current month, because budgets are monthly limits
and the Summary compares one month against the previous one. "All time" is one
click away, and the Balance figure is always lifetime regardless of the period.

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
- Nothing syncs. A second browser, or a second device, starts empty. Two tabs of
  the same browser do not sync either — the later save wins.

`vercel.json` sets a Content Security Policy, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` and `frame-ancestors 'none'`. With no
backend, `connect-src` is `'self'` — the deployed app makes no cross-origin
requests at all beyond the Google Fonts stylesheet.

CSV export escapes fields per RFC 4180 and neutralises leading `=`, `+`, `-` and
`@` so a description cannot execute as a formula in a spreadsheet.

`npm audit` reports one high-severity advisory against `nanoid`, reached through
`vite` → `postcss`. It is a build-time dependency and never ships to the
browser, so it cannot affect anyone using the deployed app.

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
