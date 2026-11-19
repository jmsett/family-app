import { describe, expect, it } from 'vitest';
import {
  confirmTransfer,
  dueDate,
  initialDraft,
  initialHousehold,
  migrateLegacyDrafts,
  monthlyPlan,
  savingsFor,
  validateExpense,
  validateHousehold,
  validDate,
} from './index';
import type { RecurringExpense } from '@family/shared';
const expense: RecurringExpense = {
  id: 'rent',
  name: 'Rent',
  amountMinor: 80001,
  firstDueDate: '2030-01-31',
  endDate: null,
  archivedFromMonth: null,
  category: 'Home',
  labels: ['fixed', 'housing'],
};
const household = () => ({
  ...initialHousehold(),
  expenses: [expense],
  savingsTargets: [{ month: '2030-01', amountMinor: 20000 }],
});

describe('recurring monthly plans', () => {
  it('starts empty and does not invent operating expenses from legacy targets', () => {
    expect(monthlyPlan(initialHousehold(), '2030-01').totalMinor).toBe(0);
    const migrated = migrateLegacyDrafts([initialDraft('2030-01')]);
    expect(migrated.legacyDrafts).toHaveLength(1);
    expect(monthlyPlan(migrated, '2030-01').operatingMinor).toBe(0);
    expect(monthlyPlan(migrated, '2030-01').confirmedSavingsMinor).toBe(0);
  });
  it('adds due monthly expenses, with stable category and labels', () => {
    const plan = monthlyPlan(household(), '2030-01');
    expect(plan.operatingMinor).toBe(80001);
    expect(plan.totalMinor).toBe(100001);
    expect(plan.memberTargets).toEqual([50000, 50001]);
    expect(plan.expenses[0].labels).toEqual(['fixed', 'housing']);
    expect(monthlyPlan(household(), '2029-12').operatingMinor).toBe(0);
  });
  it('clamps monthly due dates and includes the last payment date', () => {
    expect(dueDate(expense, '2030-02')).toBe('2030-02-28');
    expect(dueDate({ ...expense, firstDueDate: '2028-01-31' }, '2028-02')).toBe(
      '2028-02-29',
    );
    expect(dueDate({ ...expense, endDate: '2030-02-28' }, '2030-02')).toBe(
      '2030-02-28',
    );
    expect(
      dueDate({ ...expense, endDate: '2030-02-27' }, '2030-02'),
    ).toBeNull();
    expect(
      dueDate({ ...expense, endDate: '2030-02-28' }, '2030-03'),
    ).toBeNull();
  });
  it('archives from an effective month without erasing earlier schedules', () => {
    const doc = {
      ...household(),
      expenses: [{ ...expense, archivedFromMonth: '2030-03' }],
    };
    expect(monthlyPlan(doc, '2030-02').operatingMinor).toBe(80001);
    expect(monthlyPlan(doc, '2030-03').operatingMinor).toBe(0);
    expect(doc.expenses).toHaveLength(1);
  });
  it('carries savings forward while preserving earlier effective targets', () => {
    const doc = {
      ...household(),
      savingsTargets: [
        { month: '2030-01', amountMinor: 20000 },
        { month: '2030-03', amountMinor: 30000 },
      ],
    };
    expect(savingsFor(doc, '2030-02')).toBe(20000);
    expect(savingsFor(doc, '2030-04')).toBe(30000);
    expect(savingsFor(doc, '2029-12')).toBe(0);
  });
  it('splits both envelopes and the combined total equally with every cent allocated', () => {
    for (let operating = 1; operating < 10; operating++)
      for (let savings = 0; savings < 10; savings++) {
        const plan = monthlyPlan(
          {
            ...household(),
            expenses: [{ ...expense, amountMinor: operating }],
            savingsTargets: [{ month: '2030-01', amountMinor: savings }],
          },
          '2030-01',
        );
        expect(plan.operatingShares[0] + plan.operatingShares[1]).toBe(
          operating,
        );
        expect(plan.savingsShares[0] + plan.savingsShares[1]).toBe(savings);
        expect(
          plan.memberTargets[1] - plan.memberTargets[0],
        ).toBeLessThanOrEqual(1);
        expect(plan.savingsShares.every((value) => value >= 0)).toBe(true);
      }
  });
  it('rejects invalid dates, zero costs, excessive labels and totals', () => {
    expect(validDate('2030-02-99')).toBe(false);
    for (const changes of [
      { firstDueDate: '2030-02-30' },
      { amountMinor: 0 },
      { endDate: '2029-01-01' },
      { labels: Array.from({ length: 13 }, () => 'tag') },
    ])
      expect(() => validateExpense({ ...expense, ...changes })).toThrow();
    expect(() =>
      validateHousehold({
        ...household(),
        expenses: [{ ...expense, amountMinor: 100000000 }],
      }),
    ).toThrow();
  });
});
describe('trust-based transfer confirmations', () => {
  it('shows only each member’s confirmed funds and blocks duplicate confirmations', () => {
    const doc = household();
    expect(monthlyPlan(doc, '2030-01').confirmedOperatingMinor).toBe(0);
    const first = confirmTransfer(doc, '2030-01', 0, '2030-01-31T12:00:00Z');
    expect(monthlyPlan(first, '2030-01').confirmedOperatingMinor).toBe(40000);
    expect(monthlyPlan(first, '2030-01').confirmedSavingsMinor).toBe(10000);
    expect(() =>
      confirmTransfer(first, '2030-01', 0, '2030-01-31T13:00:00Z'),
    ).toThrow('already confirmed');
    const both = confirmTransfer(first, '2030-01', 1, '2030-01-31T13:00:00Z');
    expect(monthlyPlan(both, '2030-01').confirmedOperatingMinor).toBe(80001);
    expect(monthlyPlan(both, '2030-01').confirmedSavingsMinor).toBe(20000);
    expect(monthlyPlan(both, '2030-02').confirmedOperatingMinor).toBe(0);
  });
  it('never changes confirmed amounts when plans change or expenses are archived', () => {
    const funded = confirmTransfer(
      household(),
      '2030-01',
      0,
      '2030-01-31T12:00:00Z',
    );
    const changed = {
      ...funded,
      expenses: [{ ...expense, archivedFromMonth: '2030-01' }],
      savingsTargets: [{ month: '2030-01', amountMinor: 0 }],
    };
    expect(monthlyPlan(changed, '2030-01').totalMinor).toBe(0);
    expect(monthlyPlan(changed, '2030-01').confirmedOperatingMinor).toBe(40000);
    expect(monthlyPlan(changed, '2030-01').confirmedSavingsMinor).toBe(10000);
  });
});

