# Milestones and owner review gates

## Recurring corrections and deletion — current review slice

**Status: implemented; local verification passed, owner review pending.** Owner requested edit scopes from the selected month onward or across all history, and full deletion of recurring planning history.

- Monthly plan Manage exposes Edit, Archive and Delete; changes stage until the atomic plan save. Edits cover name, amount, due day, category, labels and end date. Unfinished edits protect navigation.
- Schema 9 snapshots preserve earlier months for forward edits or replace the full timeline for retroactive corrections. Historical target charts follow those versions; archive boundaries, captured funding and actual ledger records remain intact.
- Confirmed deletion removes the schedule and all versions from historical budgets. Git history/exports may still hold older copies. Existing three-way sync conflicts prevent stale monetary-only uploads from restoring deleted schedules; competing plan edits require review.
- Verification passed: type checking, lint, build, formatting, 108 unit/API/domain/sync tests, 48 desktop/Android workflows and six production PWA cases. Coverage includes scopes/version replacement, invalid inputs and bounds, historical charts, retained money/ledger, archived editing, deletion, offline reload and correction/deletion syncing to a second device. Actual phone and private-repository interaction remain owner review.

Try: Monthly plan → choose month → Manage → Edit → choose scope → Apply edit to plan → Save monthly plan. Use Manage → Delete, then Save, to remove that schedule from all months.

## Travel goals from joint savings — earlier review slice

**Status: implemented; local verification passed, owner review pending.** Owner requested an airplane submenu and clarified one progress bar, funded from joint savings.

- The **+** button creates a trip panel with name, stable expense label, optional dates or estimated duration, food per person, shared hotel/night, return flights/person and a separate planned other-expenses lump sum plus 15%/custom contingency. Show a large funded percentage, single appearance-aware savings bar, remaining budget and indicative monthly saving pace.
- Reserve confirmed savings without moving cash or double counting across goals. Tagged savings purchases consume a reserve once; reversals restore it. Personal/operating purchases remain separate. Show any later reservation shortfall. Archive releases and preserves history; restore supported.
- Destination uploads become small metadata-free JPEGs in private JSON, with photo/document size limits. Expense labels/filter shortcuts survive renaming and archiving. Schema 8 migrates existing trips with zero planned other expenses, preserving their budgets, allocations, income, confirmations, credentials and history; concurrent trip-plan/earmark edits require review.
- Two fictional trips join the isolated sample household. Verification passed: type checking, lint, build, formatting, 101 unit/API/domain/sync tests, 44 desktop/Android browser workflows and six production PWA cases. Coverage includes reserves/purchases/reversals/shortfall, migration/conflicts, photos/layout/filter/archive, offline trip creation and synchronization to a second device. Actual phone/private repository use remains owner review.

Try: Travel → + → enter a trip, allocate joint savings, upload a destination photo and use Expenses to inspect trip-labelled spending. Archive to release the earmark while retaining history.

## Income funding and Investments — earlier review slice

**Status: implemented; local verification passed, owner review pending.** Owner confirmed the equal lower-income rule and requested income, home affordability and realistic chart data.

- Effective-month net incomes in member settings; Investments icon/page with individual/household annual estimates (monthly × 12).
- Collapsed home budget/rate inputs, annuity repayment and cash/purchase costs, conservative/optimistic price and rate-sensitivity visualization. Defaults follow the requested income caps/costs/rates, with 30 years, zero cash and editable 10% purchase costs. Scenarios remain device-local and never move funds.
- Optional 50/30/20/custom income percentages: equal fund contributions based on lower income; leisure stays personal. Zero-income and recurring-cost gaps stay visible. Schema 6 preserves fixed-mode history, captured confirmations/retractions, credentials and appearance.
- Fictional JSON with 23 months, 247 ledger entries and 91 confirmations. Isolated sample mode supports chart testing without accessing the household database or GitHub credentials; edits reset on reload.
- Verification passed: type checking, lint, build, formatting, 92 unit/API/domain/sync tests, 40 desktop/Android browser workflows and six production PWA cases. Coverage includes annuity/zero-interest/cost math, effective-month rules, migration, sync conflicts, 320-pixel layouts, offline scenarios, first-use offline sample charts and unchanged real household storage after sample edits. Physical-phone and private-repository behavior remain owner review.

