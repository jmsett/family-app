# Family Manager

A private, self-hosted household finance app for two adults. Plan a shared monthly budget, distinguish contributions from money actually earmarked, and eventually track expenses, reimbursements, savings goals and subscriptions. No bank connection is required. Money uses integer cents; targets never imply available cash.

**Current review: M0 — foundation and monthly planning prototype.** React/TypeScript, Fastify and SQLite run locally. Save a monthly draft, adjust savings and contribution shares, and reload it. Authentication, real financial entries and offline sync come in later milestones. Use sample data for this local prototype.

## Run locally

Dependencies stay in this checkout (`node_modules`); no Python virtual environment is needed. On Linux x64, the npm wrapper below uses the project-local Node.js 24 runtime, downloading and verifying it if missing. It sets PATH automatically for the command, so no system installation or shell configuration is needed.

```bash
bash scripts/npm.sh ci
bash scripts/npm.sh run dev
```

Open **http://localhost:5173**. API: `http://localhost:3001/api/health`. Drafts and their revision history persist in `data/family-manager.sqlite`. Both servers bind to loopback; this milestone has no login. Stop with Ctrl+C. For a single server: `bash scripts/npm.sh run build && bash scripts/npm.sh start`, then open **http://localhost:3001**. On other platforms, install Node.js 24 and use npm directly.

```bash
bash scripts/npm.sh run check # types, lint, unit/integration tests, build, format
bash scripts/npm.sh exec -- playwright install chromium
bash scripts/npm.sh run test:e2e # desktop + mobile browser tests
# Or use an installed Chrome:
PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome bash scripts/npm.sh run test:e2e
```

Optional Docker: `docker compose up --build`, then open `http://localhost:3001`. SQLite persists in a named volume. Docker configuration is provided but has not been run in this development environment.

See [milestone.md](milestone.md) for review gates and the M0 walkthrough, and [architecture](docs/architecture.md) for contracts and decisions. Every milestone needs your explicit feedback before the next begins.