describe('independent fund confirmations and legacy upgrades', () => {
  it('confirms operating and savings independently and keeps amounts frozen after plan changes', async () => {
    const { confirmFundTransfer, fundingStatus } = await import('./index');
    let doc = confirmFundTransfer(
      household(),
      '2030-01',
      0,
      'operating',
      '2030-01-01T12:00:00Z',
    );
    expect(monthlyPlan(doc, '2030-01').confirmedOperatingMinor).toBe(40000);
    expect(monthlyPlan(doc, '2030-01').confirmedSavingsMinor).toBe(0);
    expect(fundingStatus(doc, '2030-01', 0, 'operating').complete).toBe(true);
    expect(fundingStatus(doc, '2030-01', 0, 'savings').complete).toBe(false);
    expect(() =>
      confirmFundTransfer(
        doc,
        '2030-01',
        0,
        'operating',
        '2030-01-02T12:00:00Z',
      ),
    ).toThrow('already confirmed');
    doc = confirmFundTransfer(
      { ...doc, savingsTargets: [{ month: '2030-01', amountMinor: 30000 }] },
      '2030-01',
      0,
      'savings',
      '2030-01-03T12:00:00Z',
    );
    expect(monthlyPlan(doc, '2030-01').confirmedOperatingMinor).toBe(40000);
    expect(monthlyPlan(doc, '2030-01').confirmedSavingsMinor).toBe(15000);
  });
  it('automatically satisfies a zero responsibility without inventing money or a declaration', async () => {
    const { fundingStatus, confirmFundTransfer } = await import('./index');
    const doc = {
      ...initialHousehold(),
      savingsTargets: [{ month: '2030-01', amountMinor: 1 }],
    };
    expect(fundingStatus(doc, '2030-01', 0, 'savings')).toMatchObject({
      complete: true,
      notRequired: true,
      target: 0,
    });
    expect(fundingStatus(doc, '2030-01', 1, 'savings').complete).toBe(false);
    expect(() =>
      confirmFundTransfer(doc, '2030-01', 0, 'savings', '2030-01-01T12:00:00Z'),
    ).toThrow('No transfer');
    expect(doc.transfers).toEqual([]);
  });
  it('migrates v2/v3 combined declarations and rejects malformed legacy history', async () => {
    const { upgradeHousehold } = await import('./index');
    const old = {
      ...initialHousehold(),
      schemaVersion: 3,
      transfers: [
        {
          id: '2030-01:0',
          month: '2030-01',
          member: 0,
          operatingMinor: 40000,
          savingsMinor: 10000,
          confirmedAt: '2030-01-01T12:00:00Z',
        },
      ],
    };
    const migrated = upgradeHousehold(old);
    expect(migrated.schemaVersion).toBe(9);
    expect(migrated.transfers.map((t) => [t.fund, t.amountMinor])).toEqual([
      ['operating', 40000],
      ['savings', 10000],
    ]);
    expect(monthlyPlan(migrated, '2030-01').confirmedOperatingMinor).toBe(
      40000,
    );
    expect(() =>
      upgradeHousehold({
        ...old,
        transfers: [...old.transfers, ...old.transfers],
      }),
    ).toThrow('legacy');
    expect(() =>
      upgradeHousehold({
        ...old,
        transfers: [{ ...old.transfers[0], savingsMinor: -1 }],
      }),
    ).toThrow();
  });
});