Try: enter incomes under Settings, choose an effective month, open Investments, then explore Monthly plan → Funding rule. Open Settings → Sample household to test populated charts separately.

## Retractable funding confirmations — earlier review slice

**Status: implemented; local verification passed, owner review pending.** Owner requested undoing a mistaken funding confirmation by tapping its checkmark again.

- Own confirmed checkmarks open a concise retraction prompt; cancelling preserves the record, accepting restores pending status and removes that contribution from funds and chart totals. The other fund/member is unaffected. Confirm again later using the current share.
- Fund activity preserves the original amount and marks it Retracted. Schema 5 adds immutable retractions and confirmation generations; migrations preserve old money/history and existing device credentials.
- Canonical retractions survive stale-device uploads and plan recovery; old retractions cannot cancel newer confirmations. Duplicate retries merge, while conflicting amounts remain review conflicts.
- Verification passed: type checking, lint, build, formatting, 83 domain/API/sync tests, 36 desktop/Android workflows and six production PWA cases, including offline retraction/reload and two-device stale confirmation/reconfirmation. Physical phone/private-repository checks remain owner review.

Try: confirm both funds; tap the operating checkmark and cancel, then accept. Operating funding should return to pending while savings stays confirmed. Reload, confirm operating again, and expand Fund activity to see the retained Retracted original.

## Funding comparisons, value-axis touch scaling and category pie — earlier review slice

**Status: implemented; owner review pending.**

- Monthly plan now separates recurring costs, fixed savings and contributions into distinct panels with one save.
- Savings and operating charts overlay available funds, confirmed monthly contributions and the monthly goal, with matching legend/status/table. Spending does not undo recorded funding; monthly comparisons reset while balances carry forward. The standalone budget selector is removed.
- Native right-axis vertical dragging works on desktop and Android emulation without scrolling the page or changing time bounds. Plot swipes retain page scrolling. Advanced Reset value scale and All restore auto fitting.
- Overview category spending uses the device palette in an SVG pie with exact values/percentages, including single-category, filtered and empty states.
- Verification: 77 domain/API/sync tests, 34 desktop/Android workflows and six production PWA cases. New coverage checks funding versus spending, month resets/carryover, annual endpoint semantics, planning separation, right-axis gestures/reset, and pie totals/filters at 320 pixels. Actual phone interaction remains owner review.

## Historical explorer and overview refinement — earlier review slice

**Status: implemented; owner review pending.** Owner requested starting the historical explorer alongside the overview refinements.

- Icon navigation: Home, Calendar/Monthly plan, Charts, Settings. Remove duplicate personal balance; mark the device member “you”. Center fund values in their value row, show monthly total/your-share captions, shorten transfer confirmations and separate history/category panels.
- Explorer: actual expenses/category totals, cumulative savings, operating availability and monthly operating targets; D/W/M/Y intervals, line/bars, native pinch/pan, wheel zoom, crosshair, keyboard, zoom buttons and All fit. Advanced options hides dates/category/grid/exact values. Existing device colors/light theme apply.
- Dated fund changes include opening balances, withdrawals, movements, account-specific purchases/repayments and operating liability reserves. Original-period reversals and assigned-month confirmation dates reconcile to Overview. Budget targets are distinct from actual spending or balances.
- Schema 4 and saved credentials/history are preserved. The lazy chart chunk and attribution/license assets are precached, including first-visit offline chart use.
- Verification: 76 domain/API/sync tests, 30 desktop/Android workflows and six production PWA cases. Tests cover totals, reconciliation, category filters, leap/year/week boundaries, partial periods, native phone pinch, narrow/light layouts, invalid ranges and offline charts. Physical Android use remains owner feedback.
- Dependency audit: the chart renderer adds two runtime packages. npm reports 11 pre-existing development-only findings through the picomatch ReDoS advisory; neither new chart package is implicated. The suggested fix would downgrade unrelated tooling, so that change is outside this pass.

## Compact expenses and independent fund confirmations — earlier review slice

**Status: implemented; owner review pending.** Owner approved this pass and selected the historical chart explorer as the next separate step.

