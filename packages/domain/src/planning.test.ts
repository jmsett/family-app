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
    expect(migrated.schemaVersion).toBe(4);
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