describe('retractable funding confirmations', () => {
  it('retracts one fund without changing the original record, other fund or other member', async () => {
    const {
      confirmFundTransfer,
      retractFundTransfer,
      activeTransfers,
      recordedFunds,
      buildHistory,
    } = await import('./index');
    let doc = confirmTransfer(
      household(),
      '2030-01',
      0,
      '2030-01-02T12:00:00Z',
    );
    doc = confirmFundTransfer(
      doc,
      '2030-01',
      1,
      'operating',
      '2030-01-03T12:00:00Z',
    );
    const original = doc.transfers[0];
    const next = retractFundTransfer(
      doc,
      original.id,
      0,
      '2030-01-05T12:00:00Z',
    );
    expect(next.transfers).toEqual(doc.transfers);
    expect(next.transferRetractions).toHaveLength(1);
    expect(activeTransfers(next)).toHaveLength(2);
    expect(monthlyPlan(next, '2030-01')).toMatchObject({
      confirmedOperatingMinor: 40001,
      confirmedSavingsMinor: 10000,
    });
    expect(recordedFunds(next, '2030-01')).toMatchObject({
      operatingMinor: 40001,
      savingsMinor: 10000,
    });
    expect(
      buildHistory(next, {
        metric: 'operating',
        interval: 'month',
        from: '2030-01-01',
        to: '2030-01-31',
      })[0],
    ).toMatchObject({ amountMinor: 40001, fundedMinor: 40001 });
    expect(
      retractFundTransfer(next, original.id, 0, '2030-01-06T12:00:00Z'),
    ).toEqual(next);
    expect(() =>
      retractFundTransfer(doc, original.id, 1, '2030-01-05T12:00:00Z'),
    ).toThrow('only your own');
  });
  it('allows repeated confirm/retract cycles, capturing the current amount only once per generation', async () => {
    const { confirmFundTransfer, retractFundTransfer, fundingStatus } =
      await import('./index');
    let doc = confirmFundTransfer(
      household(),
      '2030-01',
      0,
      'savings',
      '2030-01-02T12:00:00Z',
    );
    const first = doc.transfers[0];
    doc = retractFundTransfer(doc, first.id, 0, '2030-01-03T12:00:00Z');
    expect(fundingStatus(doc, '2030-01', 0, 'savings')).toMatchObject({
      complete: false,
      notRequired: false,
    });
    doc = {
      ...doc,
      savingsTargets: [{ month: '2030-01', amountMinor: 30000 }],
    };
    doc = confirmFundTransfer(
      doc,
      '2030-01',
      0,
      'savings',
      '2030-01-04T12:00:00Z',
    );
    expect(doc.transfers).toHaveLength(2);
    expect(doc.transfers[0]).toEqual(first);
    expect(doc.transfers[1]).toMatchObject({
      id: '2030-01:0:savings:1',
      generation: 1,
      amountMinor: 15000,
    });
    doc = retractFundTransfer(
      doc,
      doc.transfers[1].id,
      0,
      '2030-01-05T12:00:00Z',
    );
    doc = confirmFundTransfer(
      doc,
      '2030-01',
      0,
      'savings',
      '2030-01-06T12:00:00Z',
    );
    expect(
      fundingStatus(doc, '2030-01', 0, 'savings').confirmation?.generation,
    ).toBe(2);
    expect(monthlyPlan(doc, '2030-01').confirmedSavingsMinor).toBe(15000);
    expect(doc.transferRetractions).toHaveLength(2);
  });
  it('rejects dangling retractions and confirmations that skip a retraction', async () => {
    const { confirmFundTransfer, retractFundTransfer } =
      await import('./index');
    const doc = confirmFundTransfer(
      household(),
      '2030-01',
      0,
      'savings',
      '2030-01-02T12:00:00Z',
    );
    expect(() =>
      validateHousehold({
        ...doc,
        transfers: [
          ...doc.transfers,
          { ...doc.transfers[0], id: '2030-01:0:savings:1', generation: 1 },
        ],
      }),
    ).toThrow('must follow');
    const next = retractFundTransfer(
      doc,
      doc.transfers[0].id,
      0,
      '2030-01-03T12:00:00Z',
    );
    expect(() => validateHousehold({ ...next, transfers: [] })).toThrow(
      'retraction',
    );
    expect(() =>
      validateHousehold({
        ...next,
        transferRetractions: [{ ...next.transferRetractions[0], member: 1 }],
      }),
    ).toThrow('retraction');
  });
  it('upgrades schema4 without inventing a retraction or changing recorded amounts', async () => {
    const { upgradeHousehold, confirmFundTransfer } = await import('./index');
    const current = confirmFundTransfer(
      household(),
      '2030-01',
      0,
      'savings',
      '2030-01-02T12:00:00Z',
    );
    const legacy = {
      ...current,
      schemaVersion: 4,
      transferRetractions: undefined,
      transfers: current.transfers.map((t) => ({
        id: t.id,
        month: t.month,
        member: t.member,
        fund: t.fund,
        amountMinor: t.amountMinor,
        confirmedAt: t.confirmedAt,
      })),
    };
    expect(upgradeHousehold(legacy)).toEqual(current);
  });
});

