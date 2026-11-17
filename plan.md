# Family Manager implementation plan

## Current product rules — 2026-11-17 owner feedback

- Overview contains confirmed operating/savings funds and member transfer status. All plan definition belongs to Monthly plan; connection and member setup belong to Settings.
- Operating targets equal the sum of monthly recurring payments due in that month. Each schedule has a custom name, amount in cents, first due date, category and labels. Repeat monthly until archived or through an inclusive end date. Clamp month-end due dates; retain archived schedules and historical months.
- Savings are a fixed monthly amount with effective-month history, carrying forward until changed. The contribution split is always 50/50; allocate rounding cents deterministically while balancing both envelopes and the combined target.
- Only a member's explicit declaration adds that member's full operating/savings share to the month's confirmed funds. One immutable confirmation per member/month; no bank verification or separate member authentication is claimed. Later CSV/bank/PayPal matching may verify declarations. Corrections, partial confirmations/top-ups and actual spending entry remain future work.
- The owner explicitly authorizes this product slice across the earlier milestone boundaries; it is awaiting review, not blanket acceptance of other features.

## Current storage and synchronization — schema v2

`household.json` is the authoritative private GitHub document for the entire household, replacing per-month draft synchronization below. It contains recurring schedules, effective-month savings targets, member names, immutable transfer confirmations and preserved legacy targets. IndexedDB `family-manager-v1` upgrades to version 2, adding a household store while leaving old budget rows intact. Old private monthly JSON is imported on first connection when no v2 household exists; old files are not deleted. Manual legacy operating targets do not invent recurring expenses or funds.

Independent confirmations merge by stable `month:member` ID; identical amounts deduplicate, conflicting amounts stop synchronization. Competing plan settings use three-way conflict detection. Remote recovery retains local confirmations, and local persistence rejects changing/removing recorded transfer amounts. SHA-protected writes and idempotent content reconciliation remain mandatory. This is a declaration record, not the future full expense ledger.

## Architecture decision — 2026-11-17

Accepted by the owner: follow the architecture already used in `nunz-app`.

- `family-app` is a **public** source repository. GitHub Pages serves the installable React/TypeScript PWA over HTTPS. Published files contain no household records or credentials.
- `family-data` is a **private** repository storing versioned JSON. Devices call GitHub's REST Contents API directly; no production Fastify, SQLite, VPN, application server, passkey service or server sessions are required.
- IndexedDB holds local drafts and their last synchronized baseline. Saving works offline. Synchronization runs while the app is open, on reconnect/focus, periodically, and on request. Closing the app does not guarantee background sync.
- Each device uses a separate expiring fine-grained personal access token restricted to `family-data`, with Contents read/write and implicit Metadata read. Enter tokens only in the PWA. The initial implementation keeps them in memory until reload/disconnect; durable credential storage is deferred.
- Check repository visibility before any private read/write. Reject public data repositories. Tokens never enter source, build variables, URLs, exports, logs or synchronized JSON. Private JSON is readable to GitHub and repository collaborators; this is not end-to-end encryption. Scripts on the same web origin can access local records and active credentials. Other project Pages sites under the same `owner.github.io` share that origin.
- **Superseded by schema v2 above:** Store one schema-versioned JSON document per monthly draft at `budgets/YYYY-MM.json`. Compare the last synchronized draft with GitHub before writing, then pass the current blob SHA as a compare-and-swap guard. Different months synchronize independently; divergent edits to the same month require review. Never silently overwrite monetary edits.
- A lost response is reconciled by comparing remote content to the pending local draft. Malformed/unknown schemas, authorization failures, deleted remote files and write races preserve local changes. Git history helps recovery but independent JSON backups are still needed.

This supersedes the VPN/Fastify/SQLite/passkey production topology in the original local specification `family_manager_v1_plan.md` and ADRs 002–005. The legacy API remains a development reference; existing SQLite drafts are not automatically migrated or deleted.

The owner confirmed branch deployment matching `nunz-app`: use **main / (root)**. Run `npm run build:pages` and commit generated static files with source changes; `.nojekyll` disables Jekyll processing. CI checks artifact freshness. This supersedes the initial custom Actions deployment choice.

## Implementation sequence

1. Publish this architecture decision and README update to the current `family_manager` remote.
2. Implement static browser persistence, a PWA manifest/icons and versioned shell cache, GitHub synchronization with visible pending/error/conflict status, JSON export and explicit remote recovery, and a branch-published Pages build. Verify and push this implementation separately.
3. Owner creates `family-app` (public) and `family-data` (private, initialize with a README/main branch). Configure Pages to deploy from `main` / `(root)`, publish the source and root static build to `family-app`, then pair two devices using separate tokens. Verify actual private API access, installation, offline relaunch, and concurrent editing on the deployed origin.
4. Continue the financial milestones after owner review: immutable balanced ledger, reimbursements, savings goals, recurring costs, reporting and month close. Preserve integer cents, deterministic rounding, explicit planned/earmarked/paid/owed states and correction history.

The owner explicitly authorized beginning the architecture implementation while M0 visual acceptance remains pending. This does not imply acceptance of other milestones. The first sync slice covers monthly proposals, not real financial postings. Future ledger sync needs stable operation IDs, immutable events, idempotency and validation; do not generalize mutable draft replacement to posted expenses.

## Review gates

**Earlier architecture slice (superseded for data shape by v2 above):** device draft storage and revisions, per-month GitHub adapter, visible sync status/recovery/export, build-generated PWA cache and manifest/icons, and a committed root Pages build are implemented. Live GitHub pairing and real phone installation remain pending owner setup. Synchronization currently processes the selected month; opening another month processes its pending draft. Export covers one saved month; JSON import/merge and SQLite migration are deferred.

- A static production build works at `/family-app/` without an API server.
- Saved proposals survive offline reload; invalid input and stale local writes are rejected.
- Fresh devices can pull a draft; pending local changes survive errors and divergent remote changes; UTF-8 names round-trip correctly; tokens never appear in exports.
- The app distinguishes device-only, pending, synchronized, failure and conflict. Remote recovery requires an explicit warning and export option.
- GitHub setup and the real two-device drill remain required before claiming deployment readiness.

References: [GitHub Contents API](https://docs.github.com/en/rest/repos/contents), [fine-grained tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
