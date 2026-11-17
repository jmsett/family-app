# Family Manager

A household finance PWA for two adults. Plan a monthly budget, distinguish contribution targets from money actually earmarked, track shared expenses and reimbursements, with savings goals and subscriptions planned. No bank connection is required. Money uses integer cents; targets never imply available cash.

**Current implementation:** recurring monthly planning, fixed savings, 50/50 contributions, member-confirmed funding, shared expenses, debt settlements and historical charts, with offline storage and private GitHub synchronization. Browser-ready files are committed at the repository root for branch-based Pages hosting, matching `nunz-app`. The PWA has been deployed and the owner confirmed installation. Live private repository pairing has not been verified in development; the new expense/settlement flow is ready for owner review.

## App organization and trust model

- **Overview:** recorded operating/savings funds through the selected month, **Balances & settlements**, with collapsed **Fund activity** for contribution history and fund movements. Personal debts carry across months. Add expenses or record full/partial payments already made. Expand **Settle up** to see the minimum suggested payments among the two members and Household; suggestions never initiate payments. Funds start at zero: targets do not create cash. The current device member is marked “you” in their single balance row. Expense/payment history and category spending each have a separate panel.
- **Monthly plan:** separate panels for recurring expenses, fixed savings and contribution totals, saved together with **Save monthly plan**. Define recurring expenses with a name, monthly amount, first due date, category and optional labels. Choose monthly recurrence until archived or a final payment date. The operating budget is the sum of payments due in the selected month. Set savings as a separate fixed monthly amount; it carries forward until changed. Contributions always split 50/50, with deterministic cent rounding across the two envelopes and total.
- **Settings (top-right cog):** “I am” identity for this device, member names, appearance, private GitHub connection, JSON backup and preserved earlier manual targets. Identity selection saves locally; V1 uses declarations, without authenticated identity or bank verification. History and actual category spending charts are collapsed on Overview and share date/person/category filters.

Top navigation uses accessible **Home**, **Calendar (Monthly plan)**, **Chart (Charts)** and **Settings** icons. Fund cards center their values and show a small monthly total/your-share caption above the confirmation checkmarks.

Monthly due dates repeat on the original day, clamped to the last day in shorter months. End dates are inclusive. Archiving stops a schedule from the selected month and retains the original record and earlier months. Changing a savings target creates an effective-month entry and preserves prior targets.

Operating and savings transfers are confirmed independently for each member/month using the checkmarks on each fund card. Grey means pending; cyan means confirmed. A zero responsibility is marked complete as “not required”, without adding a financial record or money. Tap your cyan checkmark again to retract a mistaken confirmation after accepting the prompt. It returns to grey and the recorded contribution is removed from fund totals and historical charts; the other fund and member are unaffected. You can confirm it again when the transfer is made. **Fund activity** retains the original amount and marks it Retracted. Duplicate active confirmations are blocked, and later plan edits never change captured amounts. Reconfirming captures the current displayed share. Partial contributions, top-ups and CSV/bank/PayPal verification remain future work; confirm only after the full displayed transfer has been made.

## Expenses and settling up

Choose your identity in Settings, then **Overview → Add expense**. The basic form shows quick setup, description, amount, category and optional labels. Quick setups cover **either** member paying and splitting equally, being owed the full amount, or paying for Household, plus Household paid. Equal splits initially include only the two members. **Advanced options** holds date (defaults to today), payer, funding source/account, participants (including Household), and exact/percentage split controls. The recorder remains your selected identity even when you record the other person paying. Monetary splits preserve every cent; percentage input supports two decimal places.

A personal advance benefiting Household creates a household debt. A purchase using existing household funds reduces the selected fund and creates no duplicate reimbursement. Operating funds carry forward from confirmed contributions, less household-funded purchases and outgoing repayments, plus incoming repayments, with net household debts reserved. Savings carry confirmed contributions forward, minus savings-funded purchases/withdrawals and outgoing transfers, plus incoming transfers. Both cards show cumulative recorded amounts; checkmarks refer only to the selected month's contributions, with no progress bars. A negative recorded balance indicates spending/withdrawals or debts exceed recorded funding; these are not verified bank balances.

