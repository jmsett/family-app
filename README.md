# Family Manager

A household finance PWA for two adults. Plan a monthly budget, distinguish contribution targets from money actually earmarked, track shared expenses and reimbursements, with savings goals and subscriptions planned. No bank connection is required. Money uses integer cents; targets never imply available cash.

**Current implementation:** recurring monthly planning, fixed savings, 50/50 contributions, member-confirmed funding, income-based funding rules, shared expenses, debt settlements, historical charts, travel savings goals and a home-affordability calculator, with offline storage and private GitHub synchronization. Browser-ready files are committed at the repository root for branch-based Pages hosting, matching `nunz-app`. The PWA has been deployed and the owner confirmed installation. Live private repository pairing has not been verified in development; the new expense/settlement flow is ready for owner review.

## App organization and trust model

- **Overview:** recorded operating/savings funds through the selected month, **Balances & settlements**, with collapsed **Fund activity** for contribution history and fund movements. Personal debts carry across months. Add expenses or record full/partial payments already made. Expand **Settle up** to see the minimum suggested payments among the two members and Household; suggestions never initiate payments. Funds start at zero: targets do not create cash. The current device member is marked “you” in their single balance row. Expense/payment history and category spending each have a separate panel.
- **Monthly plan:** separate panels for recurring expenses, fixed savings and contribution totals, saved together with **Save monthly plan**. Define recurring expenses with a name, monthly amount, first due date, category and optional labels. Choose monthly recurrence until archived or a final payment date. The operating budget is the sum of payments due in the selected month. Set savings as a separate fixed monthly amount; it carries forward until changed. The default method splits recurring costs and fixed savings 50/50. An optional income-percentage method uses the lower income to set equal operating and savings contributions; see below.
- **Settings (top-right cog):** “I am” identity for this device, member names, appearance, private GitHub connection, JSON backup and preserved earlier manual targets. Record both members’ net monthly incomes with an effective month. Identity selection saves locally; V1 uses declarations, without authenticated identity or bank verification. History and actual category spending charts are collapsed on Overview and share date/person/category filters.

Navigation uses accessible **Home**, **Calendar (Monthly plan)**, **Chart (Charts)**, **Investments**, **Travel** and **Settings** icons. Fund cards center their values and show a small monthly total/your-share caption above the confirmation checkmarks.

Monthly due dates repeat on the original day, clamped to the last day in shorter months. End dates are inclusive. Archiving stops a schedule from the selected month and retains the original record and earlier months. Changing a savings target creates an effective-month entry and preserves prior targets.

Operating and savings transfers are confirmed independently for each member/month using the checkmarks on each fund card. Grey means pending; cyan means confirmed. A zero responsibility is marked complete as “not required”, without adding a financial record or money. Tap your cyan checkmark again to retract a mistaken confirmation after accepting the prompt. It returns to grey and the recorded contribution is removed from fund totals and historical charts; the other fund and member are unaffected. You can confirm it again when the transfer is made. **Fund activity** retains the original amount and marks it Retracted. Duplicate active confirmations are blocked, and later plan edits never change captured amounts. Reconfirming captures the current displayed share. Partial contributions, top-ups and CSV/bank/PayPal verification remain future work; confirm only after the full displayed transfer has been made.

## Correcting or deleting recurring expenses

In **Monthly plan**, open an expense’s **Manage** menu to **Edit**, **Archive** or **Delete**. Edits and deletions are staged with the rest of the plan: press **Save monthly plan** to apply them. An unfinished edit protects navigation and blocks saving/sync until you apply or cancel it.

**Edit → Apply changes** offers:

- **From the selected month onward:** keep earlier months unchanged and replace scheduled changes from that month forward.
- **All months from first defined:** correct every month from the schedule’s first payment month, replacing its existing versions.

Edit the name, monthly amount, due day, category, labels and final payment date. Days 29–31 still clamp to month end. The original start month and archive boundary remain; editing an archived schedule corrects its history without reactivating it. Historical fixed-budget targets and charts use the version applicable to each month. Income-percentage targets retain their separate rule.

**Archive** stops future planning from the selected month and keeps earlier months. **Delete** removes the schedule and all its versions from every month, including historical recurring budgets, after an explicit prompt. Separately recorded expenses, repayments and confirmed funding remain intact. Git history and existing exports/backups may still contain older copies; Delete is not a repository-history purge.

