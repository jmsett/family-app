import { describe, expect, it } from 'vitest';
import {
  defaultHomeAssumptions,
  homeAffordability,
  loanPrincipal,
  initialHousehold,
  incomesFor,
  fundingRuleFor,
  monthlyPlan,
  confirmFundTransfer,
  validateHousehold,
  upgradeHousehold,
  buildHistory,
} from './index';
import sample from '../../../examples/demo-household.json';
describe('home affordability', () => {
  it('inverts a fully amortizing loan, including zero interest', () => {
    // €200,000 over 30 years at 4% needs €954.83 monthly, rounded to cents.
    expect(loanPrincipal(95483, 400, 30) / 100).toBeCloseTo(200000, 0);
    expect(loanPrincipal(100000, 0, 30)).toBe(36000000);
  });
  it('combines conservative and optimistic limits without confusing purchase costs with deposit', () => {
    const result = homeAffordability(550000, defaultHomeAssumptions);
    expect(result.low.paymentMinor).toBe(115000);
    expect(result.high.paymentMinor).toBe(157500);
    expect(result.low.priceMinor).toBeLessThan(result.high.priceMinor);
    expect(result.sensitivity[0].high.priceMinor).toBe(result.high.priceMinor);
    expect(result.sensitivity.at(-1)?.low.priceMinor).toBe(
      result.low.priceMinor,
    );
    const cash = homeAffordability(550000, {
      ...defaultHomeAssumptions,
      cashMinor: 5000000,
    });
    expect(
      Math.abs(cash.low.priceMinor - result.low.priceMinor - 5000000 / 1.1),
    ).toBeLessThan(1);
  });
  it('clamps unaffordable monthly payments and rejects reversed or invalid inputs', () => {
    expect(
      homeAffordability(10000, defaultHomeAssumptions).high.loanMinor,
    ).toBe(0);
    expect(
      homeAffordability(0, { ...defaultHomeAssumptions, cashMinor: 11000000 })
        .low.priceMinor,
    ).toBe(10000000);
    for (const bad of [
      { rateLowBasisPoints: 600 },
      { capLowBasisPoints: 5000 },
      { costsLowMinor: 60000 },
      { years: 0 },
      { years: 30.5 },
      { cashMinor: -1 },
      { purchaseCostsBasisPoints: NaN },
    ])
      expect(() =>
        homeAffordability(550000, { ...defaultHomeAssumptions, ...bad }),
      ).toThrow();
    expect(
      homeAffordability(550000, {
        ...defaultHomeAssumptions,
        otherDebtMinor: 30000,
      }).low.paymentMinor,
    ).toBe(85000);
  });
});
describe('effective income and shared funding rules', () => {
  const doc = {
    ...initialHousehold(),
    incomes: [
      { month: '2026-01', amountsMinor: [200000, 300000] as [number, number] },
      { month: '2026-07', amountsMinor: [220000, 350000] as [number, number] },
    ],
    fundingRules: [
      {
        month: '2026-02',
        mode: 'income' as const,
        operatingBasisPoints: 5000,
        leisureBasisPoints: 3000,
        savingsBasisPoints: 2000,
      },
    ],
  };
  it('keeps the fixed method by default and uses the lower income for equal fund amounts', () => {
    expect(fundingRuleFor(doc, '2026-01').mode).toBe('fixed');
    expect(incomesFor(doc, '2025-12')).toEqual([0, 0]);
    expect(monthlyPlan(doc, '2026-02')).toMatchObject({
      operatingMinor: 200000,
      savingsMinor: 80000,
      operatingShares: [100000, 100000],
      savingsShares: [40000, 40000],
      memberTargets: [140000, 140000],
      leisureAllowances: [60000, 90000],
    });
    expect(monthlyPlan(doc, '2026-07').operatingMinor).toBe(220000);
    expect(monthlyPlan(doc, '2026-06').operatingMinor).toBe(200000);
  });
  it('supports custom splits, zero income and deterministic cent rounding', () => {
    const custom = {
      ...doc,
      incomes: [
        {
          month: '2026-01',
          amountsMinor: [200001, 300000] as [number, number],
        },
      ],
      fundingRules: [
        {
          ...doc.fundingRules[0],
          operatingBasisPoints: 6000,
          leisureBasisPoints: 1500,
          savingsBasisPoints: 2500,
        },
      ],
    };
    expect(monthlyPlan(custom, '2026-03')).toMatchObject({
      operatingShares: [120000, 120000],
      savingsShares: [50000, 50000],
    });
    expect(monthlyPlan({ ...custom, incomes: [] }, '2026-03')).toMatchObject({
      operatingMinor: 0,
      savingsMinor: 0,
    });
    expect(() =>
      validateHousehold({
        ...custom,
        fundingRules: [{ ...custom.fundingRules[0], leisureBasisPoints: 3000 }],
      }),
    ).toThrow('100%');
    expect(() =>
      validateHousehold({
        ...custom,
        incomes: [{ month: '2026-01', amountsMinor: [-1, 100] }],
      }),
    ).toThrow();
  });
  it('preserves captured contributions and historical goal values after later income changes', () => {
    const funded = confirmFundTransfer(
      doc,
      '2026-02',
      0,
      'operating',
      '2026-02-03T12:00:00Z',
    );
    const edited = {
      ...funded,
      incomes: [
        ...funded.incomes,
        {
          month: '2026-03',
          amountsMinor: [400000, 500000] as [number, number],
        },
      ],
    };
    validateHousehold(edited);
    expect(monthlyPlan(edited, '2026-03').operatingMinor).toBe(400000);
    expect(funded.transfers[0].amountMinor).toBe(100000);
    const history = buildHistory(edited, {
      metric: 'operating',
      interval: 'month',
      from: '2026-02-01',
      to: '2026-03-31',
    });
    expect(history.map((p) => p.targetMinor)).toEqual([200000, 400000]);
    expect(history.map((p) => p.fundedMinor)).toEqual([100000, 0]);
  });
  it('migrates schema5 without adding income or changing existing financial history', () => {
    const old = {
      ...initialHousehold(),
      schemaVersion: 5,
      incomes: undefined,
      fundingRules: undefined,
    };
    expect(upgradeHousehold(old)).toEqual(initialHousehold());
  });
  it('ships realistic, validated and clearly fictional chart history', () => {
    const doc = upgradeHousehold(sample);
    validateHousehold(doc);
    expect(doc.ledger.length).toBeGreaterThan(200);
    const history = buildHistory(doc, {
      metric: 'savings',
      interval: 'month',
      from: '2025-01-01',
      to: '2026-11-30',
    });
    expect(history).toHaveLength(23);
    expect(history.at(-1)!.amountMinor).toBeGreaterThan(history[0].amountMinor);
    expect(doc.memberNames.every((n) => n.includes('sample'))).toBe(true);
  });
});
