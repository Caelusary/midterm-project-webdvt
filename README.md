# Personal Budget Tracker

A multi-page budget tracker built with React and Vite. Log income and expenses,
categorize them, filter the ledger, view spending breakdowns, and switch between
light and dark themes.

**Live:** _(Not yet deployed)_
**Repo:** https://github.com/Caelusary/midterm-project-webdvt

## Running locally

```bash
npm install
npm run dev

```
## Pages

| Route | Page | What it does |
|---|---|---|
| `/` | Dashboard | Lists all transactions, filters by category and type, shows balance (income − expenses). Each row links to its detail page. |
| `/add` | Add Transaction | Form with validation on required fields. Returns to the Dashboard on success. |
| `/transaction/:id` | Transaction Detail | Full details for one transaction at its own URL. Supports editing and deleting. |
| `/summary` | Summary | Spending broken down by category, sorted by amount, with percentage bars. |

## Required concepts — where each one lives

**React Router** — `src/App.jsx`. All four pages are real routes with distinct
URLs nested under a shared `Layout`, not conditionally-rendered sections. Deep
links work: `/transaction/<id>` loads directly. `vercel.json` rewrites all paths
to `index.html` so this holds in production.

**Context API** — `src/context/ThemeContext.jsx`. Theme state lives in a provider
wrapping the entire router in `App.jsx`. `ThemeToggle` (in the nav) and every page
read it via the `useTheme` hook with zero prop drilling. The toggle is placed in
the nav bar rather than on a single page so it's reachable from all four routes.
Theme is applied by setting `data-theme` on `<html>`; all colors are CSS variables
defined once per theme in `index.css`, so one attribute restyles the whole app.
The choice persists to `localStorage`, and an inline script in `index.html`
applies it before first paint to avoid a flash of the wrong theme.

**Custom hook** — `src/hooks/useTransactions.js`. Handles all reading and writing
of transactions to `localStorage` and exposes `transactions`, `addTransaction`,
`updateTransaction`, and `deleteTransaction`. Reused by all four pages; no storage
logic is duplicated anywhere else. Writes happen synchronously inside the state
updater rather than in an effect, because a component that navigates away on save
unmounts before an effect would run.

**Performance optimization** — `src/components/TransactionRow.jsx` is wrapped in
`React.memo`. Without it, changing either Dashboard filter re-renders every row in
the list even though no row's data changed. With it, React skips rows whose
`transaction` prop is unchanged. Supporting this, `Dashboard.jsx` wraps both the
balance totals and the filtered list in `useMemo`, so totals only recompute when
transactions change — not when a filter moves — and the memoized rows keep stable
prop references.

## Data

Transactions are stored in `localStorage` under `budget-transactions`, each shaped:

```js
{ id, description, amount, type: 'income' | 'expense', category, date, note }
```

Amounts are stored as positive numbers with `type` carrying the sign, which keeps
the balance math and category totals straightforward.

## Known tradeoff

`useTransactions` keeps state per-component, synced through `localStorage`. This
works because only one route is mounted at a time. If two components needed to
display transactions simultaneously, the hook would be promoted to a Context like
the theme.