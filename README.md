# Family Manager

A household finance PWA for two adults. Plan a monthly budget, distinguish contribution targets from money actually earmarked, and eventually track expenses, reimbursements, savings goals and subscriptions. No bank connection is required. Money uses integer cents; targets never imply available cash.

**Current implementation:** monthly planning with offline device storage, an installable app shell and private GitHub synchronization. Browser-ready files are committed at the repository root for branch-based Pages hosting, matching `nunz-app`. Financial entries and the ledger are future milestones. The GitHub adapter is tested with a mocked API; live repository pairing and phone installation still need the owner setup below.

## Architecture

Following the existing `nunz-app` approach:

- **family-app (public):** React/TypeScript source and static PWA hosted on GitHub Pages. No household records or credentials in source or deployment artifacts.
- **family-data (private):** JSON drafts at `budgets/YYYY-MM.json`, synchronized through GitHub's Contents API. No production API server, SQLite database or VPN is needed.
- **Devices:** IndexedDB saves work offline. Each device uses a separate expiring fine-grained token scoped only to `family-data` with Contents read/write. Enter it only in the PWA; it stays in memory until reload/disconnect. Tokens are never exported or synchronized.
- **Conflicts:** different months synchronize independently. Divergent changes to one month stop with a visible conflict; export the local JSON before explicitly recovering the GitHub copy. No automatic last-write-wins for monetary edits.

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
5. On the first device, save a monthly proposal, enter the token in **Device synchronization**, and connect. The app verifies the repository is private and creates the monthly JSON. An untouched sample proposal is never uploaded automatically.
6. On the second device, connect before editing that month. It downloads the existing proposal. Edit, save, and check both devices using **Sync now**. A token must be entered again after reload. Sync processes the selected month; select other months to synchronize those drafts.
7. Perform an offline/concurrent edit drill with sample data. Both local edits must survive a conflict. Export the losing device's JSON before choosing **Recover from GitHub**, which replaces that month's saved device draft after confirmation.

If the Pages URL displays this README, check that the latest commit includes root `index.html` and Pages is publishing **main / (root)**. Wait for GitHub's automatic **pages build and deployment** run to succeed. In the app, expand **Sync & backups** to connect a device or export a saved month; its status remains visible when collapsed.

For future source updates, rebuild the public files before committing:

```bash
bash scripts/npm.sh run build:pages
```

This builds for `/family-app/` and copies only static PWA assets to the repository root. `.pages-files.json` tracks generated files so obsolete hashed assets can be removed without touching source or documentation. Commit the source and regenerated files together. CI verifies that the committed public build matches the source. The custom Actions deployment workflow has been removed; Actions still runs verification, and GitHub runs its standard branch Pages deployment.

Synchronization runs after saves, on reconnect/focus/visibility changes, every two minutes while visible, and on request. It runs only while the app is open. Save form changes before syncing. Failures preserve saved local drafts; unsaved fields still require Save. Browser storage can be evicted or cleared, so pending changes are not backed up. Export each needed month for an independent backup; Git history alone is not a backup policy. JSON import/merging and automatic migration from SQLite are not implemented yet.

Private JSON is not end-to-end encrypted. GitHub and collaborators can read it; tokens grant repository-wide access, with no separate per-member authorization. Local records remain after disconnect. Same-origin scripts can access those records and active credentials, and project Pages sites on `jmsett.github.io` share an origin. Revoke a lost device's token in GitHub. Never paste tokens into chat, commit them, or put them in build variables.

Official references: [GitHub Contents API](https://docs.github.com/en/rest/repos/contents), [fine-grained tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens), [Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Legacy local API

`bash scripts/npm.sh run dev` still starts both the web app and the legacy Fastify API at `localhost:3001`. The browser no longer calls that API. Existing SQLite data at ignored `data/family-manager.sqlite` is preserved and is not automatically copied to device storage or GitHub. The legacy API, integration tests and Docker setup remain available for reference; they do not describe the Pages production deployment.
