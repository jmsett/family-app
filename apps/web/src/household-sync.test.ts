import { describe, expect, it, vi } from 'vitest';
import {
  confirmTransfer,
  initialDraft,
  initialHousehold,
} from '@family/domain';
import { decodeHousehold, GitHubHousehold, reconcile } from './household-sync';
import type { LocalRecord } from './storage';
const base = {
  ...initialHousehold(),
  savingsTargets: [{ month: '2030-01', amountMinor: 20000 }],
};
const local = (extra: Partial<LocalRecord> = {}): LocalRecord => ({
  document: base,
  base,
  sha: 'a',
  pending: true,
  ...extra,
});
describe('household sync with immutable confirmations', () => {
  it('merges two members’ offline confirmations without a plan conflict', () => {
    const a = confirmTransfer(base, '2030-01', 0, '2030-01-01T12:00:00Z');
    const b = confirmTransfer(base, '2030-01', 1, '2030-01-01T13:00:00Z');
    expect(
      reconcile(local({ document: a }), { document: b, sha: 'b' }).transfers,
    ).toHaveLength(2);
  });
  it('deduplicates identical declarations on two devices and rejects different amounts', () => {
    const a = confirmTransfer(base, '2030-01', 0, '2030-01-01T12:00:00Z');
    const b = confirmTransfer(base, '2030-01', 0, '2030-01-01T13:00:00Z');
    expect(
      reconcile(local({ document: a }), { document: b, sha: 'b' }).transfers,
    ).toHaveLength(1);
    expect(() =>
      reconcile(local({ document: a }), {
        document: { ...b, transfers: [{ ...b.transfers[0], amountMinor: 1 }] },
        sha: 'b',
      }),
    ).toThrow('Conflicting confirmations');
  });
  it('blocks competing plan edits, but remote recovery retains local confirmations', () => {
    const a = confirmTransfer(
      { ...base, memberNames: ['Alex', 'Sam'] as [string, string] },
      '2030-01',
      0,
      '2030-01-01T12:00:00Z',
    );
    const b = { ...base, memberNames: ['José', '愛'] as [string, string] };
    expect(() =>
      reconcile(local({ document: a }), { document: b, sha: 'b' }),
    ).toThrow('Both devices changed');
    const recovered = reconcile(
      local({ document: a }),
      { document: b, sha: 'b' },
      true,
    );
    expect(recovered.memberNames).toEqual(b.memberNames);
    expect(recovered.transfers).toEqual(a.transfers);
  });
  it('preserves confirmations even when an incoming file omits them', () => {
    const a = confirmTransfer(base, '2030-01', 0, '2030-01-01T12:00:00Z');
    expect(
      reconcile(local({ document: a, pending: false }), {
        document: base,
        sha: 'b',
      }).transfers,
    ).toEqual(a.transfers);
    expect(() => reconcile(local(), null)).toThrow('missing');
  });
});
describe('household GitHub format', () => {
  it('migrates old private monthly drafts without deleting them or inventing funds', async () => {
    const draft = initialDraft('2030-01');
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('household.json'))
        return new Response('{}', { status: 404 });
      if (String(url).endsWith('budgets?ref=main'))
        return Response.json([{ name: '2030-01.json' }]);
      return Response.json({
        encoding: 'base64',
        sha: 'old',
        content: btoa(JSON.stringify({ schemaVersion: 1, draft })),
      });
    });
    const result = await new GitHubHousehold(
      'test-only',
      fetcher,
    ).readHousehold();
    expect(result?.sha).toBeNull();
    expect(result?.document.legacyDrafts).toEqual([draft]);
    expect(result?.document.expenses).toEqual([]);
    expect(result?.document.transfers).toEqual([]);
  });
  it('round trips schema v4, preserves Unicode, uses SHA and excludes secrets', async () => {
    let encoded = '';
    const doc = { ...base, memberNames: ['José', '愛'] as [string, string] };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url, options) => {
        if (String(url).endsWith('family-data'))
          return Response.json({ private: true, default_branch: 'main' });
        if (options?.method === 'PUT') {
          const body = JSON.parse(String(options.body));
          expect(body.sha).toBe('a');
          encoded = body.content;
          return Response.json({ content: { sha: 'b' } });
        }
        return Response.json({
          encoding: 'base64',
          sha: 'b',
          content: encoded,
        });
      });
    const api = new GitHubHousehold('fake-token-secret', fetcher);
    expect(await api.writeHousehold(doc, 'a')).toBe('b');
    expect((await api.readHousehold())?.document).toEqual(doc);
    expect(atob(encoded)).not.toContain('fake-token-secret');
  });
});

it('upgrades schema2 JSON and preserves immutable ledger entries during remote plan recovery', () => {
  const old = { ...base, schemaVersion: 2, ledger: undefined };
  expect(decodeHousehold(old)).toEqual(base);
  const entry = {
    id: 'dinner',
    kind: 'expense' as const,
    date: '2026-11-17',
    createdAt: '2026-11-17T12:00:00Z',
    actor: 'a' as const,
    description: 'Dinner',
    amountMinor: 8000,
    payer: 'a' as const,
    source: 'personal' as const,
    splitMode: 'equal' as const,
    splitInput: [1, 1, 0] as [number, number, number],
    shares: [4000, 4000, 0] as [number, number, number],
    category: 'Food',
    labels: [],
  };
  const recovered = reconcile(
    local({ document: { ...base, ledger: [entry] } }),
    { document: { ...base, memberNames: ['Alex', 'Sam'] }, sha: 'b' },
    true,
  );
  expect(recovered.ledger).toEqual([entry]);
  expect(recovered.memberNames).toEqual(['Alex', 'Sam']);
});

it('merges independent operating/savings declarations for the same member and protects both during recovery', async () => {
  const { confirmFundTransfer } = await import('@family/domain');
  const fundedBase = {
    ...base,
    expenses: [
      {
        id: 'rent',
        name: 'Rent',
        amountMinor: 80000,
        firstDueDate: '2030-01-01',
        endDate: null,
        archivedFromMonth: null,
        category: 'Home',
        labels: [],
      },
    ],
  };
  const a = confirmFundTransfer(
    fundedBase,
    '2030-01',
    0,
    'operating',
    '2030-01-01T12:00:00Z',
  );
  const b = confirmFundTransfer(
    fundedBase,
    '2030-01',
    0,
    'savings',
    '2030-01-02T12:00:00Z',
  );
  const merged = reconcile(local({ document: a, base: fundedBase }), {
    document: b,
    sha: 'b',
  });
  expect(merged.transfers).toHaveLength(2);
  expect(merged.transfers.reduce((s, t) => s + t.amountMinor, 0)).toBe(50000);
  expect(
    reconcile(local({ document: merged }), { document: base, sha: 'c' }, true)
      .transfers,
  ).toEqual(merged.transfers);
});
