import { describe, expect, it } from 'vitest';
import type {
  HouseholdPlan,
  DebtSettlement,
  PostedExpense,
  LedgerReversal,
  Shares,
  Party,
} from '@family/shared';
import {
  activeEntries,
  appendEntries,
  categorySpending,
  confirmTransfer,
  initialHousehold,
  mergeLedger,
  netBalances,
  parsePercentage,
  recordedFunds,
  settlementLimit,
  splitAmount,
  suggestedPayments,
  upgradeHousehold,
} from './index';
const date = '2026-11-10';
const createdAt = `${date}T12:00:00Z`;
function expense(
  id = 'dinner',
  amountMinor = 8000,
  payer: Party = 'a',
  input: Shares = [1, 1, 0],
): PostedExpense {
  return {
    id,
    kind: 'expense',
    description: 'Dinner',
    amountMinor,
    payer,
    source: payer === 'household' ? 'household' : 'personal',
    date,
    createdAt,
    actor: 'a',
    splitMode: 'equal',
    splitInput: input,
    shares: splitAmount(amountMinor, 'equal', input),
    category: 'Food',
    labels: ['shared'],
  };
}
function payment(
  id: string,
  from: Party,
  to: Party,
  amountMinor: number,
): DebtSettlement {
  return {
    id,
    kind: 'settlement',
    from,
    to,
    amountMinor,
    date,
    createdAt,
    actor: 'b',
    note: '',
  };
}
function reverse(targetId: string, id = 'reverse'): LedgerReversal {
  return {
    id,
    kind: 'reversal',
    targetId,
    date,
    createdAt,
    actor: 'a',
    reason: 'Duplicate',
  };
}
describe('expense splits in whole cents', () => {
  it('allocates every cent deterministically for equal, exact and percentage splits', () => {
    expect(splitAmount(10001, 'equal', [1, 1, 0])).toEqual([5000, 5001, 0]);
    expect(splitAmount(10000, 'equal', [1, 1, 1])).toEqual([3333, 3333, 3334]);
    expect(splitAmount(10001, 'amount', [2000, 8001, 0])).toEqual([
      2000, 8001, 0,
    ]);
    expect(
      splitAmount(10001, 'percentage', [
        parsePercentage('33.33'),
        parsePercentage('66,67'),
        0,
      ]),
    ).toEqual([3333, 6668, 0]);
    expect(() => splitAmount(8000, 'amount', [2000, 5000, 0])).toThrow(
      'add up',
    );
    expect(() => splitAmount(8000, 'percentage', [5000, 4999, 0])).toThrow(
      '100%',
    );
    expect(() => splitAmount(8000, 'equal', [0, 0, 0])).toThrow('Select');
    expect(() => parsePercentage('33.333')).toThrow('two decimal');
  });
});
describe('three-party ledger and household funds', () => {
  it('nets shared costs and partial payments, preventing overpayment and duplicates', () => {
    let doc = appendEntries(initialHousehold(), [expense()]);
    expect(netBalances(doc.ledger)).toEqual({
      a: 4000,
      b: -4000,
      household: 0,
    });
    expect(suggestedPayments(doc.ledger)).toEqual([
      { from: 'b', to: 'a', amountMinor: 4000 },
    ]);
    const partial = payment('partial', 'b', 'a', 1500);
    doc = appendEntries(doc, [partial]);
    expect(appendEntries(doc, [partial]).ledger).toHaveLength(2);
    expect(netBalances(doc.ledger).b).toBe(-2500);
    expect(() => appendEntries(doc, [payment('over', 'b', 'a', 2501)])).toThrow(
      'exceeds',
    );
    expect(() =>
      appendEntries(doc, [{ ...partial, amountMinor: 1000 }]),
    ).toThrow('different');
    expect(categorySpending(doc, '2026-11-01', '2026-11-30')).toEqual([
      { category: 'Food', amountMinor: 8000 },
    ]);
  });
  it('reserves personal advances and avoids counting reimbursement twice', () => {
    let doc = initialHousehold();
    doc = {
      ...doc,
      expenses: [
        {
          id: 'rent',
          name: 'Rent',
          amountMinor: 100000,
          firstDueDate: '2026-11-01',
          endDate: null,
          archivedFromMonth: null,
          category: 'Home & bills',
          labels: [],
        },
      ],
    };
    doc = confirmTransfer(
      confirmTransfer(doc, '2026-11', 0, createdAt),
      '2026-11',
      1,
      createdAt,
    );
    doc = appendEntries(doc, [expense('advance', 8000, 'a', [0, 0, 1])]);
    expect(recordedFunds(doc, '2026-11')).toMatchObject({
      operatingMinor: 100000,
      householdPayables: 8000,
      unencumberedMinor: 92000,
    });
    doc = appendEntries(doc, [payment('refund', 'household', 'a', 8000)]);
    expect(recordedFunds(doc, '2026-12')).toMatchObject({
      operatingMinor: 92000,
      householdPayables: 0,
      unencumberedMinor: 92000,
    });
    expect(netBalances(doc.ledger)).toEqual({ a: 0, b: 0, household: 0 });
    doc = appendEntries(doc, [
      expense('household-purchase', 2000, 'household', [0, 0, 1]),
    ]);
    expect(recordedFunds(doc, '2026-12').unencumberedMinor).toBe(90000);
    expect(
      categorySpending(doc, '2026-11-01', '2026-11-30')[0].amountMinor,
    ).toBe(10000);
    expect(recordedFunds(doc, '2026-10').operatingMinor).toBe(0);
  });
  it('tracks incoming household repayments and minimum transfers across three parties', () => {
    let doc = appendEntries(initialHousehold(), [
      expense('advance', 8000, 'a', [0, 0, 1]),
      expense('personal', 8000, 'household', [0, 1, 0]),
    ]);
    expect(suggestedPayments(doc.ledger)).toEqual([
      { from: 'b', to: 'a', amountMinor: 8000 },
    ]);
    // Actual bilateral payments remain possible instead of the simplified route.
    expect(settlementLimit(doc.ledger, 'household', 'a')).toBe(8000);
    doc = appendEntries(doc, [
      payment('household-refund', 'household', 'a', 8000),
      payment('personal-refund', 'b', 'household', 8000),
    ]);
    expect(suggestedPayments(doc.ledger)).toEqual([]);
    expect(recordedFunds(doc, '2026-11').operatingMinor).toBe(-8000);
    const two = [expense('one', 9000, 'a', [1, 1, 1])];
    const payments = suggestedPayments(two);
    expect(payments).toHaveLength(2);
    const settled = payments.reduce<HouseholdPlan>(
      (d, p, i) =>
        appendEntries(d, [payment(`pay${i}`, p.from, p.to, p.amountMinor)]),
      { ...initialHousehold(), ledger: two },
    );
    expect(Object.values(netBalances(settled.ledger))).toEqual([0, 0, 0]);
  });
  it('eliminates circular debts and retains reversals and corrected history', () => {
    const cycle = [
      expense('a', 5000, 'a', [0, 1, 0]),
      expense('b', 5000, 'b', [0, 0, 1]),
      expense('h', 5000, 'household', [1, 0, 0]),
    ];
    expect(suggestedPayments(cycle)).toEqual([]);
    let doc = appendEntries(initialHousehold(), [expense()]);
    doc = appendEntries(doc, [reverse('dinner'), expense('corrected', 10000)]);
    expect(doc.ledger).toHaveLength(3);
    expect(activeEntries(doc.ledger)).toHaveLength(1);
    expect(netBalances(doc.ledger).a).toBe(5000);
    expect(
      categorySpending(doc, '2026-11-01', '2026-11-30')[0].amountMinor,
    ).toBe(10000);
    expect(() => appendEntries(doc, [reverse('dinner', 'again')])).toThrow(
      'already',
    );
    expect(() =>
      appendEntries(doc, [
        { ...reverse('corrected'), id: 'wrong', date: '2026-12-01' },
      ]),
    ).toThrow('original period');
  });
  it('upgrades v2 data while preserving targets, confirmations and legacy history', () => {
    const current = initialHousehold();
    expect(
      upgradeHousehold({ ...current, schemaVersion: 2, ledger: undefined }),
    ).toEqual(current);
  });
});
describe('offline immutable ledger merge', () => {
  it('unions independent purchases and deduplicates identical IDs', () => {
    const a = expense('a'),
      b = expense('b');
    expect(mergeLedger([a], [b])).toHaveLength(2);
    expect(mergeLedger([a], [a])).toEqual([a]);
    expect(() => mergeLedger([a], [{ ...a, description: 'Changed' }])).toThrow(
      'Conflicting',
    );
  });
  it('rejects concurrent overpayments and allows reversing a duplicate to resolve it', () => {
    const original = expense();
    const local = [original, payment('local', 'b', 'a', 3000)];
    const remote = [original, payment('remote', 'b', 'a', 3000)];
    expect(() => mergeLedger(local, remote)).toThrow('Concurrent repayments');
    const merged = mergeLedger([...local, reverse('local')], remote);
    expect(netBalances(merged).b).toBe(-1000);
    expect(merged).toHaveLength(4);
  });
  it('blocks competing offline corrections rather than counting both replacements', () => {
    const original = expense();
    const a = { ...expense('correction-a', 9000), replacesId: original.id };
    const b = { ...expense('correction-b', 10000), replacesId: original.id };
    const local = [original, reverse(original.id, 'reverse-a'), a];
    const remote = [original, reverse(original.id, 'reverse-b'), b];
    expect(() => mergeLedger(local, remote)).toThrow('Concurrent corrections');
    const merged = mergeLedger([...local, reverse(a.id, 'discard-a')], remote);
    expect(netBalances(merged).a).toBe(5000);
  });
  it('merges two affordable partial repayments', () => {
    const original = expense();
    expect(
      netBalances(
        mergeLedger(
          [original, payment('one', 'b', 'a', 1000)],
          [original, payment('two', 'b', 'a', 2000)],
        ),
      ).b,
    ).toBe(-1000);
  });
});

