# Q&A prep

Questions a marker is likely to ask, and honest answers. Grouped by how likely
they are to come up.

---

## 1. The four required concepts

### "Show me your routes. Why are these real routes?"

They're in [`src/App.jsx`](src/App.jsx). Every page is a `<Route>` with its own
path, nested inside a `Layout` route that draws the sidebar:

| URL | Page |
|---|---|
| `/` | Dashboard |
| `/add` | Add Transaction |
| `/transaction/:id` | Transaction Detail |
| `/summary` | Summary |
| `/budgets`, `/recurring`, `/activity`, `/settings` | extra pages |
| `*` | "Page not found" |

The proof they're real routes and not tabs: **paste `/summary` straight into
the address bar and it loads.** A conditionally-rendered section can't do that,
because there'd be no URL to paste. `vercel.json` rewrites every path back to
`index.html` so this works on the deployed site too, not just locally.

`:id` is a URL parameter. `/transaction/abc` puts `abc` into `useParams()`, and
the page looks that transaction up.

### "Why did the theme need Context?"

The toggle lives on the Summary and Settings pages, but the theme has to affect
every page. Without Context I'd have to pass `theme` from the top of the app
down through `Layout`, `Sidebar`, and every page — components that don't care
about the theme would still have to accept the prop and pass it along. That's
prop drilling.

Context lets any component ask for the value directly.
[`ThemeContext.jsx`](src/context/ThemeContext.jsx) holds the state, and
`useTheme()` reads it. The deepest prop chain left in the app is one callback
from `Layout` to `Sidebar`.

**How the theme actually applies:** the provider sets `data-theme="dark"` on the
`<html>` element. Every colour in `index.css` is a CSS variable declared twice —
once for light, once under `[data-theme="dark"]`. So one attribute restyles the
whole app, no component re-styling itself.

### "Which is your custom hook, and what makes it reusable?"

[`useTransactions()`](src/hooks/useTransactions.js). It returns the transaction
list plus `addTransaction`, `updateTransaction`, `deleteTransaction` and
`restoreTransaction`.

Reusable means **no page contains storage logic**. Dashboard, Add, Detail and
Summary all call this one hook. If I'd copy-pasted `localStorage.getItem` into
each page, fixing a save bug would mean fixing it four times.

A custom hook is just a function starting with `use` that calls other hooks. It
isn't a component and renders nothing — it packages logic so components can
share it.

### "Show me your performance optimization."

[`TransactionRow.jsx`](src/components/TransactionRow.jsx) ends with
`export default memo(TransactionRow)`.

**The problem:** the Dashboard re-renders on state that has nothing to do with
the rows — every keystroke in the search box, every keystroke in the savings
goal field. By default React re-renders all child components when a parent
re-renders, so all 25 visible rows would re-run for a keystroke that didn't
change any of them.

`memo` tells React: if this component's props are the same as last time, skip
it.

**The best way to demo it** is the savings-goal input, not the search box. Type
in the goal field and *100%* of the rows are skipped, because `goalDraft` isn't
used to build the list at all. With the search box, some rows genuinely have to
re-render because the filter result changed — a weaker demonstration.

---

## 2. The follow-up you will definitely get

### "Why doesn't `memo` break here?"

This is the real question behind the memo question, and it's worth knowing cold.

`memo` does a **shallow comparison** of props — it checks whether each prop is
the *same value* as last time, not whether it looks the same. For objects and
functions that means the same reference in memory. So `memo` only helps if the
props keep their identity between renders.

Two props go into each row, and both are deliberately stable:

- **`transaction`** — when the list is re-sorted, `sortTransactions` copies the
  array but doesn't rebuild the objects inside it, so untouched rows keep the
  exact same object. Only an edited row gets a new object.
- **`format`** — wrapped in `useCallback` in
  [`useSettings.js`](src/hooks/useSettings.js), so it's the same function on
  every render unless the currency changes.

**What would break it:** writing `format={amount => format(amount)}` inline in
the JSX. That creates a brand-new function every render, the shallow compare
fails every time, and `memo` silently does nothing while still costing a
comparison. This is the single most common way `memo` gets added and achieves
nothing.

### "Are all your `useMemo`s doing real work?"

