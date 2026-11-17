# Foundation decisions and API contract

## ADR 012: Separate PWA installation identity

Both Family and Nunz previously used manifest `id: "./"`. Unlike `start_url`/`scope`, a relative `id` resolves against the start URL's origin, so both advertised `https://jmsett.github.io/`. This can collide with an already installed application. Family now declares explicit `id`, `start_url` and `scope` values of `/family-app/`. Nunz is not modified. Keep this identifier stable across future icon and palette changes. The HTML links a versioned manifest URL so older workers bypass their previously cached manifest; the new worker normalizes query strings only for known built assets, keeping the versioned manifest available offline. Browser tests assert the resolved Family identity is `/family-app/`, not the shared origin root. No household, credential or appearance storage is cleared by this fix.

## ADR 011: JML / Afterglow visual preferences

The owner supplied `Multicolor JML Monogram App Icon.png` and the `afterglow-neon-pwa` reference. Package the existing artwork into 192/512 PNG icons plus a padded 512 maskable variant, without changing the original file. Use the same asset in the app header and favicon. The default interface is dark with the logo palette and Electric halo fills; Light and Device modes are available.

`appearance.ts` validates and persists device-only preferences under localStorage key `family-appearance-v1`, applies semantic CSS variables and adapts browser theme color. User-controlled colors are strict six-digit hex values; numeric effect settings are clamped. Accent button text chooses contrasting ink. `ProgressBar` is shared by actual confirmed-funding indicators and appearance previews; all styles/color stops/category palettes consume the same preferences. Zero confirmed progress renders no fill. Theme changes do not write to household JSON or the credentials database. Cross-tab storage events update preferences.

Effects derived from the reference are Electric halo, Liquid prism, Solar flare and Pixel rush, plus Solid. Glow, speed and motion are adjustable, with system reduced motion taking priority. Preview charts/goals are labeled sample data and do not imply implemented goal tracking or actual expense analytics. Preserving the existing compact Android layout and financial semantics is required.

## ADR 010: Remember device connections as Nunz does

Owner feedback requests the connection behavior already used by `nunz-app`. After validating private-repository access, store the token in database `family-github-device-v1`, store `secrets`, key `github-token`. This database is separate from household data and excluded from all sync documents, exports and public assets. Restore it on app start, allowing automatic foreground synchronization without re-entry. Disconnect deletes the saved token and preserves household records. Other open app tabs receive a credential-change notification without broadcasting the token itself.

This is browser storage, not an encrypted OS credential vault; same-origin scripts can access it. Expiration, revocation or clearing browser data requires reconnecting. Invalid tokens are not persisted. Existing household data/schema is unchanged.

## ADR 009: Recurring planning and trusted transfer confirmations

Owner feedback replaces the editable total allocation and configurable split with derived monthly operating costs, fixed savings and a 50/50 split. Recurring schedules store first due date, optional inclusive end date, archive effective month, category and labels. Savings targets carry effective-month history. Overview contains confirmed funds, while all target definition lives in Monthly plan.

The current record is `HouseholdPlan` schema 2 at private `household.json`. IndexedDB version 2 adds the `household` store, preserving old `budgets` rows. Migration preserves original manual drafts in `legacyDrafts`; operating targets are not converted into fake expenses. Existing savings targets carry forward as plans. When no remote household exists, the adapter migrates old private monthly JSON without deleting it. ADR 007's per-month data shape is superseded.

Confirmation IDs are `YYYY-MM:memberIndex`. Each member declares the full displayed operating/savings transfer once per month; captured amounts never change after plan edits. The client uses a self-selected member with a clear trust label, not authenticated member identity or bank evidence. Partial payments, top-ups, reversals and statement matching require future work. Forecast schedules do not post actual expenses.

Sync uses a three-way comparison of plan settings, unions immutable confirmations and deduplicates same-member/month declarations with matching amounts. Mismatched amounts require review. Remote recovery retains confirmations; the storage transaction rejects removing/changing recorded amounts. Whole-household exports include schedule/history/confirmation records, never credentials. GitHub's SHA guards concurrent writes. Actual immutable expense-ledger design remains future work.

## ADR 006: Public PWA and private GitHub JSON (accepted 2026-11-17)

The owner selected the existing `nunz-app` deployment pattern: public `family-app` on Pages, local IndexedDB and private `family-data` JSON synchronized through repository-scoped fine-grained tokens. [plan.md](../plan.md) is the current architecture and implementation sequence. This supersedes the production storage/authentication/hosting/backup choices in ADRs 002–005 below; those sections document the legacy local API prototype. Financial domain invariants in ADR 001 still apply. GitHub repository access replaces application sessions; repository collaborators can read all JSON, so per-member private records require a separate future design.

## ADR 007: Implemented device and GitHub draft contract

The static app uses IndexedDB database `family-manager-v1`, object store `budgets`, keyed by month. Each entry includes the current draft, last remote baseline, remote blob SHA and pending flag. Local compare-and-write uses one read/write transaction, preventing stale tab saves. Local revisions invalidate forms after remote replacement. A synchronization failure never clears pending changes.

Remote path: `budgets/YYYY-MM.json` on `main`; envelope `{ schemaVersion: 1, draft: BudgetDraft }`. The client validates the schema, selected month, integer amounts and names before applying records. Each cycle checks repository privacy. Updates recheck privacy and include GitHub's current SHA; divergent changes against the baseline require manual review. Matching local/remote content acknowledges a retry after a lost response. Deletion of a previously synchronized file is an explicit error.

