# Family Manager implementation plan

## Current product rules — 2026-11-17 owner feedback

- Overview contains recorded operating/savings funds, a single balance row per party (current member marked “you”), separate history/category panels, and collapsed Fund activity. All plan definition belongs to Monthly plan; identity, connection and member setup belong to the top-right Settings cog.
- Operating targets equal the sum of monthly recurring payments due in that month. Each schedule has a custom name, amount in cents, first due date, category and labels. Repeat monthly until archived or through an inclusive end date. Clamp month-end due dates; retain archived schedules and historical months.
- Savings are a fixed monthly amount with effective-month history, carrying forward until changed. The default contribution split is 50/50; optional income funding uses equal contributions based on the lower income; allocate rounding cents deterministically while balancing both envelopes and the combined target.
- Only a member's explicit declaration adds that member's full operating/savings share to the month's confirmed funds. One active confirmation per member/month/fund, with immutable confirmation/retraction history; no bank verification or separate member authentication is claimed. Later CSV/bank/PayPal matching may verify declarations. Members can retract their own confirmation and confirm again; partial contributions/top-ups remain future work; expense corrections use immutable reversals.
- The owner explicitly authorizes this product slice across the earlier milestone boundaries; it is awaiting review, not blanket acceptance of other features.

## Branding and personal appearance

Use the owner-supplied Multicolor JML logo for the header/favicon/PWA icons. Preserve the compact desktop/Android layouts while adopting its violet/pink/amber/cyan palette. Reference `afterglow-neon-pwa` for Electric halo (default), Liquid prism, Solar flare and Pixel rush, with a Solid fallback. Settings exposes theme, effect, palette, accent, operating/savings color stops, six category chart colors, glow, speed and motion controls with preview-only sample data.

Appearance is personal to each device (`family-appearance-v1` in localStorage), with input validation, automatic persistence and a reset. It never changes household financial data or credentials. Fund confirmations remain separate from the appearance previews; current category bars and historical plots share the device palette. Reuse the bar component for future goals and charts. Respect system reduced motion and keep numeric labels independent of color.

## Current storage and synchronization — schema v9

`household.json` is the authoritative private GitHub document for the entire household, replacing per-month draft synchronization below. It contains recurring schedules and corrections, effective-month savings targets, income histories, funding rules, travel goals/earmarks/photos, member names, immutable transfer confirmations and retractions, expense/repayment/reversal events and preserved legacy targets. IndexedDB `family-manager-v1` upgrades to version 2, adding a household store while leaving old budget rows intact. Old private monthly JSON is imported on first connection when no household exists; old files are not deleted. Manual legacy operating targets do not invent recurring expenses or funds.

Independent confirmations merge by stable `month:member:fund` ID for generation zero, with a `:generation` suffix for subsequent confirmations; identical amounts deduplicate, conflicting amounts stop synchronization. Retractions merge by canonical confirmation ID and remain effective when a stale device uploads the original confirmation. A later generation requires its predecessor and predecessor retraction. Competing plan settings use three-way conflict detection. Remote recovery retains local confirmations and retractions, and local persistence rejects changing/removing recorded transfer amounts or dropping retractions. SHA-protected writes and idempotent content reconciliation remain mandatory. Schema-v2/v3/v4/v5/v6/v7/v8 documents upgrade in place to v9, adding empty missing income/rule/trip/recurring-change histories without altering previous targets. Legacy combined confirmations split into separate positive fund records without changing amounts; existing confirmations become generation zero with no fabricated retractions. Credentials, confirmations and legacy records are preserved.

## Current refinement — recurring edits and deletion

Owner requested editing recurring expenses from the selected month forward or retroactively from their first definition, plus deletion including historical recurring data.

