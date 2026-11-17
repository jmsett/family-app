# Milestones and owner review gates

## Shared expenses and settlements — current review slice

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