Use **Settle up** after a full or partial payment. The app supports the simplified suggestion or a remaining direct debt; overpayments are blocked. Repayments never count as spending. **Correct** adds a reversal plus replacement expense; **Reverse** cancels an incorrect expense or repayment. The original, recorder, timestamp and reason remain in history. Reversals take effect in the original entry's period. Debt remains visible when changing months or history filters. Balances use signed logo cyan (positive) and orange (negative) amounts, with signs independent of color. History shows the description, original effect on your personal net balance, and a small payer/total caption. Expand **Details** for complementary date, funding source, category/labels, split and audit/correction information. Repayment effects show debt reduction, not income. **Filters** hides date/person/category controls. Actual category spending uses a pie chart with the selected category colors, exact amounts and percentage legend. Monthly contribution confirmations remain separate from debt repayments.

Offline entries have stable IDs. Independent entries merge and retries deduplicate. Conflicting immutable payloads, competing corrections to the same expense, or concurrent repayments exceeding the remaining debt stop sync, preserving both copies for review. Reverse a duplicate/incorrect payment on the device that recorded it, then sync again. Remote plan recovery preserves all financial events. These are trusted records, not bank-verified transactions.

## Funds and historical charts

Expand **Fund activity → Move or withdraw funds** to record operating ↔ savings transfers or a withdrawal outside the tracked funds. This moves recorded balances without creating an expense or personal debt. Use **Add expense → Advanced options → Pay from** for a savings-funded purchase; household settlements can also select their account under Advanced options. Movement descriptions, effective dates and audit details remain in the ledger and synchronize offline; reverse an incorrect movement from its Details in history. Saved movement forms are protected from stale writes, and unsaved forms block sync/navigation without a discard decision.

Open the **Chart icon** to explore expenses or combined fund/goal views for savings and operating funds. Each fund chart shows available money, confirmed funding in the month ending the interval, and that month’s goal on the same plot. A legend and funding status distinguish contributions from the remaining balance, so spending or withdrawals do not make a completed funding goal look missed. Switch between bars and lines and **D / W / M / Y** intervals. Drag horizontally to pan, pinch or scroll to zoom, and hold/hover to inspect a value. Drag vertically on the right value axis to scale it; **Advanced options → Reset value scale** restores automatic fitting. Vertical gestures elsewhere on the plot continue to scroll the page. **+ / −** zoom buttons and **All** fit are available; keyboard arrows pan, +/− zoom, and Home fits. Dates, expense category, grid and a paginated exact-value table stay under **Advanced options**. Chart colors follow device appearance settings. Empty households show an empty state, never fabricated example transactions.

Expenses are actual purchase totals for each interval, excluding repayments, fund movements and reversed entries. Savings and operating funds show cumulative **interval-end balances**, including opening funds before the selected range, withdrawals, movements and household repayments. Operating availability reserves net household liabilities, matching Overview at month end. Funding comparisons use the month ending each interval: confirmed contributions to date in that month against its monthly target, including forecasts. They reset for the next month while available fund balances carry forward. A yearly point samples its ending month’s funding/goal, rather than annualizing those amounts or adding monthly balances. Weekly intervals begin Monday; first/last intervals may be partial. Reversals restate their original effective period.

Contribution records have an assigned planning month and confirmation timestamp. Charts use the household-local confirmation date when it is within that month; early/late confirmations are clamped to the nearest boundary of their assigned month. This preserves agreement with Overview without implying bank-verified daily balances. The rule is explained under Advanced options. Contribution splits remain 50/50; future unequal responsibility settings must preserve captured confirmations.

The renderer is bundled [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/docs/), with the required visible attribution and shipped Apache-2.0/MIT license notices. Household records stay in the browser; this is not an embedded market-data widget. The chart chunk and notices are precached with the rest of the PWA, so Charts works offline even on the first visit after installation.