- Manage menu exposes Edit, Archive and Delete. Keep edits/deletions staged until Save monthly plan. Protect unfinished edits and validate all fields.
- Schema 9 adds effective-month `expenseChanges` snapshots for name, amount, due day, end date, category and labels, referencing a stable recurring ID. Forward edits replace versions from the selected month onward; retroactive edits replace the full timeline from the first payment month. Keep start month/archive boundaries; clamp due days at month end.
- Monthly plans and historical targets derive the applicable snapshot; recorded contributions and ledger events never change. Validate references, unique schedule/month pairs and aggregate limits at all effective boundaries.
- Delete removes the original schedule and every change snapshot, including historical recurring projections. Confirm explicitly; retain separately recorded financial events. Existing Git history/exports remain recoverable. Archive continues to preserve earlier planning.
- Existing three-way plan conflict detection handles corrections/deletions and prevents a stale financial-only upload from resurrecting schedules. Schemas 2–8 upgrade to an empty change history without altering previous plans, credentials or money.
- Verify scopes, future-version replacement, archive/end/leap-day behavior, deletion with retained funds/ledger, migration, stale-device conflicts, mobile layout, offline reload and two-device sync.

## Current refinement — planned trip extras

Add **Other planned expenses · total (€)** as a separate lump sum for both travelers. Add it once to the existing trip budget, without multiplying by days/people or adding contingency to it. Keep the percentage/fixed contingency controls separate and display both amounts in the budget breakdown. Schema 8 defaults this field to zero for existing trips, preserving all previous budgets and allocations; include it in canonical comparison and private JSON synchronization. Verify math, validation, migration, editing, offline reload and two-device sync.

## Current refinement — joint travel savings goals

Owner clarified that trip funding comes from confirmed joint savings, so use one progress bar per goal and a large total funded percentage.

- Airplane navigation opens a Travel page with + to add destination panels. Trip name creates a stable label; optional date pair derives inclusive food days and suggests hotel nights, with overridable nights. Undated goals use estimated days/nights.
- Budget for two: food per person/day, shared hotel room/night, return flights per person, extras as editable 15% of base costs or a custom euro amount. Include known transport/activity/insurance/baggage costs explicitly. No live prices or currency conversion.
- Goal allocations earmark existing confirmed savings without moving cash. Block increases beyond currently unallocated savings or the trip budget. Tagged savings-funded purchases consume a reserve once; reversals restore it; personal/operating purchases do not consume savings. Prevent a savings expense from consuming multiple trip reserves. Show any later underfunding after cash withdrawals/retractions, and monthly savings pace for dated goals.
- Expense entry suggests trip labels. Trip Expenses opens all-date history/category spending filtered by label; renaming/archive preserves labels. Archive releases reserves, with restore and no financial-history deletion.
- Compress uploaded photos locally to metadata-free JPEG, at most 60k data-URL characters each and 300k across trips; refuse trip edits exceeding the 1 MB private JSON limit. Keep images in private household JSON, never public uploads.
- Schema 7 adds trips; effective income/rules and financial records remain unchanged. Trip plans/allocations use existing three-way plan conflicts, including concurrent allocations to different goals. Remote recovery archives missing local goals with zero allocation while preserving IDs/labels. Keep stable labels during local writes and sync.
- Add two goals to the isolated sample household. Verify date/night math, reservations/purchases/reversals/shortfall, migration, concurrent sync, photo persistence, labels/filters, 320-pixel layout and offline goal creation.

## Current refinement — income, investments and sample charts

Owner confirmed equal contributions based on the lower income, with leisure staying personal.

- Save both members’ regular net monthly incomes in Settings by effective month. Display selected-month × 12 estimated annual income individually and for Household in the first Investments panel.
- Add a bank/building icon to navigation. The second Investments panel shows a house-price range and sensitivity to rates; budget and rate/purchase assumptions are collapsed. Defaults: net income × 30–35%, subtract €350–500 ownership costs, 3–5% interest, 30-year full repayment, zero cash and editable 10% purchase costs. Include other debts. Price is (annuity loan + cash) / (1 + cost rate). State financing-gap assumptions; this is a scenario, not lender eligibility.
- Optional Monthly plan income rule: 50/30/20 or custom percentages summing to 100%. Each person's shared operating/savings contributions use the minimum income’s percentage, rounded down to cents. Leisure is a personal reference only. Display recurring operating shortfall/headroom, including the zero-income case. Keep the existing recurring/fixed method as default.
- Effective-month income/rule histories carry forward, derive historical chart goals and never rewrite captured confirmations or create funds. Schema 6 retains all confirmations/retractions/ledger and credentials. Sync treats income and rules as plan settings with explicit competing-edit conflicts.
- Provide deterministic fictional JSON (Jan 2025–Nov 2026), with pay rises, seasonal/category spending, missed funding and savings movements. Settings opens `?demo=1`, an in-memory household with no mounted sync adapter, household database access or token restoration. Reload resets it. Precache its lazy chunk so first-use sample charts work offline.
- Verify annuity/zero-interest/cost math, custom/zero income, migration, historical goals, sync, phone widths, income/affordability persistence and isolation of sample edits.

