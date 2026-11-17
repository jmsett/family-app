import { describe, expect, it } from 'vitest';
import {
  initialHousehold,
  tripLabel,
  tripBudget,
  validateHousehold,
  validateTrips,
  confirmFundTransfer,
  allocateTrip,
  tripSavings,
  tripReserved,
  appendEntries,
  upgradeHousehold,
  recordedFunds,
} from './index';
import type { TripGoal } from '@family/shared';
const trip = (id = 'trip-1'): TripGoal => ({
  id,
  name: 'Rome getaway',
  label: tripLabel('Rome getaway', id),
  startDate: null,
  endDate: null,
  days: 7,
  nights: 6,
  foodPerPersonMinor: 3500,
  hotelPerNightMinor: 10000,
  flightPerPersonMinor: 20000,
  extrasMode: 'percentage',
  extrasBasisPoints: 1500,
  extrasMinor: 0,
  otherMinor: 0,
  allocatedMinor: 0,
  photo: null,
  archived: false,
});
const funded = () => {
  let doc = {
    ...initialHousehold(),
    savingsTargets: [{ month: '2026-11', amountMinor: 40000 }],
    trips: [trip(), trip('trip-2')],
  };
  for (const member of [0, 1] as const)
    doc = confirmFundTransfer(
      doc,
      '2026-11',
      member,
      'savings',
      '2026-11-02T12:00:00Z',
    );
  return doc;
};
describe('trip budgets and joint savings earmarks', () => {
  it('uses food for two travel days, hotel nights and two return flights with an editable contingency', () => {
    expect(tripBudget(trip())).toMatchObject({
      days: 7,
      nights: 6,
      foodMinor: 49000,
      hotelMinor: 60000,
      flightsMinor: 40000,
      extrasMinor: 22350,
      totalMinor: 171350,
    });
    expect(
      tripBudget({
        ...trip(),
        startDate: '2028-02-28',
        endDate: '2028-03-01',
        nights: 1,
        foodPerPersonMinor: 3000,
        flightPerPersonMinor: 15000,
      }),
    ).toMatchObject({ days: 3, nights: 1, totalMinor: 66700 });
    expect(
      tripBudget({ ...trip(), extrasMode: 'fixed', extrasMinor: 12345 })
        .totalMinor,
    ).toBe(161345);
    expect(
      tripBudget({
        ...trip(),
        startDate: '2026-11-01',
        endDate: '2026-11-01',
        nights: 0,
      }).days,
    ).toBe(1);
  });
  it('adds a planned lump sum once for both people without multiplying or changing contingency', () => {
    expect(tripBudget({ ...trip(), otherMinor: 25000 })).toMatchObject({
      extrasMinor: 22350,
      otherMinor: 25000,
      totalMinor: 196350,
    });
    expect(
      tripBudget({
        ...trip(),
        extrasMode: 'fixed',
        extrasMinor: 10000,
        otherMinor: 25000,
      }).totalMinor,
    ).toBe(184000);
    for (const otherMinor of [-1, 1.5, NaN, 100000000])
      expect(() => validateTrips([{ ...trip(), otherMinor }])).toThrow();
  });
  it('migrates schema7 trip budgets with zero other expenses, preserving allocations and photos', () => {
    const doc = funded();
    const old = {
      ...doc,
      schemaVersion: 7,
      trips: doc.trips.map((t) => ({ ...t, otherMinor: undefined })),
    };
    expect(upgradeHousehold(old)).toEqual(doc);
  });
  it('rejects invalid dates, durations, photos, duplicate labels and excessive money', () => {
    for (const bad of [
      { startDate: '2026-11-01' },
      { startDate: '2026-11-02', endDate: '2026-11-01' },
      { days: 0 },
      { nights: -1 },
      { photo: 'https://example.com/photo.jpg' },
      { foodPerPersonMinor: 100000000 },
      { extrasBasisPoints: 10001 },
    ])
      expect(() => validateTrips([{ ...trip(), ...bad }])).toThrow();
    expect(() =>
      validateTrips([trip(), { ...trip(), id: 'different' }]),
    ).toThrow();
    expect(
      tripLabel(
        'Côte d’Azur — a very long journey destination',
        crypto.randomUUID(),
      ).length,
    ).toBeLessThanOrEqual(40);
  });
  it('allocates only available confirmed savings, releases earmarks and never creates or moves funds', () => {
    const doc = funded();
    const next = allocateTrip(doc, 'trip-1', 30000, '2026-11');
    expect(tripSavings(next, '2026-11')).toMatchObject({
      savingsMinor: 40000,
      allocatedMinor: 30000,
      unallocatedMinor: 10000,
    });
    expect(recordedFunds(next, '2026-11')).toEqual(
      recordedFunds(doc, '2026-11'),
    );
    expect(() => allocateTrip(next, 'trip-2', 11000, '2026-11')).toThrow(
      'Not enough',
    );
    expect(
      tripSavings(allocateTrip(next, 'trip-1', 0, '2026-11'), '2026-11')
        .unallocatedMinor,
    ).toBe(40000);
    expect(() => allocateTrip(doc, 'trip-1', 200000, '2026-11')).toThrow(
      'budget',
    );
  });
  it('consumes a reserve once for a labeled savings purchase and restores it on reversal', () => {
    let doc = allocateTrip(funded(), 'trip-1', 30000, '2026-11');
    const goal = doc.trips[0];
    const purchase = {
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'expense' as const,
      date: '2026-11-10',
      createdAt: '2026-11-10T12:00:00Z',
      actor: 'a' as const,
      description: 'Hotel deposit',
      amountMinor: 10000,
      payer: 'household' as const,
      source: 'household' as const,
      fund: 'savings' as const,
      splitMode: 'equal' as const,
      splitInput: [0, 0, 1] as [number, number, number],
      shares: [0, 0, 10000] as [number, number, number],
      category: 'Travel',
      labels: [goal.label],
    };
    doc = appendEntries(doc, [purchase]);
    validateHousehold(doc);
    expect(tripReserved(doc, goal, '2026-11')).toBe(20000);
    expect(tripSavings(doc, '2026-11')).toMatchObject({
      savingsMinor: 30000,
      allocatedMinor: 20000,
      unallocatedMinor: 10000,
    });
    doc = appendEntries(doc, [
      {
        id: '00000000-0000-4000-8000-000000000002',
        kind: 'reversal',
        targetId: purchase.id,
        date: purchase.date,
        createdAt: '2026-11-11T12:00:00Z',
        actor: 'a',
        reason: 'Incorrect booking',
      },
    ]);
    expect(tripReserved(doc, goal, '2026-11')).toBe(30000);
    expect(tripSavings(doc, '2026-11').unallocatedMinor).toBe(10000);
    expect(() =>
      validateHousehold({
        ...doc,
        ledger: [{ ...purchase, labels: doc.trips.map((t) => t.label) }],
      }),
    ).toThrow('only one trip');
  });
  it('reports underfunding after a withdrawal without hiding the withdrawal or deleting goals', () => {
    let doc = allocateTrip(funded(), 'trip-1', 30000, '2026-11');
    doc = appendEntries(doc, [
      {
        id: '00000000-0000-4000-8000-000000000003',
        kind: 'fund-movement',
        from: 'savings',
        to: 'external',
        amountMinor: 20000,
        note: 'Emergency withdrawal',
        date: '2026-11-10',
        createdAt: '2026-11-10T12:00:00Z',
        actor: 'a',
      },
    ]);
    expect(tripSavings(doc, '2026-11')).toMatchObject({
      shortfallMinor: 10000,
      unallocatedMinor: 0,
    });
    expect(() => allocateTrip(doc, 'trip-2', 1, '2026-11')).toThrow(
      'Not enough',
    );
  });
  it('upgrades schema6 while preserving income, confirmations and records', () => {
    const doc = funded();
    const old = { ...doc, schemaVersion: 6, trips: undefined };
    expect(upgradeHousehold(old)).toEqual({ ...doc, trips: [] });
  });
});