it('records savings transfers, withdrawals and purchases once and reverses movements without affecting personal debt', async () => {
  const { confirmFundTransfer } = await import('./index');
  let doc = confirmFundTransfer(
    {
      ...initialHousehold(),
      savingsTargets: [{ month: '2026-11', amountMinor: 200000 }],
    },
    '2026-11',
    0,
    'savings',
    createdAt,
  );
  const movement = {
    id: 'move',
    kind: 'fund-movement' as const,
    from: 'savings' as const,
    to: 'operating' as const,
    amountMinor: 20000,
    date,
    createdAt,
    actor: 'a' as const,
    note: 'Move savings to operating',
  };
  doc = appendEntries(doc, [movement]);
  expect(recordedFunds(doc, '2026-11')).toMatchObject({
    operatingMinor: 20000,
    savingsMinor: 80000,
  });
  doc = appendEntries(doc, [
    {
      ...movement,
      id: 'withdrawal',
      to: 'external',
      amountMinor: 5000,
      note: 'Leave tracked funds',
    },
  ]);
  const purchase = {
    ...expense('savings-purchase', 10000, 'household', [0, 0, 1]),
    fund: 'savings' as const,
  };
  doc = appendEntries(doc, [purchase]);
  expect(recordedFunds(doc, '2026-12')).toMatchObject({
    operatingMinor: 20000,
    savingsMinor: 65000,
  });
  expect(netBalances(doc.ledger)).toEqual({ a: 0, b: 0, household: 0 });
  expect(categorySpending(doc, '2026-11-01', '2026-11-30')).toEqual([
    { category: 'Food', amountMinor: 10000 },
  ]);
  doc = appendEntries(doc, [reverse('move', 'reverse-movement')]);
  expect(recordedFunds(doc, '2026-12')).toMatchObject({
    operatingMinor: 0,
    savingsMinor: 85000,
  });
  expect(mergeLedger(doc.ledger, doc.ledger)).toHaveLength(4);
});
it('computes personal history impact from the funding party, separately from who entered an expense', async () => {
  const { memberImpact } = await import('./index');
  const otherPaid = expense('other', 8000, 'b');
  expect(otherPaid.actor).toBe('a');
  expect(memberImpact(otherPaid, 'a', [otherPaid])).toBe(-4000);
  expect(memberImpact(otherPaid, 'b', [otherPaid])).toBe(4000);
  const householdPaid = { ...otherPaid, source: 'household' as const };
  expect(memberImpact(householdPaid, 'b', [householdPaid])).toBe(-4000);
  expect(memberImpact(payment('partial', 'a', 'b', 1000), 'a', [])).toBe(1000);
  expect(memberImpact(reverse(otherPaid.id), 'a', [otherPaid])).toBe(4000);
});
it('allows a household repayment to use savings without counting another expense', () => {
  let doc = appendEntries(initialHousehold(), [
    expense('advance', 8000, 'a', [0, 0, 1]),
  ]);
  doc = appendEntries(doc, [
    { ...payment('refund', 'household', 'a', 8000), fund: 'savings' },
  ]);
  expect(recordedFunds(doc, '2026-11')).toMatchObject({
    operatingMinor: 0,
    savingsMinor: -8000,
    householdPayables: 0,
  });
  expect(categorySpending(doc, '2026-11-01', '2026-11-30')[0].amountMinor).toBe(
    8000,
  );
});

it('upgrades schema3 without changing any posted expense or its personal balance', () => {
  const original = expense('before-upgrade');
  const doc = upgradeHousehold({
    ...initialHousehold(),
    schemaVersion: 3,
    ledger: [original],
  });
  expect(doc.ledger).toEqual([original]);
  expect(netBalances(doc.ledger)).toEqual({ a: 4000, b: -4000, household: 0 });
});