## Current refinement — retractable funding confirmations

- Tap your confirmed operating/savings checkmark to retract it, with a confirmation prompt. Restore the pending checkmark, subtract that contribution from recorded funds and chart series, and retain the original with a Retracted caption under Fund activity.
- Keep fund/member controls independent; automatically satisfied zero shares are not retractable financial records. The device-selected trust identity can retract only its own confirmations.
- Reconfirm later using the current target in a new immutable generation. Retraction restates the original contribution period, rather than fabricating a current withdrawal. Existing purchases, payments, movements and debt remain recorded, even if the resulting fund balance is negative.
- Schema 5 adds canonical retraction records and confirmation generations. Retractions merge independently, so stale offline devices cannot restore them and an old retraction cannot cancel a newer generation. Preserve originals and retractions through plan recovery and local saves.
- Verify cancel/retract/reconfirm, reload/offline persistence, unaffected other fund/member, chart totals, legacy migration, retries/concurrent retractions and stale-device sync.

## Authorized compact UI and independent funding pass

- Basic expense entry contains quick setup, description, amount, category and labels. Defaults split only the two members. Advanced options contains dates, payer, source/fund, participants and split methods. Quick setups support both payer perspectives while preserving the recorder identity.
- Balances and personal history effects show signed cyan credits and orange debts. Each history row contains description and personal amount; Details holds full amounts, date, split, audit and reversal/correction actions. Filters collapse separately. Actual category charts show bars only.
- Remove both fund progress bars. Show cumulative operating/savings balances and per-member, per-fund monthly checkmarks. Confirm operating and savings independently; zero responsibility is automatically satisfied without synthetic transfers. Capture fund-specific confirmed amounts and retain them after plan edits. Default planning stays 50/50; unequal responsibilities are future effective-month settings.
- Fold the old redundant member transfer section into Fund activity. Add immutable movements between operating/savings or out of tracked funds; they change balances without spending/debt. Purchases and household repayments can choose a fund under Advanced options. Savings availability subtracts recorded spending, outgoing transfers and withdrawals, adding incoming funds. Negative balances reflect records instead of silently deleting transactions.
- Migrate v2/v3 funding records to schema4 IDs `month:member:fund`; preserve ledger events, revision/baseline, credentials and appearance. Independent fund confirmations and UUID movements union safely offline; same-ID monetary conflicts remain blocked.

## Current refinement — funding comparisons, pie chart and monthly panels

- Monthly plan contains distinct recurring-expense, fixed-savings and contribution-summary panels, sharing one atomic Save monthly plan and existing unsaved-change protection.
- Overview category spending is an SVG pie with a category/amount/percentage legend, including a proper full circle for one category and the existing empty state. Existing history filters and device colors remain shared.
- Replace the separate operating-budget chart choice with overlaid fund views. Savings and operating charts show available cumulative funds, confirmed contributions in the month ending the interval, and that month's goal. The legend/status and exact-value table show all three without confusing expenditure with a missed contribution. Monthly funding resets each month; money carries forward. Yearly/weekly points keep their explicit ending-month funding convention.
- Enable right value-axis vertical drag on mouse and touch. The renderer requires vertical touch handling for this gesture; enable it only when a gesture begins on the right axis so ordinary plot swipes still scroll the page. Reset value scale/All restore auto scaling. Preserve horizontal pan, pinch zoom and keyboard navigation.
- Schema 4 financial records and credentials remain unchanged. Funding comparisons are derived fields, not additional financial entries.

## Authorized historical chart explorer and overview refinement

