import { describe, expect, it } from 'vitest';
import { initialDraft, parseMoney, projectBudget } from './index.js';

describe('money and contribution targets', () => {
  it('parses decimal input into exact cents without floating point multiplication', () => {
    expect(parseMoney('0.29')).toBe(29);
    expect(parseMoney('45,80')).toBe(4580);
    expect(parseMoney('1200')).toBe(120000);
    expect(parseMoney('1000000.00')).toBe(100000000);
  });
  it.each([
    '-1',
    '1.001',
    'NaN',
    'Infinity',
    '1e3',
    '',
    '1000000.01',
    '1,000.00',
  ])('rejects invalid amount %s', (value) => {
    expect(() => parseMoney(value)).toThrow();
  });
  it('A01: €1000 at 50/50 gives two €500 targets with no cash inferred', () => {
    const draft = {
      ...initialDraft('2026-11'),
      totalMinor: 100000,
      savingsMinor: 0,
    };
    expect(projectBudget(draft)).toEqual({
      operatingMinor: 100000,
      memberTargetsMinor: [50000, 50000],
    });
  });
  it('A02: a future 60/40 split does not mutate the past', () => {
    const original = initialDraft('2026-11');
    const next = {
      ...original,
      month: '2026-12',
      firstMemberBasisPoints: 6000,
    };
    expect(projectBudget(next).memberTargetsMinor).toEqual([72000, 48000]);
    expect(projectBudget(original).memberTargetsMinor).toEqual([60000, 60000]);
  });
  it('allocates every cent deterministically for all percentage splits', () => {
    for (let split = 0; split <= 10000; split++) {
      const result = projectBudget({
        ...initialDraft('2026-11'),
        totalMinor: 10001,
        savingsMinor: 0,
        firstMemberBasisPoints: split,
      });
      expect(result.memberTargetsMinor[0] + result.memberTargetsMinor[1]).toBe(
        10001,
      );
      expect(result.memberTargetsMinor[0]).toBeGreaterThanOrEqual(0);
    }
    expect(
      projectBudget({
        ...initialDraft('2026-11'),
        totalMinor: 1,
        savingsMinor: 0,
      }).memberTargetsMinor,
    ).toEqual([0, 1]);
  });
  it('keeps savings inside the allocation, not additional spending', () => {
    expect(projectBudget(initialDraft('2026-11')).operatingMinor).toBe(100000);
    expect(() =>
      projectBudget({ ...initialDraft('2026-11'), savingsMinor: 120001 }),
    ).toThrow('Savings cannot exceed');
  });
  it('rejects invalid dates, names, noninteger cents, shares and revisions', () => {
    for (const changes of [
      { month: '2026-13' },
      { totalMinor: 1.1 },
      { firstMemberBasisPoints: 10001 },
      { revision: -1 },
      { memberNames: ['A', ' a '] as [string, string] },
    ]) {
      expect(() =>
        projectBudget({ ...initialDraft('2026-11'), ...changes }),
      ).toThrow();
    }
  });
});
