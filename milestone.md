# Milestones and owner review gates

**2026-11-17 owner direction:** Implement the public Pages PWA / private GitHub JSON architecture now, using `nunz-app` as reference. This explicitly authorizes the architecture slice spanning the former M1/M7/M8 boundaries while M0 feedback stays pending. See [plan.md](plan.md); legacy VPN/passkey/server requirements below are superseded for production. Other financial milestones still require owner review.

Each milestone ends with working software, verification evidence and a concrete review walkthrough. **Only the owner can accept a milestone.** Passing tests is not approval. Record their genuine feedback here, resolve requested changes, and get explicit acceptance before beginning the next milestone. Do not infer approval from silence.

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