The owner explicitly requested implementing this pass now. Top navigation is Home → Calendar/Monthly plan → Charts → Settings, using labeled icon buttons. Fund numbers are centered in their value area, with small monthly total/own-share captions above checkmarks and concise confirmations. Remove the duplicate “Your balance” summary. History and current category spending each occupy their own section panel.

Charts use bundled TradingView Lightweight Charts with only line/histogram rendering, touch horizontal pan/pinch zoom, hover/hold inspection, keyboard navigation, D/W/M/Y intervals, zoom buttons and All fit. Advanced options contains dates, expense category, grid and exact values. No candles, trading tools, market data requests or invented sample transactions. Preserve the owner's appearance palette and light/dark support; publish required library notices/licenses and precache the lazy chart chunk for first-use offline access.

- Actual expenses sum per interval/category. Exclude settlements, fund movements and reversed expenses.
- Savings and operating availability carry all earlier fund changes into the range and sample cumulative values at interval end. Include withdrawals, account-specific purchases/repayments, movements and operating liability reserves. Reconcile to Overview at month end.
- Operating budget samples the **monthly** target at interval end, including forecasts; yearly aggregation does not add balances or imply annual spending. Weeks start Monday; range boundaries can produce partial periods.
- Use confirmation dates inside their planning month, clamping early/late dates to that month’s boundary, in Europe/Busingen. This explicit date convention preserves the current monthly contribution contract. Reversals restate original periods.
- Keep schema 4, financial history, tokens and device identity unchanged. This pass only derives chart data and changes presentation.

Verification: financial aggregation/rounding/carryover/reversal/time-boundary tests, desktop/Android UI, native phone pinch/wheel/keyboard navigation, narrow/light layouts and offline first-visit chart loading. Actual physical-phone feedback remains owner review.

## Authorized expense and settlement pass

The owner approved implementing shared expense entry, debt netting, repayments, immutable corrections, offline synchronization, actual spending charts and device identity in Settings. This explicitly spans the relevant portions of earlier ledger/reimbursement/reporting milestones; it does not authorize bank automation or unrelated goals/month-close features.

- Model exactly three parties: member A, member B and Household. Expenses credit the funding party and debit the beneficiaries; net balances sum to zero. Equal, exact-amount and percentage splits use integer cents/basis points with deterministic largest-remainder rounding. Keep categories and labels separate from recurring forecasts.
- Keep personal advances distinct from existing household funds. Record full/partial repayments without creating expenses. Derive the minimum one/two payments from net debt for these three parties; support remaining bilateral debts when the actual payment differs from the simplified route.
- Recorded operating funds accumulate confirmed contributions through the selected month, subtract household-funded purchases and outgoing repayments, add incoming repayments, then reserve net household liabilities. Savings accumulate confirmed contributions separately. Monthly transfer status and funding progress retain their selected-month meaning. Debt carries across months.
- Append immutable expense, settlement and reversal events with stable UUIDs, effective date, creator identity and timestamp. Corrections append an original-period reversal and replacement. Never remove/edit financial history. Recorders use device-selected identity under the cog Settings menu, explicitly trust-based.
- Union independent offline financial events and deduplicate retries by immutable ID. Block changed payloads, competing corrections to the same expense and concurrent repayments that overpay the merged debt; preserve both copies and require reversal of an incorrect payment before retry. Plan recovery retains events. Existing revision/SHA protection still applies.
- Collapse detailed history and actual category bars under the balances section. Date, party and category filters affect reports without hiding outstanding all-time debt. Reuse the owner's palette; retain Android touch targets, narrow-screen layouts and accessible labels.

Validation includes domain conservation/rounding/funds/corrections, schema upgrades, sync conflicts, desktop/Android workflows and production-PWA offline/two-device sync. Actual private-repository pairing and physical-phone testing remain owner checks.

## Architecture decision — 2026-11-17

Accepted by the owner: follow the architecture already used in `nunz-app`.

