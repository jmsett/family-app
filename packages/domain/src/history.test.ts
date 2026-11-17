import { describe, it, expect } from 'vitest';
import type {
  HouseholdPlan,
  LedgerEvent,
  PostedExpense,
  Party,
  Shares,
} from '@family/shared';
import {
  appendEntries,
  buildHistory,
  confirmFundTransfer,
  contributionDate,
  historyStart,
  initialHousehold,
  recordedFunds,
  splitAmount,
} from './index';
const createdAt = '2026-11-01T12:00:00Z';
function expense(
  id: string,
  date: string,
  amountMinor: number,
  payer: Party = 'a',
  shares: Shares = [1, 1, 0],
  category = 'Food',
): PostedExpense {
  return {
    id,
    kind: 'expense',
    description: id,
    date,
    createdAt,
    actor: 'a',
    amountMinor,
    payer,
    source: payer === 'household' ? 'household' : 'personal',
    splitMode: 'equal',
    splitInput: shares,
    shares: splitAmount(amountMinor, 'equal', shares),
    category,
    labels: [],
  };
}
function funded(): HouseholdPlan {
  let doc: HouseholdPlan = {
    ...initialHousehold(),
    expenses: [
      {
        id: 'rent',
        name: 'Rent',
        amountMinor: 100000,
        firstDueDate: '2026-11-01',
        endDate: null,
        archivedFromMonth: null,
        category: 'Home',
        labels: [],
      },
    ],
    savingsTargets: [{ month: '2026-11', amountMinor: 200000 }],
  };
  doc = confirmFundTransfer(doc, '2026-11', 0, 'operating', createdAt);
  return confirmFundTransfer(doc, '2026-11', 0, 'savings', createdAt);
}
const history = (
  doc: HouseholdPlan,
  metric: 'expenses' | 'savings' | 'operating' | 'budget',
  interval: 'day' | 'week' | 'month' | 'year' = 'month',
  from = '2026-11-01',
  to = '2026-11-30',
  category?: string,
) => buildHistory(doc, { metric, interval, from, to, category });
describe('historical spending and balance series', () => {
  it('sums actual expenses by interval/category, preserves cents and fills empty periods', () => {
    const doc = appendEntries(initialHousehold(), [
      expense('one', '2026-11-01', 8001),
      expense('two', '2026-11-03', 1999, 'b'),
      expense('other', '2026-12-05', 5000, 'a', [1, 1, 0], 'Travel'),
    ]);
    expect(
      history(doc, 'expenses', 'day', '2026-11-01', '2026-11-03').map(
        (p) => p.amountMinor,
      ),
    ).toEqual([8001, 0, 1999]);
    expect(
      history(doc, 'expenses', 'month', '2026-11-01', '2027-01-31').map(
        (p) => p.amountMinor,
      ),
    ).toEqual([10000, 5000, 0]);
    expect(
      history(doc, 'expenses', 'year', '2026-01-01', '2026-12-31')[0]
        .amountMinor,
    ).toBe(15000);
    expect(
      history(doc, 'expenses', 'month', '2026-11-02', '2026-12-31', 'Food').map(
        (p) => p.amountMinor,
      ),
    ).toEqual([1999, 0]);
  });
  it('starts weeks on Monday across year boundaries and handles leap days and partial intervals', () => {
    const doc = appendEntries(initialHousehold(), [
      expense('sun', '2023-12-31', 100),
      expense('mon', '2024-01-01', 200),
      expense('leap', '2024-02-29', 300),
    ]);
    const weeks = history(doc, 'expenses', 'week', '2023-12-31', '2024-01-02');
    expect(
      weeks.map((p) => [p.time, p.startDate, p.endDate, p.amountMinor]),
    ).toEqual([
      ['2023-12-25', '2023-12-31', '2023-12-31', 100],
      ['2024-01-01', '2024-01-01', '2024-01-02', 200],
    ]);
    expect(
      history(doc, 'expenses', 'day', '2024-02-28', '2024-03-01').map(
        (p) => p.amountMinor,
      ),
    ).toEqual([0, 300, 0]);
  });
  it('carries opening balances into the range and reconciles month-end values with Overview', () => {
    const events: LedgerEvent[] = [
      expense('advance', '2026-11-10', 8000, 'a', [0, 0, 1]),
      {
        id: 'refund',
        kind: 'settlement',
        date: '2026-11-11',
        createdAt,
        actor: 'a',
        from: 'household',
        to: 'a',
        amountMinor: 3000,
        note: '',
      },
      {
        ...expense('purchase', '2026-11-12', 10000, 'household', [0, 0, 1]),
        fund: 'savings',
      },
      {
        id: 'move',
        kind: 'fund-movement',
        date: '2026-11-13',
        createdAt,
        actor: 'a',
        from: 'savings',
        to: 'operating',
        amountMinor: 20000,
        note: 'Move funds',
      },
      {
        id: 'withdraw',
        kind: 'fund-movement',
        date: '2026-11-14',
        createdAt,
        actor: 'a',
        from: 'savings',
        to: 'external',
        amountMinor: 5000,
        note: 'Withdraw',
      },
      {
        id: 'refund-savings',
        kind: 'settlement',
        date: '2026-11-16',
        createdAt,
        actor: 'a',
        from: 'household',
        to: 'a',
        fund: 'savings',
        amountMinor: 5000,
        note: '',
      },
    ];
    const doc = appendEntries(funded(), events);
    const daily = history(doc, 'operating', 'day', '2026-11-10', '2026-11-30');
    expect(daily[0].amountMinor).toBe(42000);
    expect(daily[1].amountMinor).toBe(42000);
    expect(daily.at(-1)?.amountMinor).toBe(
      recordedFunds(doc, '2026-11').unencumberedMinor,
    );
    expect(history(doc, 'savings')[0].amountMinor).toBe(
      recordedFunds(doc, '2026-11').savingsMinor,
    );
    expect(
      history(doc, 'savings', 'day', '2026-11-20', '2026-11-21').map(
        (p) => p.amountMinor,
      ),
    ).toEqual([60000, 60000]);
    expect(history(doc, 'expenses')[0].amountMinor).toBe(18000);
  });
  it('reversals restate the original period without counting repayments or movements as spending', () => {
    let doc = appendEntries(funded(), [
      {
        ...expense('purchase', '2026-11-10', 10000, 'household', [0, 0, 1]),
        fund: 'savings',
      },
    ]);
    doc = appendEntries(doc, [
      {
        id: 'reverse',
        kind: 'reversal',
        date: '2026-11-10',
        createdAt: '2026-12-01T12:00:00Z',
        actor: 'a',
        targetId: 'purchase',
        reason: 'Mistake',
      },
    ]);
    expect(history(doc, 'savings')[0].amountMinor).toBe(100000);
    expect(history(doc, 'expenses')[0].amountMinor).toBe(0);
  });
  it('clamps confirmation dates within their assigned month, using household local dates', () => {
    const base = {
      id: '2026-11:0:savings',
      member: 0 as const,
      fund: 'savings' as const,
      amountMinor: 10000,
      month: '2026-11',
    };
    expect(
      contributionDate({ ...base, confirmedAt: '2026-10-20T12:00:00Z' }),
    ).toBe('2026-11-01');
    expect(
      contributionDate({ ...base, confirmedAt: '2026-12-10T12:00:00Z' }),
    ).toBe('2026-11-30');
    expect(
      contributionDate({ ...base, confirmedAt: '2026-11-10T23:30:00Z' }),
    ).toBe('2026-11-11');
  });
  it('keeps monthly budget targets separate from spending and never sums cumulative balances', () => {
    const doc = {
      ...funded(),
      expenses: [{ ...funded().expenses[0], endDate: '2026-11-30' }],
    };
    expect(
      history(doc, 'budget', 'month', '2026-11-01', '2026-12-31').map(
        (p) => p.amountMinor,
      ),
    ).toEqual([100000, 0]);
    expect(
      history(doc, 'budget', 'day', '2026-11-10', '2026-11-12').map(
        (p) => p.amountMinor,
      ),
    ).toEqual([100000, 100000, 100000]);
    expect(
      history(doc, 'budget', 'year', '2026-01-01', '2026-11-30')[0].amountMinor,
    ).toBe(100000);
    expect(history(doc, 'expenses')[0].amountMinor).toBe(0);
    expect(
      history(doc, 'savings', 'year', '2026-01-01', '2026-12-31')[0]
        .amountMinor,
    ).toBe(100000);
  });
  it('supports empty histories and rejects reversed or invalid date ranges', () => {
    const doc = initialHousehold();
    expect(historyStart(doc, '2026-11-17')).toBe('2026-11-01');
    expect(history(doc, 'savings')[0].amountMinor).toBe(0);
    expect(() =>
      history(doc, 'expenses', 'day', '2026-11-30', '2026-11-01'),
    ).toThrow('date range');
    expect(() =>
      history(doc, 'expenses', 'day', '2026-02-30', '2026-11-01'),
    ).toThrow('date range');
  });
});