- Basic expense form contains only quick setup, description, amount, category and labels; both members’ payer perspectives are supported, with advanced split/account settings collapsed.
- Signed JML cyan/orange balances and personal history effects; per-entry Details and section Filters are collapsed. Category charts show bars only.
- Cumulative fund cards show independent monthly operating/savings checkmarks. Zero shares are automatically not required without fabricated contributions. Existing combined confirmations migrate to schema4 member/month/fund records.
- Fund activity replaces duplicate transfer status and supports immutable operating/savings movements and withdrawals. Savings-funded purchases/repayments affect the selected account once; transfers never inflate expenses or debt.
- Verification: 69 domain/API/sync tests, desktop/Android workflows, production offline and mocked GitHub synchronization; actual phone use and live private-repository behavior remain owner review checks.

**UI refinement:** Payment suggestions now start inside collapsed Settle up. History adds a small payer/total caption, keeps complementary information under Details and removes the duplicate final divider. Fund amounts are centered while captions remain in place.

**Superseded next step:** The historical chart explorer is implemented in the current review slice above. Configurable unequal responsibilities remain future work.

## Shared expenses and settlements — earlier review slice

**Status: implemented; owner review pending.** Authorized by “Ok, go ahead” after the expense/settlement proposal.

- Overview: recorded funds, Balances & settlements, then Member transfers. Expense entry supports equal/exact/percentage splits, quick setups, categories and labels across A/B/Household. Net suggestions minimize payments; full/partial repayments are separate from spending.
- Personal advances reserve household liabilities; existing household-funded purchases reduce the pool without duplicate reimbursement. Contributions/funds and outstanding debt carry forward; monthly funding status remains separate.
- Immutable UUID events retain originals, actors/timestamps and original-period reversals/corrections. Independent offline entries merge; concurrent overpayments and payload conflicts stop for review. Recovery cannot discard financial events. Schema-v2 household data upgrades to v3.
- The top-right Settings cog contains device-only “I am”. History and actual category charts collapse to keep Android Overview compact, using the existing palette and date/person/category filters.
- Verification: 61 unit/API/domain/sync tests and 18 desktop/Android browser workflows pass locally. Production PWA checks cover offline reload, two-device expense merging, repayment synchronization, exports and saved-token behavior. Live private-repository pairing and actual Android interaction remain owner review steps.

Try: select identity under the cog; add an €80 equal dinner, record a €15 partial repayment, correct the expense to €100 and check €35 outstanding with €100 actual spending. Separately record an €80 personal household advance, then repay it: operating availability must not decrease twice. Switch months and verify debt carries; close/reopen all PWA windows to receive the update.

**2026-11-17 owner direction:** Implement the public Pages PWA / private GitHub JSON architecture now, using `nunz-app` as reference. This explicitly authorizes the architecture slice spanning the former M1/M7/M8 boundaries while M0 feedback stays pending. See [plan.md](plan.md); legacy VPN/passkey/server requirements below are superseded for production. Other financial milestones still require owner review.

## Android installation identity fix

Owner reported “already installed” after removing Family to refresh its icon. Found that Family and Nunz both advertised `id: "./"`, resolving to the same origin-root identity. Family now uses `/family-app/` explicitly for identity, launch and scope; Nunz remains untouched. Production browser checks assert identity and offline behavior. Do not clear shared-origin browser data or delete another app to work around this collision. Physical Android reinstall must be verified by the owner.

## JML branding and Afterglow appearance — current review

Owner requested the supplied Multicolor JML logo, its palette and all effects from the Afterglow reference, particularly Electric halo. Header/favicon/PWA icons now use that artwork. Appearance settings include Dark/Light/Device themes, four Afterglow effects plus Solid, palette presets and custom accent/gradient/chart colors, glow, speed, motion and preview controls. Preferences persist per device; reset does not affect household records or sync credentials. Confirmed-fund bars use the chosen style, with no fill for unconfirmed funds. Goal tracking/actual analytics remain future work; previews are explicitly samples. Desktop and Pixel 7 browser checks cover persistence, real bar colors and reduced motion.

## Remembered GitHub connection — current update