- `family-app` is a **public** source repository. GitHub Pages serves the installable React/TypeScript PWA over HTTPS. Published files contain no household records or credentials.
- `family-data` is a **private** repository storing versioned JSON. Devices call GitHub's REST Contents API directly; no production Fastify, SQLite, VPN, application server, passkey service or server sessions are required.
- IndexedDB holds local drafts and their last synchronized baseline. Saving works offline. Synchronization runs while the app is open, on reconnect/focus, periodically, and on request. Closing the app does not guarantee background sync.
- Each device uses a separate expiring fine-grained personal access token restricted to `family-data`, with Contents read/write and implicit Metadata read. Enter tokens only in the PWA. Match `nunz-app`: verify private-repository access, then save the token in a separate device-only IndexedDB database, restore it on app start and remove it on disconnect. Never include saved tokens in household JSON, exports or the public build.
- Check repository visibility before any private read/write. Reject public data repositories. Tokens never enter source, build variables, URLs, exports, logs or synchronized JSON. Private JSON is readable to GitHub and repository collaborators; this is not end-to-end encryption. Scripts on the same web origin can access local records and active credentials. Other project Pages sites under the same `owner.github.io` share that origin.
- **Superseded by schema v9 above:** Store one schema-versioned JSON document per monthly draft at `budgets/YYYY-MM.json`. Compare the last synchronized draft with GitHub before writing, then pass the current blob SHA as a compare-and-swap guard. Different months synchronize independently; divergent edits to the same month require review. Never silently overwrite monetary edits.
- A lost response is reconciled by comparing remote content to the pending local draft. Malformed/unknown schemas, authorization failures, deleted remote files and write races preserve local changes. Git history helps recovery but independent JSON backups are still needed.

This supersedes the VPN/Fastify/SQLite/passkey production topology in the original local specification `family_manager_v1_plan.md` and ADRs 002–005. The legacy API remains a development reference; existing SQLite drafts are not automatically migrated or deleted.

The owner confirmed branch deployment matching `nunz-app`: use **main / (root)**. Run `npm run build:pages` and commit generated static files with source changes; `.nojekyll` disables Jekyll processing. CI checks artifact freshness. This supersedes the initial custom Actions deployment choice.

## Implementation sequence

1. Publish this architecture decision and README update to the current `family_manager` remote.
2. Implement static browser persistence, a PWA manifest/icons and versioned shell cache, GitHub synchronization with visible pending/error/conflict status, JSON export and explicit remote recovery, and a branch-published Pages build. Verify and push this implementation separately.
3. Owner creates `family-app` (public) and `family-data` (private, initialize with a README/main branch). Configure Pages to deploy from `main` / `(root)`, publish the source and root static build to `family-app`, then pair two devices using separate tokens. Verify actual private API access, installation, offline relaunch, and concurrent editing on the deployed origin.
4. Continue the financial milestones after owner review: immutable balanced ledger, reimbursements, savings goals, recurring costs, reporting and month close. Preserve integer cents, deterministic rounding, explicit planned/earmarked/paid/owed states and correction history.

The owner explicitly authorized beginning the architecture implementation while M0 visual acceptance remains pending. This does not imply acceptance of other milestones. The first sync slice covers monthly proposals, not real financial postings. The authorized expense pass implements stable operation IDs, immutable events, idempotency and validation; mutable plan replacement never applies to posted entries.

## Review gates

**Earlier architecture slice (superseded for data shape by v2 above):** device draft storage and revisions, per-month GitHub adapter, visible sync status/recovery/export, build-generated PWA cache and manifest/icons, and a committed root Pages build are implemented. Live GitHub pairing and real phone installation remain pending owner setup. Synchronization currently processes the selected month; opening another month processes its pending draft. Export covers one saved month; JSON import/merge and SQLite migration are deferred.

- A static production build works at `/family-app/` without an API server.
- Saved proposals survive offline reload; invalid input and stale local writes are rejected.
- Fresh devices can pull a draft; pending local changes survive errors and divergent remote changes; UTF-8 names round-trip correctly; tokens never appear in exports.
- The app distinguishes device-only, pending, synchronized, failure and conflict. Remote recovery requires an explicit warning and export option.
- GitHub setup and the real two-device drill remain required before claiming deployment readiness.

References: [GitHub Contents API](https://docs.github.com/en/rest/repos/contents), [fine-grained tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