No, and it's better to say so than be caught. The load-bearing ones are the
Dashboard's `useMemo`s and the `useCallback` in `useSettings` — those are what
make the `memo` work. The `useMemo` in `Select.jsx` and the memoization in
`ThemeContext` and `CalculatorContext` are conventional rather than measured;
they guard cheap operations and I wouldn't claim they're speeding anything up.

### "Do you have a second optimization?"

Yes, a different kind. The Dashboard search uses `useDeferredValue`
([Dashboard.jsx](src/pages/Dashboard.jsx)). Filtering and sorting the whole
ledger on every keystroke happens before the browser can paint, so at a few
hundred transactions the text box starts lagging behind typing.
`useDeferredValue` lets the input update immediately and the list catch up a
moment later.

The distinction worth drawing: `memo` **avoids** work, `useDeferredValue`
**reorders** it — the work still happens, just at a lower priority.

---

## 3. Data and storage

### "Where is the data stored?"

The browser's `localStorage`, under keys prefixed `budgy:`. No server, no
account, no database. The app is static files.

**Consequences, stated honestly:** your data lives in one browser on one
device. A different browser starts empty, and clearing site data erases it.
That's the trade for having no backend.

### "Does it survive a refresh? Closing the tab?"

Yes to both. `localStorage` has no expiry — only the user clearing site data
removes it. Every save writes to storage immediately, not on unload, so even a
crash keeps everything already entered.

### "What if `localStorage` is full, or the browser blocks it?"

Both are handled in [`storage.js`](src/lib/storage.js). Every read and write is
wrapped in `try/catch`:

- **Blocked** (private mode, or a browser set to block site data): reads return
  a default and the app runs normally, just without saving.
- **Full**: `write` returns the message *"Browser storage is full. Export your
  data, then clear some of the activity log."* — a specific, actionable message
  rather than a crash.

`read` also checks the **shape** of what came back, not just that it parsed. A
value that's valid JSON but the wrong type (an object where a list belongs)
would otherwise crash during startup, and because that happens during render the
error screen's Reload button would just hit the same crash again.

### "Why write to storage before updating state?"

In [`DataContext.jsx`](src/context/DataContext.jsx) every change saves first and
only updates the screen if the save succeeded. So what you see is always what
was actually stored. The opposite order would show a saved transaction that
silently wasn't.

### "What happens with two tabs open?"

They don't sync — the second tab's save wins, because there's no `storage` event
listener. I know about it; it's a deliberate scope decision rather than an
oversight, and the fix would be listening for that event and re-reading.

---

## 4. Correctness details worth showing off

### "Why is money handled in cents?"

[`money.js`](src/lib/money.js). Computers store decimals in binary, and some
decimal values have no exact binary form — the classic demo is
`0.1 + 0.2 === 0.30000000000000004`.

Concretely: three expenses of ₱64.40, ₱217.80 and ₱217.80 total exactly ₱500.00,
but JavaScript adds them to **500.00000000000006**. Against a ₱500 budget a
naive `>` says you're over, and the app renders *"Over by ₱0.00"*.

The fix is to convert to whole cents and compare integers, where there's no
fraction to lose. There's a test pinning this exact case.

### "Why not use `new Date()` on the date strings?"

Dates are stored as `YYYY-MM-DD`. `new Date('2026-03-01')` is parsed as
*midnight UTC*, so anywhere behind UTC it's still the last day of February
locally — every date renders one day early. [`format.js`](src/lib/format.js)
and [`period.js`](src/lib/period.js) split the string and build the date from
its parts instead, which can't drift.

### "What happens at `/transaction/some-nonsense-id`?"

You get "That transaction doesn't exist" and a link back, not a crash. Worth
letting them try it.

### "Why is there an ErrorBoundary?"

React unmounts the whole tree on an uncaught render error, so one bad row would
otherwise produce a blank white page with the reason only in the console. The
boundary catches it and shows a message with a Reload button.

It has to be a class component — `getDerivedStateFromError` and
`componentDidCatch` have no hook equivalent. That's the one place React still
requires a class.

---

## 5. Structure and testing

### "Why did you split `RuleForm` out of `Recurring`?"

The page was 295 lines doing two jobs: listing rules and editing one. It's now
119 lines plus a separate form component.