## JML branding and appearance

The app header, favicon and installable PWA icons use the supplied **Multicolor JML Monogram App Icon**. The default palette combines its violet, pink, amber and cyan with Afterglow's dark surfaces and Electric halo bars.

Open **Settings → Appearance** to choose **Electric halo, Liquid prism, Solar flare, Pixel rush, or Solid**, plus Dark/Light/Device themes. Pick a palette or customize the interface accent, operating/savings gradient stops and six category chart colors. Glow intensity, animation speed and motion are adjustable; device reduced-motion settings always take priority. Live previews include a progress slider and clearly labeled sample chart bars.

Preferences save automatically on each device and are separate from household JSON and GitHub credentials. **Reset appearance** restores the JML/Electric halo default without changing financial records or the GitHub connection. Category pie slices and historical plots use the selected colors; previews retain the bar effects; savings-goal tracking remains future work.

## Architecture

Following the existing `nunz-app` approach:

- **family-app (public):** React/TypeScript source and static PWA hosted on GitHub Pages. No household records or credentials in source or deployment artifacts.
- **family-data (private):** A schema-v5 household document at `household.json` containing recurring schedules, effective savings targets, transfer confirmations and their retractions, immutable expense/repayment/fund-movement/reversal events and preserved earlier drafts, synchronized through GitHub's Contents API. No production API server, SQLite database or VPN is needed.
- **Devices:** IndexedDB saves work offline. Each device uses a separate expiring fine-grained token scoped only to `family-data` with Contents read/write. Enter it only in the PWA. After checking private-repository access, the app saves the token in a separate device-only IndexedDB database and reconnects automatically when reopened. Disconnect removes the saved token. Tokens are never exported or synchronized.
- **Conflicts:** independent member confirmations and retractions merge by stable IDs, without double counting or restoring a retracted transfer from an older device. Concurrent divergent plan edits require review. Independent expense and repayment events merge by immutable ID. Remote recovery can replace unsynced plan settings, but retains device financial history; conflicting amounts for the same confirmation are blocked. SHA guards all writes.

Schema-v2/v3/v4 documents upgrade automatically to v5, preserving recorded amounts, ledger history, device credentials and appearance. Retractions retain the original confirmation; a later confirmation is a new record. Update all devices before using the new funding controls.

See [plan.md](plan.md), [architecture](docs/architecture.md) and [milestone.md](milestone.md). The owner authorized this expense/settlement pass; remaining financial milestones still require review.

## Run locally

Dependencies stay in this checkout (`node_modules`). The wrapper uses a project-local Node.js 24 runtime on Linux x64, downloading and verifying it if missing. On other platforms, install Node.js 24 and use npm directly.

```bash
bash scripts/npm.sh ci
bash scripts/npm.sh run dev:web
```

Open **http://localhost:5173**. The app uses device storage and works without Fastify. The service worker is enabled only in a production build. To test the Pages path and installation locally:

```bash
bash scripts/npm.sh run build:pages
bash scripts/npm.sh run preview:pages
```

Open **http://localhost:4173/family-app/** online once, then test offline reload. The service worker caches only built app assets; authenticated GitHub responses are never cached there. Updates activate after existing app windows close.

```bash
bash scripts/npm.sh run check # types, lint, unit/API/sync tests, build, formatting
bash scripts/npm.sh exec -- playwright install chromium
bash scripts/npm.sh run test:e2e # desktop + Android planning/expense regression
bash scripts/npm.sh run test:pwa # static subpath, offline shell, mocked multi-device sync
# To use installed Chrome, prefix either browser test command with:
# PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome
```

## GitHub setup — ready to begin

