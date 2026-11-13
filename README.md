# Family Manager

A private, self-hosted household finance app for two adults. Plan a shared monthly budget, distinguish contributions from money actually earmarked, and eventually track expenses, reimbursements, savings goals and subscriptions. No bank connection is required. Money uses integer cents; targets never imply available cash.

**Current review: M0 — foundation and monthly planning prototype.** React/TypeScript, Fastify and SQLite run locally. Save a monthly draft, adjust savings and contribution shares, and reload it. Authentication, real financial entries and offline sync come in later milestones. Use sample data for this local prototype.

## Run locally

Requires Node.js 24 and npm. Dependencies stay in this checkout (`node_modules`); no Python virtual environment is needed. If Node is unavailable on Linux x64, `bash scripts/setup-node.sh` installs a verified runtime into ignored `.tools/`.

```bash
# Only needed for the project-local runtime; repeat in each new terminal:
export PATH="$PWD/.tools/node/bin:$PATH"
npm ci
npm run dev
```

Open **http://localhost:5173**. API: `http://localhost:3001/api/health`. Drafts and their revision history persist in `data/family-manager.sqlite`. Both servers bind to loopback; this milestone has no login. Stop with Ctrl+C. For a single server: `npm run build && npm start`, then open **http://localhost:3001**.

```bash
npm run check                 # types, lint, unit/integration tests, build, format
npx playwright install chromium
npm run test:e2e              # desktop + mobile browser tests
# Or use an installed Chrome:
PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npm run test:e2e
```

Optional Docker: `docker compose up --build`, then open `http://localhost:3001`. SQLite persists in a named volume. Docker configuration is provided but has not been run in this development environment.

See [milestone.md](milestone.md) for review gates and the M0 walkthrough, and [architecture](docs/architecture.md) for contracts and decisions. Every milestone needs your explicit feedback before the next begins.