Owner requested parity with Nunz: validate private-repository access, then remember the token in a separate device-only IndexedDB store and reconnect on app reopen. Disconnect removes the stored token without deleting household records; other open app tabs are notified. Credentials never enter exported or synchronized JSON. Browser tests cover reload/reconnect, disconnect/reload, rejected tokens and credential exclusion from backups/uploads.

## Recurring planning and trust confirmations — earlier review slice

**Status: implemented; owner review pending.** The owner requested separate Overview/Monthly plan screens, operating budgets derived from recurring expenses, fixed savings and 50/50 contributions. This explicitly authorizes the relevant planning, recurring and confirmation work across earlier milestone boundaries.

- Overview shows only member-confirmed operating/savings funds and confirmation status; Monthly plan contains target definition; Settings contains names and sync/backups.
- Recurring schedules include name, monthly amount, due/end dates, category and labels; archives retain earlier history. Savings carry effective-month history.
- Full member/month declarations are immutable and self-reported. They merge across offline devices without double counting; plan conflicts remain explicit. Corrections/top-ups, CSV verification, actual expenses and charts are future work.
- Schema-v2 `household.json` synchronizes the entire household. Browser and private legacy drafts migrate without deletion, fabricated expenses or confirmed funds.
- Verification: 50 unit/API/protocol/domain tests, eight desktop/Android planner/migration cases and four production PWA/offline/sync cases pass locally. Actual private-repository pairing remains unverified.

## Earlier architecture slice — Pages PWA and private JSON

**Historical slice:** deployed on Pages; owner confirmed phone installation. Its per-month storage below is superseded by schema v2 above. Private-repository pairing and owner review remain pending.

- Browser monthly drafts use IndexedDB with atomic revision checks; the production browser no longer requires the API.
- Manifest, PNG icons, scoped build-versioned shell cache and a committed root build for Pages branch deployment are included.
- The original memory-only token connects to private `jmsett/family-data`, with per-month schema validation, SHA write protection, pending/error/conflict status, JSON export and confirmed remote recovery.
- Sync is limited to the selected monthly proposal while the app is open. This is not the future financial ledger sync implementation.
- Follow README GitHub setup, test installation on both phones, edit offline and verify conflicts before using household data. No live tokens or private records were used in development.

**Verification:** `npm run check` covers type checking, lint, 35 domain/API/GitHub protocol tests, build and formatting. Six planner browser cases and four production PWA cases pass in desktop/mobile Chromium. Production cases exercise `/family-app/`, offline reload/save, two isolated devices, remote pull/push, divergent edits, JSON export and explicit recovery. Live GitHub API access, remote workflow results and installation on actual phones remain unverified.

Each milestone ends with working software, verification evidence and a concrete review walkthrough. **Only the owner can accept a milestone.** Passing tests is not approval. Record their genuine feedback here, resolve requested changes, and get explicit acceptance before beginning the next milestone. Do not infer approval from silence.

**Hosting correction:** Owner confirmed the same branch deployment used by `nunz-app`. Use `main` / `(root)` with the generated static build committed alongside source. The custom Actions deployment is removed; CI verifies artifact freshness.

## M0 — Foundation and monthly planning

**Status: implemented; awaiting owner feedback.**

- [x] React/TypeScript + Fastify monorepo with shared contracts and domain rules.
- [x] SQLite schema migration, persistent monthly draft and append-only draft revisions.
- [x] Reviewable responsive overview and planning form; exact operating/savings and member targets.
- [x] Money validation, deterministic rounding and stale-write rejection.
- [x] Local runtime isolation, Docker configuration, checks and CI.
- [x] Architecture decisions and API contract documented.
- [ ] Owner reviews behavior and visual direction, requests changes or explicitly accepts.

### Try it

1. Follow the README, open localhost:5173. The initial €1,200/€200 proposal has €1,000 operating and €600 per person; recorded money is zero.
2. Name both members, set total to €1,000.01 and savings to €200. At 50/50, targets are €500.00 and €500.01. Save the draft, reload, select the same month and confirm it persists.
3. Adjust the split to 60/40. Change to a different month after saving; the earlier month's plan remains unchanged.
4. Set savings above total. Saving is blocked with an explanation. Neither a proposal nor a saved draft creates money or an expense.
5. Open the same month in two windows. Save a change in one, then try to save the stale version in the other: it must request a reload.