describe('recurring expense corrections and deletion', () => {
  const fields = {
    name: 'Corrected rent',
    amountMinor: 90000,
    dueDay: 15,
    endDate: null,
    category: 'Home & bills',
    labels: ['corrected'],
  };
  it('applies a forward edit to that month and future targets without rewriting earlier plans or captured funding', async () => {
    const { editRecurringExpense, buildHistory } = await import('./index');
    const original = confirmTransfer(
      household(),
      '2030-01',
      0,
      '2030-01-02T12:00:00Z',
    );
    const edited = editRecurringExpense(
      original,
      'rent',
      '2030-03',
      fields,
      'forward',
    );
    expect(monthlyPlan(edited, '2030-02').operatingMinor).toBe(80001);
    expect(monthlyPlan(edited, '2030-03').operatingMinor).toBe(90000);
    expect(monthlyPlan(edited, '2030-04').expenses[0]).toMatchObject({
      name: 'Corrected rent',
      due: '2030-04-15',
      labels: ['corrected'],
    });
    expect(edited.transfers).toEqual(original.transfers);
    expect(
      buildHistory(edited, {
        metric: 'operating',
        interval: 'month',
        from: '2030-01-01',
        to: '2030-04-30',
      }).map((p) => p.targetMinor),
    ).toEqual([80001, 80001, 90000, 90000]);
  });
  it('replaces later scheduled changes and lets a retroactive correction replace the full schedule timeline', async () => {
    const { editRecurringExpense } = await import('./index');
    let doc = editRecurringExpense(
      household(),
      'rent',
      '2030-02',
      fields,
      'forward',
    );
    doc = editRecurringExpense(
      doc,
      'rent',
      '2030-06',
      { ...fields, amountMinor: 110000 },
      'forward',
    );
    doc = editRecurringExpense(
      doc,
      'rent',
      '2030-04',
      { ...fields, amountMinor: 95000 },
      'forward',
    );
    expect(doc.expenseChanges.map((c) => c.month)).toEqual([
      '2030-02',
      '2030-04',
    ]);
    expect(monthlyPlan(doc, '2030-06').operatingMinor).toBe(95000);
    doc = editRecurringExpense(
      doc,
      'rent',
      '2030-04',
      { ...fields, amountMinor: 70000 },
      'all',
    );
    expect(doc.expenseChanges).toHaveLength(1);
    expect(doc.expenseChanges[0].month).toBe('2030-01');
    for (const month of ['2030-01', '2030-03', '2030-07'])
      expect(monthlyPlan(doc, month).operatingMinor).toBe(70000);
    expect(monthlyPlan(doc, '2029-12').operatingMinor).toBe(0);
  });
  it('retains clamped due days, inclusive end dates and archive boundaries when editing', async () => {
    const { editRecurringExpense } = await import('./index');
    let doc = editRecurringExpense(
      household(),
      'rent',
      '2030-02',
      { ...fields, dueDay: 31, endDate: '2030-04-30' },
      'forward',
    );
    expect(monthlyPlan(doc, '2030-02').expenses[0].due).toBe('2030-02-28');
    expect(monthlyPlan(doc, '2030-03').expenses[0].due).toBe('2030-03-31');
    expect(monthlyPlan(doc, '2030-04').operatingMinor).toBe(90000);
    expect(monthlyPlan(doc, '2030-05').operatingMinor).toBe(0);
    doc = {
      ...doc,
      expenses: doc.expenses.map((e) => ({
        ...e,
        archivedFromMonth: '2030-03',
      })),
    };
    doc = editRecurringExpense(doc, 'rent', '2030-03', fields, 'all');
    expect(monthlyPlan(doc, '2030-02').operatingMinor).toBe(90000);
    expect(monthlyPlan(doc, '2030-03').operatingMinor).toBe(0);
  });
  it('deletes all versions and their planning history while retaining other schedules, funding and actual ledger records', async () => {
    const {
      editRecurringExpense,
      deleteRecurringExpense,
      recordedFunds,
      appendEntries,
      buildHistory,
    } = await import('./index');
    let doc = confirmTransfer(
      household(),
      '2030-01',
      0,
      '2030-01-02T12:00:00Z',
    );
    doc = {
      ...doc,
      expenses: [
        ...doc.expenses,
        { ...expense, id: 'internet', name: 'Internet', amountMinor: 3000 },
      ],
    };
    doc = editRecurringExpense(doc, 'rent', '2030-03', fields, 'forward');
    doc = appendEntries(doc, [
      {
        id: '00000000-0000-4000-8000-000000000077',
        kind: 'expense',
        date: '2030-01-03',
        createdAt: '2030-01-03T12:00:00Z',
        actor: 'a',
        description: 'Recorded rent',
        amountMinor: 10000,
        payer: 'a',
        source: 'personal',
        splitMode: 'equal',
        splitInput: [1, 1, 0],
        shares: [5000, 5000, 0],
        category: 'Home',
        labels: [],
      },
    ]);
    const deleted = deleteRecurringExpense(doc, 'rent');
    expect(deleted.expenses.map((e) => e.id)).toEqual(['internet']);
    expect(deleted.expenseChanges).toEqual([]);
    expect(deleted.ledger).toEqual(doc.ledger);
    expect(deleted.transfers).toEqual(doc.transfers);
    expect(recordedFunds(deleted, '2030-03')).toEqual(
      recordedFunds(doc, '2030-03'),
    );
    expect(
      buildHistory(deleted, {
        metric: 'operating',
        interval: 'month',
        from: '2030-01-01',
        to: '2030-04-30',
      }).map((p) => p.targetMinor),
    ).toEqual([3000, 3000, 3000, 3000]);
  });
  it('rejects invalid correction dates, values, orphaned and duplicate revisions and aggregate overflow', async () => {
    const { editRecurringExpense } = await import('./index');
    expect(() =>
      editRecurringExpense(household(), 'rent', '2029-12', fields, 'forward'),
    ).toThrow('on or after');
    for (const bad of [
      { amountMinor: 0 },
      { amountMinor: -1 },
      { dueDay: 32 },
      { dueDay: 1.5 },
      { endDate: '2029-12-31' },
      { name: '' },
    ])
      expect(() =>
        editRecurringExpense(
          household(),
          'rent',
          '2030-02',
          { ...fields, ...bad },
          'forward',
        ),
      ).toThrow();
    const edited = editRecurringExpense(
      household(),
      'rent',
      '2030-02',
      fields,
      'forward',
    );
    expect(() => validateHousehold({ ...edited, expenses: [] })).toThrow(
      'orphaned',
    );
    expect(() =>
      validateHousehold({
        ...edited,
        expenseChanges: [...edited.expenseChanges, ...edited.expenseChanges],
      }),
    ).toThrow('duplicate');
    expect(() =>
      editRecurringExpense(
        household(),
        'rent',
        '2030-02',
        { ...fields, amountMinor: 100000000 },
        'forward',
      ),
    ).toThrow('Amounts');
  });
  it('upgrades schema8 without inventing changes or altering existing records', async () => {
    const { upgradeHousehold } = await import('./index');
    const current = household();
    const old = { ...current, schemaVersion: 8, expenseChanges: undefined };
    expect(upgradeHousehold(old)).toEqual(current);
  });
});