Initially tokens lived only in component memory; ADR 010 supersedes that choice. No application login/passkeys or per-member data access controls are implemented. Repository scope grants access to all records; finer access boundaries need separate review. GitHub API responses bypass the service worker; only build-generated static assets enter its cache. Cache versions depend on build content, and scope-specific prefixes avoid deleting other applications' shell caches. IndexedDB remains shared by same-origin pages.

The API contract and decisions below describe the legacy server prototype. It remains available for development; the browser uses this device contract in production.

## ADR 008: Branch deployment matching Nunz

The owner chose **Deploy from a branch → main → /(root)**. `npm run build:pages` builds the PWA for `/family-app/` and copies browser-ready files from `apps/web/dist` into the repository root. `.pages-files.json` identifies generated artifacts, allowing the preparation script to delete obsolete build files while preserving source and documentation. `.nojekyll` bypasses Jekyll. Generated bundles are excluded from lint/formatting; CI rebuilds and checks their Git diff to catch stale public assets. GitHub's standard branch Pages workflow publishes the committed build. The custom Pages deployment workflow is removed. Only public app assets are copied; credentials and private repository data never enter the build.

## ADR 001: Virtual funds and money

Accepted for M0 implementation, subject to owner review. One household currency (EUR), two proposed contributors, Europe/Busingen timezone. Targets, commitments, self-reported earmarking, actual expenses, payables and forecasts are separate concepts. M0 implements **targets only**; recorded totals are explicitly zero, since no financial-entry capability exists yet. Never infer bank balances. General savings is included in the total allocation. Default categories: Groceries, Home & bills, Transport, Health, Leisure, Other.

Amounts are integer minor units, capped at €1,000,000 in the prototype. Decimal user input is parsed as strings, including comma decimal separators, without floating-point currency calculations. Shares use integer basis points summing to 10,000. Member A rounds down and B receives any remaining cent. Changing a monthly draft never changes another month.

## ADR 002: Ledger and storage boundary

SQLite is authoritative; React holds only current form state, with no offline cache yet. `budget_drafts` stores the current proposal; `draft_audit` appends each accepted revision in the same immediate transaction. Revision checks reject stale writes with HTTP 409. Drafts are editable proposals, not ledger transactions. Schema migration version 1 runs idempotently at startup; future migrations must be numbered, transactional and tested against existing versions.

M2 will add balanced, immutable ledger postings and corrections by reversal. Member-held household funds and personal advances must use distinct sources. Repayments settle liabilities, never create a second expense; savings transfers move envelopes, never create money. Financial idempotency and authorization must precede financial endpoints.

## ADR 003: Local boundary and planned sessions

M0 is an unauthenticated local planning prototype. Servers default to 127.0.0.1; API checks loopback Host values and allows writes only from configured local origins (nonbrowser requests without Origin are allowed). No permissive CORS. No LAN or VPN deployment until M1. In Docker the process binds all container interfaces, but Compose publishes the host port only to 127.0.0.1. This is a development boundary, not member authentication.

M1 will implement invite-only passkeys with a maintained WebAuthn library, server-side revocable sessions and Secure/HttpOnly/SameSite cookies, authorization on every household route and a tested recovery path. No default password or public signup. Two authenticators per member where feasible. Enrollment and recovery design must be reviewed before implementation is called ready.

## ADR 004: Stable HTTPS relying party

Keep localhost for same-computer development. Before phone enrollment, choose a stable private HTTPS hostname with the owner (prefer local PC + Tailscale Serve). RP ID must match that domain; migrations to a different RP domain require explicit re-enrollment planning. VPN presence never replaces app authentication. M0 does not register passkeys or cache financial data.

## ADR 005: Backup policy

Prototype drafts live in ignored `data/`. The volume is persistence, not a backup. Production backups in M8 must use SQLite online backup or VACUUM INTO, include controlled image uploads and schema metadata, encrypt archives, keep an off-device copy and test restore including login. Do not copy a running WAL-mode database as a single file. Avoid committing private plans, data, environment secrets or tool installations.

## M0 HTTP contract

All responses are JSON except static web files. All API data is development-only and unscoped until M1 adds membership.

| Method and path                    | Request                                                                                         | Success                                         | Failure                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| GET `/api/health`                  | None                                                                                            | 200: status, schemaVersion, mode                | 503/network if unavailable                             |
| GET `/api/workspace?month=YYYY-MM` | Optional month, defaults to current household month                                             | 200: Workspace (see shared TypeScript contract) | 400 invalid month; 403 unsupported Host                |
| PUT `/api/budget-draft`            | BudgetDraft: month, totalMinor, savingsMinor, two memberNames, firstMemberBasisPoints, revision | 200: Workspace with incremented revision        | 400 invalid input; 403 origin/Host; 409 stale revision |

An unsaved month has revision 0 and a clearly marked example proposal. Writes require the last read revision. Stale drafts must be reloaded and reviewed manually; no automatic overwrite. These endpoints intentionally do not post real money. `DB_PATH` selects storage, `PORT` defaults to 3001. Static production assets are served from `apps/web/dist` after building; Vite proxies `/api` during development.

## Verification references

- [Node SQLite API](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)
- [Vite guide](https://vite.dev/guide/)
- [Fastify documentation](https://fastify.dev/docs/latest/)

Node 24's SQLite API may emit an experimental warning. Its use is isolated to the store module so the persistence driver can be replaced without changing domain rules.

The lint parser's minimatch dependency is overridden to the patched 11.x release (GHSA-g3hv-75wg-m249). Keep the override until the upstream parser requires a patched version itself; lint and type checks verify its current integration.