### Feedback needed

**2026-11-17 UI direction:** Owner requested a minimal desktop interface and efficient use of space, especially on Android. Replaced the sidebar and promotional copy with compact top navigation and target summaries, kept the planning form prominent, and collapsed sync setup/backups while preserving a visible status. Browser mobile projects now use Pixel 7 emulation. Layout checks at 320, 360, 412, 768 and 1280 pixels show no horizontal overflow with long names and maximum amounts; primary controls remain at least 48 pixels tall. Actual Android installation and owner visual acceptance remain pending.

- Is this calm overview useful, and does the plan versus recorded-money distinction make sense?
- Is explicitly marking money as earmarked the right default for M2?
- Should either member approve ordinary month-close/savings transfers, or should both approve? Any amount threshold?
- Confirm local PC + Tailscale as the first deployment target; the stable HTTPS hostname can be chosen during M1.

**Owner feedback:** Pending. **Acceptance:** Pending.

### Verification evidence

- Clean `npm ci` with the project-local Node 24 runtime succeeded; dependency audit: zero known vulnerabilities.
- `npm run check` passed: type checking, lint, 20 domain/API tests, production build and formatting.
- Six Playwright checks passed in installed Chrome, including a mobile viewport: save/reload, invalid savings and two-window stale-write conflicts.
- Inspected desktop/mobile screenshots; no horizontal overflow in the mobile check. SQLite restart persistence and integrity are covered by integration tests.
- Docker and real phone/VPN/passkey testing have not been run; Docker is unavailable here, and authenticated deployment belongs to M1. CI is configured; its remote result is not yet verified.

## M1 — Private household access

**Status: not started; requires M0 acceptance.** Invite-only two-member household, passkeys, multiple authenticators, recovery, secure sessions, membership authorization, basic installable PWA shell and stable private HTTPS setup.

**Review:** Both members sign in independently; unauthorized access fails; owner performs a recovery drill on their devices. Owner feedback and acceptance required.

## M2 — Virtual fund and ledger

**Status: not started.** Balanced immutable ledger, explicit commitment/earmark states, manual expenses/refunds, corrections, audit and monthly allocations.

**Review:** Record earmarking and expenses; compare dashboard with the plan's A01/A02/A07/A15 cases. Verify targets never create cash and corrections preserve history. Owner feedback and acceptance required.

## M3 — Reimbursements and personal splits

**Status: not started.** Household advances, direct/partial repayments, contribution offsets, personal debt splits and scoped external contacts.

**Review:** Try €80 advance → €30 repayment + €50 offset, and a separate €80 dinner split. Confirm no duplicate expense and no conflation of personal and household debt. Owner feedback and acceptance required.

## M4 — Savings and goals

**Status: not started.** General savings, goal photos/targets, member progress and envelope transfers.

**Review:** Move €100 from general savings to a goal; total household assets and expenses remain unchanged. Owner feedback and acceptance required.

## M5 — Recurring costs and organization

**Status: not started.** Recurring forecasts, subscription deadlines, single-confirmation actuals, categories/tags and basic trips.

**Review:** Forecast an annual charge and confirm it exactly once; filter an expense by category, two tags and a trip. Owner feedback and acceptance required.

## M6 — Analytics and month-end

**Status: not started.** Category/trend charts, budget comparisons, explained forecasts, close/rollover/reallocation with liabilities preserved.

**Review:** Reconcile reports to ledger totals and close a sample month with outstanding debt. Owner feedback and acceptance required.

## M7 — Offline PWA and multi-device sync

**Status: not started.** IndexedDB/outbox, idempotent server mutations, sync cursors and explicit conflict review.

**Review:** Two devices enter offline, retry identical IDs and conflict on the same financial record; no loss or double posting. Owner feedback and acceptance required.

## M8 — Deployment and recovery

**Status: not started.** Encrypted off-device backups, restore tests, export, private hosting guide, security/accessibility review and mobile trials.

**Review:** Restore DB/photos/access, recover a device, and run a household trial. Owner feedback and acceptance required before V1 production readiness is claimed.
