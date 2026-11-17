# Family Manager

A household finance PWA for two adults. Plan a monthly budget, distinguish contribution targets from money actually earmarked, and eventually track expenses, reimbursements, savings goals and subscriptions. No bank connection is required. Money uses integer cents; targets never imply available cash.

**Current implementation:** recurring monthly expense planning, fixed monthly savings, 50/50 contributions and member-confirmed transfers, with offline storage and private GitHub synchronization. Browser-ready files are committed at the repository root for branch-based Pages hosting, matching `nunz-app`. The PWA has been deployed and the owner confirmed installation. Live private repository pairing is still an owner setup step; expense posting and the ledger remain future work.

## App organization and trust model

- **Overview:** confirmed operating and savings funds for the selected month, plus each member's transfer status. Amounts start at zero and increase only when a member explicitly confirms their own transfer. Choose your name before confirming; V1 uses declarations, not authenticated identity or bank verification.
- **Monthly plan:** define recurring expenses with a name, monthly amount, first due date, category and optional labels. Choose monthly recurrence until archived or a final payment date. The operating budget is the sum of payments due in the selected month. Set savings as a separate fixed monthly amount; it carries forward until changed. Contributions always split 50/50, with deterministic cent rounding across the two envelopes and total.
- **Settings:** member names, private GitHub connection, whole-household JSON backup and preserved earlier manual targets. Categories and labels are retained for future actual spending comparisons and charts; scheduled payments are not actual spending.

Monthly due dates repeat on the original day, clamped to the last day in shorter months. End dates are inclusive. Archiving stops a schedule from the selected month and retains the original record and earlier months. Changing a savings target creates an effective-month entry and preserves prior targets.

A transfer confirmation records both operating and savings amounts for one member/month. Duplicate confirmations are blocked. Later plan edits never change those recorded amounts. Corrections, partial transfers, top-ups and CSV/bank/PayPal verification are future work; confirm only after the full displayed transfer has been made.

## Architecture

Following the existing `nunz-app` approach:

- **family-app (public):** React/TypeScript source and static PWA hosted on GitHub Pages. No household records or credentials in source or deployment artifacts.
- **family-data (private):** A schema-v2 household document at `household.json` containing recurring schedules, effective savings targets, transfer confirmations and preserved earlier drafts, synchronized through GitHub's Contents API. No production API server, SQLite database or VPN is needed.
- **Devices:** IndexedDB saves work offline. Each device uses a separate expiring fine-grained token scoped only to `family-data` with Contents read/write. Enter it only in the PWA; it stays in memory until reload/disconnect. Tokens are never exported or synchronized.
- **Conflicts:** independent member confirmations merge by stable member/month ID, without double counting. Concurrent divergent plan edits require review. Remote recovery can replace unsynced plan settings, but retains device transfer confirmations; conflicting amounts for the same confirmation are blocked. SHA guards all writes.

See [plan.md](plan.md), [architecture](docs/architecture.md) and [milestone.md](milestone.md). The owner authorized this architecture slice; other financial milestones still require review.

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
bash scripts/npm.sh run test:e2e # desktop + mobile planner regression
bash scripts/npm.sh run test:pwa # static subpath, offline shell, mocked multi-device sync
# To use installed Chrome, prefix either browser test command with:
# PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome
```

## GitHub setup — ready to begin

1. Create **family-app** (public) and **family-data** (private). Initialize `family-data` with a README on `main`. GitHub reported during the documentation push that `jmsett/family_manager` has already moved to `jmsett/family-app`.
2. In `family-app`, set **Settings → Pages → Build and deployment → Source → Deploy from a branch**, branch **main**, folder **/(root)**. The root contains the built app and `.nojekyll`. GitHub publishes it after a push, as with `nunz-app`. No data token or Actions secret is needed.
3. Open **https://jmsett.github.io/family-app/** once deployment succeeds. Install through the browser's app installation menu; on iPhone use Safari → Share → Add to Home Screen.
4. Create a separate fine-grained token for each device: resource owner **jmsett**, repository access **Only select repositories → family-data**, repository permission **Contents: Read and write**, with an expiration. GitHub includes Metadata read access. Do not grant access to `family-app` or other repositories.
5. On the first device, define and save your recurring expenses and savings in **Monthly plan**, then open **Settings → Sync & backups**, enter the token and connect. The app verifies repository privacy and creates `household.json`. An untouched empty household is never uploaded automatically.
6. On the second device, connect in **Settings** before making edits. It downloads the whole household, including recurring schedules across months. Use **Sync now** to check both copies. A token must be entered again after reload.
7. Test with sample data: confirm one member on each offline device, reconnect, and check that both confirmations appear once. Competing plan edits must produce a visible conflict. Export the device JSON before recovering remote plan settings.

If the Pages URL displays this README, check that the latest commit includes root `index.html` and Pages is publishing **main / (root)**. Wait for GitHub's automatic **pages build and deployment** run to succeed. In **Settings**, expand **Sync & backups** to connect a device or export the household; its status remains visible when collapsed.

For future source updates, rebuild the public files before committing:

```bash
bash scripts/npm.sh run build:pages
```

This builds for `/family-app/` and copies only static PWA assets to the repository root. `.pages-files.json` tracks generated files so obsolete hashed assets can be removed without touching source or documentation. Commit the source and regenerated files together. CI verifies that the committed public build matches the source. The custom Actions deployment workflow has been removed; Actions still runs verification, and GitHub runs its standard branch Pages deployment.

Synchronization runs after saves, on reconnect/focus/visibility changes, every two minutes while visible, and on request. It runs only while the app is open. Save form changes before syncing. Failures preserve saved local drafts; unsaved fields still require Save. Browser storage can be evicted or cleared, so pending changes are not backed up. Export the whole household for an independent backup; Git history alone is not a backup policy. Existing browser drafts and old private `budgets/YYYY-MM.json` files migrate into preserved legacy targets without becoming expenses or confirmed funds. Old private files are left untouched. Close older app tabs if the storage upgrade is blocked. Generic JSON import and automatic SQLite migration are not implemented yet.

Private JSON is not end-to-end encrypted. GitHub and collaborators can read it; tokens grant repository-wide access, with no separate per-member authorization. Local records remain after disconnect. Same-origin scripts can access those records and active credentials, and project Pages sites on `jmsett.github.io` share an origin. Revoke a lost device's token in GitHub. Never paste tokens into chat, commit them, or put them in build variables.

Official references: [GitHub Contents API](https://docs.github.com/en/rest/repos/contents), [fine-grained tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Legacy local API

`bash scripts/npm.sh run dev` still starts both the web app and the legacy Fastify API at `localhost:3001`. The browser no longer calls that API. Existing SQLite data at ignored `data/family-manager.sqlite` is preserved and is not automatically copied to device storage or GitHub. The legacy API, integration tests and Docker setup remain available for reference; they do not describe the Pages production deployment.