1. Create **family-app** (public) and **family-data** (private). Initialize `family-data` with a README on `main`. GitHub reported during the documentation push that `jmsett/family_manager` has already moved to `jmsett/family-app`.
2. In `family-app`, set **Settings → Pages → Build and deployment → Source → Deploy from a branch**, branch **main**, folder **/(root)**. The root contains the built app and `.nojekyll`. GitHub publishes it after a push, as with `nunz-app`. No data token or Actions secret is needed.
3. Open **https://jmsett.github.io/family-app/** once deployment succeeds. Install through the browser's app installation menu; on iPhone use Safari → Share → Add to Home Screen.
4. Create a separate fine-grained token for each device: resource owner **jmsett**, repository access **Only select repositories → family-data**, repository permission **Contents: Read and write**, with an expiration. GitHub includes Metadata read access. Do not grant access to `family-app` or other repositories.
5. On the first device, define and save your recurring expenses and savings in **Monthly plan**, choose your identity under the **Settings cog → I am**, then open **Sync & backups**, enter the token and connect. The app verifies repository privacy and creates `household.json`. An untouched empty household is never uploaded automatically.
6. On the second device, connect in **Settings** before making edits. It downloads the whole household, including recurring schedules across months. Use **Sync now** to check both copies. The connection is remembered across reloads and app restarts. Re-enter a token only after disconnecting, clearing browser data or replacing an expired/revoked token.
7. Test with sample data: confirm one member on each offline device, reconnect, and check that both confirmations appear once. Competing plan edits must produce a visible conflict. Export the device JSON before recovering remote plan settings.

If the Pages URL displays this README, check that the latest commit includes root `index.html` and Pages is publishing **main / (root)**. Wait for GitHub's automatic **pages build and deployment** run to succeed. In **Settings**, expand **Sync & backups** to connect a device or export the household; its status remains visible when collapsed.

Family has a dedicated PWA identity (`/family-app/`) and scope, separate from Nunz. If Android says it is already installed after removing an older Family installation, close Family and Chrome windows, reopen [the updated Family page](https://jmsett.github.io/family-app/?install=family), then try installing from Chrome. Do not clear `jmsett.github.io` site data as a troubleshooting step: it can remove unsynced Family/Nunz records and saved device connections.

For future source updates, rebuild the public files before committing:

```bash
bash scripts/npm.sh run build:pages
```

This builds for `/family-app/` and copies only static PWA assets to the repository root. `.pages-files.json` tracks generated files so obsolete hashed assets can be removed without touching source or documentation. Commit the source and regenerated files together. CI verifies that the committed public build matches the source. The custom Actions deployment workflow has been removed; Actions still runs verification, and GitHub runs its standard branch Pages deployment.

Synchronization runs after saves, on reconnect/focus/visibility changes, every two minutes while visible, and on request. It runs only while the app is open. Save form changes before syncing. Failures preserve saved local drafts; unsaved fields still require Save. Browser storage can be evicted or cleared, so pending changes are not backed up. Export the whole household for an independent backup; Git history alone is not a backup policy. Existing browser drafts and old private `budgets/YYYY-MM.json` files migrate into preserved legacy targets without becoming expenses or confirmed funds. Schema-v2/v3 household documents upgrade to v4 without inventing entries or removing financial history. Old private files are left untouched. Close older app tabs if the storage upgrade is blocked. Generic JSON import and automatic SQLite migration are not implemented yet.

Private JSON is not end-to-end encrypted. GitHub and collaborators can read it; tokens grant repository-wide access, with no separate per-member authorization. Local records remain after disconnect. Same-origin scripts can access those records and saved credentials, and project Pages sites on `jmsett.github.io` share an origin. Revoke a lost device's token in GitHub. Never paste tokens into chat, commit them, or put them in build variables.

Official references: [GitHub Contents API](https://docs.github.com/en/rest/repos/contents), [fine-grained tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Legacy local API

`bash scripts/npm.sh run dev` still starts both the web app and the legacy Fastify API at `localhost:3001`. The browser no longer calls that API. Existing SQLite data at ignored `data/family-manager.sqlite` is preserved and is not automatically copied to device storage or GitHub. The legacy API, integration tests and Docker setup remain available for reference; they do not describe the Pages production deployment.