The interesting part is the `key`. The page passes `key={editingId ?? 'new'}` to
`RuleForm`. When you click Edit on a different rule the key changes, so React
**unmounts and remounts** the form with the new rule's values. The alternative
is copying props into state with an effect, which is a known source of stale-form
bugs. Changing a `key` is React's built-in way to say "this is a different
thing now, start over."

### "What did you test, and why not the components?"

29 tests over four files, all pure logic: money comparison, date and schedule
maths, validation, and recurring-rule generation.

Pure functions are where the edge cases hide — month-end clamping, the float
problem, the ±1-year date window — and they're the cheapest thing to test
because they need no DOM and no React. Component tests would have cost more
setup and caught less.

**The honest version of this story:** I fixed a bug where every newly created
recurring rule was silently paused and never posted anything. My first test for
it passed even with the bug put back, because the bug was inside a React
component the test couldn't reach. So I moved the rule-creation logic into
`newRule()` in [`recurring.js`](src/lib/recurring.js) where it could be tested,
and the test now fails when the bug returns. Making it testable is what made it
actually guarded.

### "Why not Redux?"

Four small contexts cover it, and the app has one user and no server state to
synchronise. Redux would add a dependency and boilerplate for a problem this app
doesn't have. Context is the right size here.

### "Why doesn't the data load in a `useEffect`?"

`useEffect` is for things that happen *after* rendering — usually waiting on a
network request. `localStorage` is synchronous, so there's nothing to wait for.
Using an effect would force an extra render pass and a loading state nobody
would ever see. The load is memoised at module level so it happens once per page
load regardless of React re-rendering.

---

## 6. Design decisions someone might challenge

### "Why is the up arrow green for income? Isn't money coming in?"

One rule across the app: **the arrow shows which way the number moved, the
colour says whether that's good for you.**

- Income raises your balance → up, and that's good → green
- An expense lowers it → down, bad → red
- Spending higher than last month → up, bad → red *(Summary)*
- Spending lower than last month → down, good → green *(Summary)*

The alternative reading — down means "money into your wallet" — is legitimate,
but then the arrow means something different on the Summary page than on a
transaction row. One rule beats two.

### "Is the Balance for this month or for everything?"

Everything, always — and that's deliberate. A balance is what you *have*, and
money carries over from one month into the next, so resetting it on the 1st
would be wrong. It's labelled "All time — total income minus total expenses".

The month's own figure exists too: it's **Net**, in the period bar. So the
Dashboard answers both questions with two different numbers.

Income and Expenses *do* follow the period picker, which is why those two cards
name their scope underneath. Pick August and Expenses drops to August's total
while Balance holds steady — that's not a bug, the labels say which is which.

### "Why does the Dashboard open on all time, but Budgets on a month?"

The Dashboard is specified as listing all transactions, so it opens on
everything and a visitor whose data spans months sees it without hunting for a
control.

Budgets is the exception because a limit is a *monthly* figure. Comparing
lifetime spending against a monthly cap says you're wildly over budget the
moment your ledger passes one month, which is meaningless. So arriving on that
page moves the period to the current month.

### "Why does the preview show a dash before I fill anything in?"

Because the transaction isn't income or expense yet — it's nothing yet. Showing
a red **−₱0.00** would assert an expense the user never entered. There are three
states, not two, so the unset one is grey with a neutral dot and an em dash.

### "Why is the theme also read in `index.html`?"

There's a small script in the `<head>` that reads the saved theme and sets
`data-theme` **before the page paints**. Without it, a dark-mode user sees a
white flash on every load while React boots. It's the one place that touches
`localStorage` directly, because it has to run before any JavaScript module
loads.

---

## 7. Questions to be ready for but hopefully not asked

**"What would you do next?"** — sync between tabs via the `storage` event, and
component tests for the forms.

**"What's the weakest part?"** — the custom `Select` component. It reimplements
a native `<select>` to get consistent styling, which is ~260 lines and some
keyboard handling that a browser gives free. It works and it's accessible, but a
native element would have been less code and less risk.

**"Is anything not finished?"** — the Budgets page compares monthly limits
against whatever month is selected, which is correct, but if someone switches to
"All time" there the comparison stops being meaningful. The page says so, but
it'd be better to disable that option there.

**"How big is the bundle?"** — about 306 KB, 93 KB gzipped, in one chunk. Route
based code splitting with `React.lazy` would cut the initial load, and it's the
obvious next optimisation if the app grew.
