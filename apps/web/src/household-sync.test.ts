import { describe, expect, it, vi } from 'vitest';
import {
  confirmTransfer,
  initialDraft,
  initialHousehold,
} from '@family/domain';
import { decodeHousehold, GitHubHousehold, reconcile } from './household-sync';
import type { HouseholdPlan } from '@family/shared';
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
  it('round trips schema v9, preserves Unicode, uses SHA and excludes secrets', async () => {
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

it('merges a retraction with a stale device without resurrecting funds, including remote recovery', async () => {
  const { retractFundTransfer, activeTransfers, monthlyPlan } =
    await import('@family/domain');
  const funded = confirmTransfer(base, '2030-01', 0, '2030-01-02T12:00:00Z');
  const retracted = retractFundTransfer(
    funded,
    funded.transfers[0].id,
    0,
    '2030-01-03T12:00:00Z',
  );
  for (const recover of [false, true]) {
    const merged = reconcile(
      local({ document: retracted, base: funded }),
      { document: funded, sha: 'stale' },
      recover,
    );
    expect(activeTransfers(merged)).toHaveLength(0);
    expect(merged.transfers).toHaveLength(1);
    expect(merged.transferRetractions).toHaveLength(1);
    expect(monthlyPlan(merged, '2030-01').confirmedSavingsMinor).toBe(0);
  }
  const pulled = reconcile(
    local({ document: funded, base: funded, pending: false }),
    { document: retracted, sha: 'new' },
  );
  expect(activeTransfers(pulled)).toHaveLength(0);
});
it('deduplicates concurrent retractions and reconfirmations deterministically', async () => {
  const {
    retractFundTransfer,
    confirmFundTransfer,
    activeTransfers,
    canonicalHousehold,
  } = await import('@family/domain');
  const funded = confirmTransfer(base, '2030-01', 0, '2030-01-02T12:00:00Z');
  const a = retractFundTransfer(
    funded,
    funded.transfers[0].id,
    0,
    '2030-01-03T12:00:00Z',
  );
  const b = retractFundTransfer(
    funded,
    funded.transfers[0].id,
    0,
    '2030-01-03T13:00:00Z',
  );
  const merged = reconcile(local({ document: a, base: funded }), {
    document: b,
    sha: 'b',
  });
  expect(merged.transferRetractions).toHaveLength(1);
  expect(merged.transferRetractions[0].retractedAt).toBe(
    '2030-01-03T12:00:00Z',
  );
  const ac = confirmFundTransfer(
    merged,
    '2030-01',
    0,
    'savings',
    '2030-01-04T12:00:00Z',
  );
  const bc = confirmFundTransfer(
    merged,
    '2030-01',
    0,
    'savings',
    '2030-01-04T12:00:00Z',
  );
  const confirmed = reconcile(local({ document: ac, base: merged }), {
    document: bc,
    sha: 'c',
  });
  expect(activeTransfers(confirmed)).toHaveLength(1);
  expect(confirmed.transfers).toHaveLength(2);
  expect(canonicalHousehold(decodeHousehold(confirmed))).toBe(
    canonicalHousehold(confirmed),
  );
  const staleRetraction = reconcile(local({ document: b, base: funded }), {
    document: confirmed,
    sha: 'c',
  });
  expect(activeTransfers(staleRetraction)[0].generation).toBe(1);
});

it('round trips income history and rules, merges offline confirmations and protects competing income edits', async () => {
  const { canonicalHousehold, confirmFundTransfer, monthlyPlan } =
    await import('@family/domain');
  const planned = {
    ...base,
    incomes: [
      { month: '2030-01', amountsMinor: [200000, 300000] as [number, number] },
    ],
    fundingRules: [
      {
        month: '2030-01',
        mode: 'income' as const,
        operatingBasisPoints: 5000,
        leisureBasisPoints: 3000,
        savingsBasisPoints: 2000,
      },
    ],
  };
  expect(canonicalHousehold(decodeHousehold(planned))).toBe(
    canonicalHousehold(planned),
  );
  const a = confirmFundTransfer(
    planned,
    '2030-01',
    0,
    'operating',
    '2030-01-02T12:00:00Z',
  );
  const b = confirmFundTransfer(
    planned,
    '2030-01',
    1,
    'savings',
    '2030-01-02T12:00:00Z',
  );
  const merged = reconcile(local({ document: a, base: planned }), {
    document: b,
    sha: 'b',
  });
  expect(monthlyPlan(merged, '2030-01')).toMatchObject({
    confirmedOperatingMinor: 100000,
    confirmedSavingsMinor: 40000,
  });
  const editA = {
    ...planned,
    incomes: [
      { month: '2030-01', amountsMinor: [220000, 300000] as [number, number] },
    ],
  };
  const editB = {
    ...planned,
    incomes: [
      { month: '2030-01', amountsMinor: [200000, 310000] as [number, number] },
    ],
  };
  expect(() =>
    reconcile(local({ document: editA, base: planned }), {
      document: editB,
      sha: 'c',
    }),
  ).toThrow('Both devices changed the plan');
});

it('preserves trip labels and photos, blocks concurrent allocations and retains discarded goals as archived on recovery', async () => {
  const { tripLabel, allocateTrip, confirmFundTransfer, tripSavings } =
    await import('@family/domain');
  const trip = (id: string) => ({
    id,
    name: `Rome ${id}`,
    label: tripLabel(`Rome ${id}`, id),
    startDate: null,
    endDate: null,
    days: 7,
    nights: 6,
    foodPerPersonMinor: 3500,
    hotelPerNightMinor: 10000,
    flightPerPersonMinor: 20000,
    extrasMode: 'percentage' as const,
    extrasBasisPoints: 1500,
    extrasMinor: 0,
    otherMinor: 0,
    allocatedMinor: 0,
    photo: 'data:image/jpeg;base64,/9j/2Q==',
    archived: false,
  });
  let shared: HouseholdPlan = {
    ...base,
    trips: [trip('goal-1'), trip('goal-2')],
  };
  shared = confirmFundTransfer(
    shared,
    '2030-01',
    0,
    'savings',
    '2030-01-01T12:00:00Z',
  );
  const a = allocateTrip(shared, 'goal-1', 8000, '2030-01'),
    b = allocateTrip(shared, 'goal-2', 8000, '2030-01');
  expect(decodeHousehold(a).trips).toEqual(a.trips);
  expect(() =>
    reconcile(local({ document: a, base: shared }), { document: b, sha: 'b' }),
  ).toThrow('Both devices changed the plan');
  const recovered = reconcile(
    local({ document: a, base: shared }),
    { document: b, sha: 'b' },
    true,
  );
  expect(tripSavings(recovered, '2030-01').allocatedMinor).toBe(8000);
  const missing = { ...shared, trips: [] };
  const retained = reconcile(
    local({ document: a, base: shared }),
    { document: missing, sha: 'c' },
    true,
  );
  expect(retained.trips).toHaveLength(2);
  expect(
    retained.trips.every((t) => t.archived && t.allocatedMinor === 0),
  ).toBe(true);
  expect(retained.trips[0].label).toBe(a.trips[0].label);
  expect(() =>
    reconcile(local({ document: shared, pending: false }), {
      document: {
        ...shared,
        trips: [{ ...shared.trips[0], label: 'trip:changed' }, shared.trips[1]],
      },
      sha: 'd',
    }),
  ).toThrow('label changed');
});

it('synchronizes recurring corrections/deletions without stale financial-only uploads restoring removed schedules', async () => {
  const {
    editRecurringExpense,
    deleteRecurringExpense,
    monthlyPlan,
    canonicalHousehold,
    confirmFundTransfer,
  } = await import('@family/domain');
  const original: HouseholdPlan = {
    ...base,
    expenses: [
      {
        id: 'rent',
        name: 'Rent',
        amountMinor: 10000,
        firstDueDate: '2030-01-01',
        endDate: null,
        archivedFromMonth: null,
        category: 'Home',
        labels: [],
      },
    ],
  };
  const edited = editRecurringExpense(
    original,
    'rent',
    '2030-03',
    {
      name: 'Rent',
      amountMinor: 12000,
      dueDay: 1,
      endDate: null,
      category: 'Home',
      labels: ['fixed'],
    },
    'forward',
  );
  expect(canonicalHousehold(decodeHousehold(edited))).toBe(
    canonicalHousehold(edited),
  );
  const deleted = deleteRecurringExpense(edited, 'rent');
  const stale = confirmFundTransfer(
    edited,
    '2030-04',
    0,
    'savings',
    '2030-04-02T12:00:00Z',
  );
  const merged = reconcile(local({ document: stale, base: edited }), {
    document: deleted,
    sha: 'deleted',
  });
  expect(merged.expenses).toEqual([]);
  expect(merged.expenseChanges).toEqual([]);
  expect(merged.transfers).toHaveLength(1);
  expect(monthlyPlan(merged, '2030-01').operatingMinor).toBe(0);
  const competing = editRecurringExpense(
    edited,
    'rent',
    '2030-04',
    {
      name: 'Rent',
      amountMinor: 15000,
      dueDay: 1,
      endDate: null,
      category: 'Home',
      labels: [],
    },
    'forward',
  );
  expect(() =>
    reconcile(local({ document: competing, base: edited }), {
      document: deleted,
      sha: 'deleted',
    }),
  ).toThrow('Both devices changed the plan');
});