Versioned corrections and deletions synchronize as plan changes. Stale devices with only new financial entries adopt the deleted plan while retaining those entries; competing plan edits stop for review rather than silently restoring a deleted schedule. Schema 9 upgrades earlier data with an empty recurring-change history, preserving existing budgets and credentials.

## Income, funding rules and investments

In **Settings → Household members**, enter each person's regular net monthly income and the month it starts. Income carries forward until changed; earlier months remain available. **Investments** (bank/building icon) shows each member’s and the household’s annual net income estimate: the selected month’s income × 12. Bonuses, extra salary payments and actual trailing-year earnings are not inferred.

In **Monthly plan → Funding rule**, choose **Income percentages** for the 50/30/20 preset or custom operating/leisure/savings percentages totaling 100%. Each member contributes `floor(min(income A, income B) × percentage)` to each shared fund, rounded down to cents. With €2,000/€3,000 income and 50/30/20, each contributes €1,000 operating + €400 savings. Leisure stays personal and is only a guide; no leisure fund or automatic spending is created. The higher earner’s remaining income stays personal. If either income is zero/unset, both shared targets are zero. Recurring costs remain visible with an explicit operating shortfall/headroom. The default fixed method remains available.

Rules take effect from the selected planning month and carry forward. Changing income/rules updates planned targets from that month, while confirmed amounts, expenses and retractions stay recorded. Checkmarks are still explicit declarations; a rule never creates cash or automatic contributions.

The **Investments → Home affordability** panel keeps steps 1 and 2 collapsed and visualizes the estimated price range and rate sensitivity:

1. Monthly net household income × 30–35%, less €350–500 monthly ownership costs and any other monthly debt payments. Include utilities, maintenance, property tax, insurance and fees in those editable costs. Negative loan budgets clamp to zero.
2. Editable 3–5% annual interest scenarios, full repayment term (default 30 years), available upfront cash (default zero) and purchase costs (default 10% of price). Rates and costs are assumptions, not current quotes or local tax guidance. Use cash after keeping a separate emergency reserve.
3. Fully amortizing loan principal = monthly payment × `(1 − (1 + rate/12)^(-years×12)) / (rate/12)`. Zero interest uses payment × months. Home price = `(loan + cash) / (1 + purchase-cost rate)`. Conservative combines 30%, higher costs and higher interest; optimistic combines 35%, lower costs and lower interest. The range is not a lender approval. If cash cannot cover purchase costs, the result assumes financing that gap; a lender may require more cash.

