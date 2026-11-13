import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { initialDraft } from '@family/domain';
import { createApp } from './app.js';

const apps: ReturnType<typeof createApp>[] = [];
const paths: string[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  for (const path of paths.splice(0))
    rmSync(path, { recursive: true, force: true });
});
function setup(path = ':memory:') {
  const app = createApp(path);
  apps.push(app);
  return app;
}

describe('local budget API and SQLite', () => {
  it('reports readiness and a default unsaved draft without fabricated money', async () => {
    const app = setup();
    expect((await app.inject('/api/health')).json()).toMatchObject({
      status: 'ok',
      schemaVersion: 1,
    });
    const response = await app.inject('/api/workspace?month=2026-11');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      draft: { revision: 0 },
      recorded: { earmarkedMinor: 0, expensesMinor: 0, payableMinor: 0 },
    });
  });
  it('persists after restart and records draft history', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'family-manager-test-'));
    paths.push(folder);
    const path = join(folder, 'household.sqlite');
    const app = setup(path);
    const saved = await app.inject({
      method: 'PUT',
      url: '/api/budget-draft',
      payload: initialDraft('2026-11'),
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().draft.revision).toBe(1);
    await app.close();
    apps.splice(apps.indexOf(app), 1);
    const reopened = setup(path);
    expect(
      (await reopened.inject('/api/workspace?month=2026-11')).json().draft
        .revision,
    ).toBe(1);
    const db = new DatabaseSync(path);
    expect(db.prepare('SELECT count(*) AS n FROM draft_audit').get()?.n).toBe(
      1,
    );
    expect(db.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe(
      'ok',
    );
    db.close();
  });
  it('returns 409 on stale saves and keeps the accepted version', async () => {
    const app = setup();
    const draft = initialDraft('2026-11');
    await app.inject({
      method: 'PUT',
      url: '/api/budget-draft',
      payload: draft,
    });
    const stale = await app.inject({
      method: 'PUT',
      url: '/api/budget-draft',
      payload: { ...draft, totalMinor: 90000 },
    });
    expect(stale.statusCode).toBe(409);
    expect(
      (await app.inject('/api/workspace?month=2026-11')).json().draft
        .totalMinor,
    ).toBe(120000);
  });
  it('keeps month plans independent', async () => {
    const app = setup();
    await app.inject({
      method: 'PUT',
      url: '/api/budget-draft',
      payload: initialDraft('2026-11'),
    });
    await app.inject({
      method: 'PUT',
      url: '/api/budget-draft',
      payload: { ...initialDraft('2026-12'), firstMemberBasisPoints: 6000 },
    });
    expect(
      (await app.inject('/api/workspace?month=2026-11')).json().projection
        .memberTargetsMinor,
    ).toEqual([60000, 60000]);
    expect(
      (await app.inject('/api/workspace?month=2026-12')).json().projection
        .memberTargetsMinor,
    ).toEqual([72000, 48000]);
  });
  it('rejects invalid bodies and months before changing the database', async () => {
    const app = setup();
    for (const payload of [
      {},
      { ...initialDraft('2026-11'), savingsMinor: 120001 },
      { ...initialDraft('2026-11'), totalMinor: -1 },
      { ...initialDraft('2026-11'), totalMinor: 1.5 },
    ]) {
      expect(
        (await app.inject({ method: 'PUT', url: '/api/budget-draft', payload }))
          .statusCode,
      ).toBe(400);
    }
    expect((await app.inject('/api/workspace?month=2026-99')).statusCode).toBe(
      400,
    );
    expect(
      (await app.inject('/api/workspace?month=2026-11')).json().draft.revision,
    ).toBe(0);
  });
  it('rejects remote hosts and cross-origin writes', async () => {
    const app = setup();
    expect(
      (
        await app.inject({
          url: '/api/workspace',
          headers: { host: 'attacker.example' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: '/api/budget-draft',
          payload: initialDraft('2026-11'),
          headers: { origin: 'https://attacker.example' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: '/api/workspace',
          headers: { host: 'localhost:3001' },
        })
      ).statusCode,
    ).toBe(200);
  });
});