Calculator assumptions save on this device, separately from household financial records and GitHub credentials. They never withdraw savings. Fixed interest is assumed for the entire repayment term; refinancing risk, extra repayments, income changes and lender underwriting are outside this estimate. The [CFPB affordability guide](https://www.consumerfinance.gov/owning-a-home/prepare/decide-how-much-you-want-spend/) explains why term, down payment and ownership costs matter; its regulatory discussion applies to the US, not household-specific local eligibility.

For realistic chart testing, open **Settings → Sample household** or [the sample app](https://jmsett.github.io/family-app/?demo=1). It uses [fictional JSON](examples/demo-household.json) with 23 months of expenses, contributions, withdrawals and income changes. Sample edits are in memory, reset on reload and never access or synchronize the real household or its credentials. [Sample-data instructions](examples/README.md) include the generator.

## Travel savings goals

Open the **airplane / Travel** tab and press **+**. Each destination gets its own panel with a large funded percentage, one joint-savings progress bar, remaining amount and optional picture. Funding comes from confirmed joint savings; no individual progress bars or additional transfers are created.

A trip budget is for two people: daily food allowance per person × two × travel days, hotel price for the room × hotel nights, return-flight cost per person × two, plus a separate planned other-expenses lump sum and contingency allowance. **Other planned expenses · total (€)** is one total for both travelers (for example, tours), added once without multiplying by travelers or days. Both dates may be blank; enter estimated days/nights instead. Dated food allowances include departure and return days. Dates suggest hotel nights from the date difference, which you can override for overnight flights or other arrangements. The separate contingency allowance defaults to an editable 15% of food/hotel/flights, or a custom euro amount. Adding planned other expenses leaves that contingency unchanged. Include local transport, activities, baggage, insurance and other known costs; the percentage is a planning estimate, not destination pricing. [Travel-budget guidance](https://navyfederal.practicalmoneyskills.com/en/learn/budgeting/situational-budgeting/travel.html) suggests a 10–15% contingency for surprise costs.

**Allocate savings** sets how much existing savings is earmarked for that goal. Only unallocated confirmed savings can increase a goal's allocation; setting a lower amount releases it. Allocations do not change Overview cash totals, spending or debt. Funded progress includes money already paid from savings. An actual expense carrying the trip label and explicitly paid from the savings fund consumes the relevant reserve once; a reversal restores it. Personal expenses and operating-funded purchases do not consume joint savings. A savings-funded purchase can carry only one trip label. Withdrawals/retracted confirmations may leave reservations underfunded; Travel then shows the shortfall and blocks further increases. For dated trips, the panel suggests a monthly amount needed until departure.

A stable label is generated from the trip name and a short ID. Choose it from **Add trip label** when recording an expense. **Expenses** on the trip opens Overview history already filtered to that label across all dates; **Filters → Label / trip** also filters category spending. Renaming preserves the label; archiving releases reserves and retains the trip and expense history, with a restore option. Opening Home explicitly clears the trip shortcut context.

Upload a JPEG/PNG/WebP destination image under 12 MB. The browser strips metadata by redrawing it and compresses it to a small JPEG (at most 60,000 data-URL characters). Photos live in private household JSON and sync with the plan; no public image-hosting service is used. Photos across all goals are capped at 300,000 characters to leave room under the existing 1 MB JSON synchronization limit. The app refuses a trip edit that would exceed that file limit. Up to 40 trips, including archived ones, are supported.

Trip definitions and earmarks are editable plans. Competing offline edits, including allocations to different trips, stop for review rather than combining reservations blindly. Explicit remote-plan recovery keeps missing local trip identities as archived goals with zero allocation, retaining their labels; recovery may replace unsynced plan allocations after the existing export/recovery warning. Recorded expenses and funding history remain immutable. Schema 8 adds the planned other-expenses field, defaulting to zero for existing trips so their budgets stay unchanged, preserving income, credentials, confirmations and history. The sample household includes two fictional travel goals.

## Expenses and settling up

Choose your identity in Settings, then **Overview → Add expense**. Use the **Quick / Custom** buttons to show one setup at a time. Quick has exactly two setup fields: **Who paid** (either member or Household) and **Expense type**: **Personal**, **50/50**, **Owed full amount**, or **Paid for household**. Personal assigns the cost to that payer; 50/50 splits between the two members; owed-full assigns the cost to the other member; paid-for-household assigns it to Household. A member paying for Household creates an advance, whereas Household paying uses existing operating funds. Household payer supports the household type in Quick; choose Custom for savings-funded purchases or other beneficiary arrangements.

Description, amount, category and labels remain common to both modes. **Custom** shows payment date, payer, source/account, participants and equal/exact/percentage split controls, with Quick selectors hidden. Switching to Custom starts with the selected Quick arrangement. Choosing Quick again applies the visible Quick choices, including its operating-fund/today defaults (corrections retain the original date). Common description/amount/category/labels stay entered. Corrections open in Custom to preserve the original allocation, and the correction reason remains available in both modes. The recorder is still your device identity even when you record the other person paying. Monetary splits preserve every cent.

A personal advance benefiting Household creates a household debt. A purchase using existing household funds reduces the selected fund and creates no duplicate reimbursement. Operating funds carry forward from confirmed contributions, less household-funded purchases and outgoing repayments, plus incoming repayments, with net household debts reserved. Savings carry confirmed contributions forward, minus savings-funded purchases/withdrawals and outgoing transfers, plus incoming transfers. Both cards show cumulative recorded amounts; checkmarks refer only to the selected month's contributions, with no progress bars. A negative recorded balance indicates spending/withdrawals or debts exceed recorded funding; these are not verified bank balances.

Use **Settle up** after a full or partial payment. The app supports the simplified suggestion or a remaining direct debt; overpayments are blocked. Repayments never count as spending. **Correct** adds a reversal plus replacement expense; **Reverse** cancels an incorrect expense or repayment. The original, recorder, timestamp and reason remain in history. Reversals take effect in the original entry's period. Debt remains visible when changing months or history filters. Balances use signed logo cyan (positive) and orange (negative) amounts, with signs independent of color. History shows the description, original effect on your personal net balance, and a small payer/total caption. Expand **Details** for complementary date, funding source, category/labels, split and audit/correction information. Repayment effects show debt reduction, not income. **Filters** hides date/person/category controls. Actual category spending uses a pie chart with the selected category colors, exact amounts and percentage legend. Its **Spending for** selector offers **Total**, **Household** and each member’s name. Total includes all expense amounts; the other views sum only that party’s captured beneficiary shares. Thus an €80 50/50 expense contributes €40 to each member, an €80 fully owed expense contributes €80 to the person who owes it, and a household expense contributes only to Household. Who paid or which account funded the purchase does not determine ownership. Custom mixed splits use each party’s exact share; personal totals plus Household reconcile to Total, including rounding cents. Repayments, fund movements and reversed purchases never inflate spending.

Date, category and label filters continue to apply to the pie. The history person filter selects entries involving that party and stays separate from the spending responsibility selector, so choosing Total is not restricted by a payer/involvement filter. Monthly contribution confirmations remain separate from debt repayments.

Offline entries have stable IDs. Independent entries merge and retries deduplicate. Conflicting immutable payloads, competing corrections to the same expense, or concurrent repayments exceeding the remaining debt stop sync, preserving both copies for review. Reverse a duplicate/incorrect payment on the device that recorded it, then sync again. Remote plan recovery preserves all financial events. These are trusted records, not bank-verified transactions.

## Funds and historical charts

Expand **Fund activity → Move or withdraw funds** to record operating ↔ savings transfers or a withdrawal outside the tracked funds. This moves recorded balances without creating an expense or personal debt. Use **Add expense → Custom → Pay from** for a savings-funded purchase; household settlements can also select their account under Advanced options. Movement descriptions, effective dates and audit details remain in the ledger and synchronize offline; reverse an incorrect movement from its Details in history. Saved movement forms are protected from stale writes, and unsaved forms block sync/navigation without a discard decision.

Open the **Chart icon** to explore expenses or combined fund/goal views for savings and operating funds. Each fund chart shows available money, confirmed funding in the month ending the interval, and that month’s goal on the same plot. A legend and funding status distinguish contributions from the remaining balance, so spending or withdrawals do not make a completed funding goal look missed. Switch between bars and lines and **D / W / M / Y** intervals. Drag horizontally to pan, pinch or scroll to zoom, and hold/hover to inspect a value. Drag vertically on the right value axis to scale it; **Advanced options → Reset value scale** restores automatic fitting. Vertical gestures elsewhere on the plot continue to scroll the page. **+ / −** zoom buttons and **All** fit are available; keyboard arrows pan, +/− zoom, and Home fits. Dates, expense category, grid and a paginated exact-value table stay under **Advanced options**. Chart colors follow device appearance settings. Empty households show an empty state, never fabricated example transactions.

Expenses are actual purchase totals for each interval, excluding repayments, fund movements and reversed entries. Savings and operating funds show cumulative **interval-end balances**, including opening funds before the selected range, withdrawals, movements and household repayments. Operating availability reserves net household liabilities, matching Overview at month end. Funding comparisons use the month ending each interval: confirmed contributions to date in that month against its monthly target, including forecasts. They reset for the next month while available fund balances carry forward. A yearly point samples its ending month’s funding/goal, rather than annualizing those amounts or adding monthly balances. Weekly intervals begin Monday; first/last intervals may be partial. Reversals restate their original effective period.

Contribution records have an assigned planning month and confirmation timestamp. Charts use the household-local confirmation date when it is within that month; early/late confirmations are clamped to the nearest boundary of their assigned month. This preserves agreement with Overview without implying bank-verified daily balances. The rule is explained under Advanced options. Both methods keep equal member contributions; income/rule history preserves earlier targets and captured confirmations.

The renderer is bundled [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/docs/), with the required visible attribution and shipped Apache-2.0/MIT license notices. Household records stay in the browser; this is not an embedded market-data widget. The chart chunk and notices are precached with the rest of the PWA, so Charts works offline even on the first visit after installation.

## Mobile design and appearance

The header, favicon and installable PWA icons retain the supplied **Multicolor JML Monogram App Icon**. Phones use labeled bottom navigation for Home, Plan, Charts, Invest and Travel; Settings stays in the header. Larger screens use labeled header navigation. Fund cards distinguish operating and savings with palette colors, with recorded balances, monthly dues and member confirmations kept together.

Open **Settings → Appearance** for four curated color schemes and one **Custom** palette:

- **Cyberpunk** (default): electric yellow and ice cyan on cool graphite.
- **Synthwave**: hot pink and ultraviolet on plum.
- **Replicant**: Blade Runner inspired desert amber and rain teal on warm charcoal.
- **Neon Noir**: jade neon and signal coral on ink green.
- **Custom**: edit the interface accent, operating/savings gradient stops and six category chart colors. Your custom colors are retained when trying presets and restored when returning to Custom. Earlier saved palettes and personalized colors migrate to Custom.

Each preset coordinates app surfaces, fund colors, goals and charts, with **Dark / Light / Device** themes. **Electric halo, Liquid prism, Solar flare, Pixel rush, or Solid** bar effects, glow intensity, animation speed and motion remain adjustable independently. Device reduced-motion settings always take priority. Live previews contain clearly labeled sample values.

Preferences save automatically on each device, separately from household JSON and GitHub credentials. **Reset appearance** restores Cyberpunk/Dark/Electric halo and clears the saved custom palette without changing financial records or the GitHub connection. Category pie slices and historical plots use the selected chart colors.

Dropdowns open with a single tap and use themed option sheets on phones and anchored pickers on larger screens. Dropdown and disclosure arrows use palette-aware vector icons. Options have larger touch targets, selected checkmarks and disabled states. Longer lists include search, with keyboard arrows, Home/End, typeahead and Escape support. On phones, drag a sheet's top handle or heading downward to dismiss it; a short drag snaps back, and the options scroll independently. Confirmation dialogs share this dismissal gesture (equivalent to Cancel), the active palette, focus trapping/restoration and distinct destructive actions. Date and color inputs retain their platform pickers.

Back first dismisses an open picker, confirmation or Manage menu. An unfinished expense, recurring expense, fund movement or trip edit offers a discard confirmation before returning to its parent section. Back and Forward otherwise follow visited app sections; canceling a discard keeps the draft. No form values or credentials are stored in navigation history. At the initial Overview without earlier app history, the browser or installed PWA retains its normal exit behavior. Reload continues to open Overview.

## Architecture

Following the existing `nunz-app` approach:

- **family-app (public):** React/TypeScript source and static PWA hosted on GitHub Pages. No household records or credentials in source or deployment artifacts.
- **family-data (private):** A schema-v9 household document at `household.json` containing recurring schedules and effective-month corrections, effective savings targets, monthly income history, funding rules, travel goals/earmarks/photos, transfer confirmations and their retractions, immutable expense/repayment/fund-movement/reversal events and preserved earlier drafts, synchronized through GitHub's Contents API. No production API server, SQLite database or VPN is needed.
- **Devices:** IndexedDB saves work offline. Each device uses a separate expiring fine-grained token scoped only to `family-data` with Contents read/write. Enter it only in the PWA. After checking private-repository access, the app saves the token in a separate device-only IndexedDB database and reconnects automatically when reopened. Disconnect removes the saved token. Tokens are never exported or synchronized.
- **Conflicts:** independent member confirmations and retractions merge by stable IDs, without double counting or restoring a retracted transfer from an older device. Concurrent divergent plan edits require review. Independent expense and repayment events merge by immutable ID. Remote recovery can replace unsynced plan settings, but retains device financial history; conflicting amounts for the same confirmation are blocked. SHA guards all writes.

Schema-v2/v3/v4/v5/v6/v7/v8 documents upgrade automatically to v9, preserving recorded amounts, ledger history, device credentials and appearance. Missing income/rule/trip/recurring-change lists start empty during migration, retaining the fixed method and existing history. Retractions retain the original confirmation; a later confirmation is a new record. Update all devices before using the new funding controls.

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
