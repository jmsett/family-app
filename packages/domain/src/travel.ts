import type { HouseholdPlan, TripGoal } from '@family/shared';
import { MAX_MINOR } from './index';
import { validDate } from './planning';
import { recordedFunds, activeEntries } from './ledger';
const DAY = 86400000;
export function tripLabel(name: string, id: string): string {
  const slug =
    name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 26) || 'trip';
  return `trip:${slug}-${id.replace(/-/g, '').slice(-8)}`;
}
export function tripBudget(trip: TripGoal) {
  const days =
    trip.startDate && trip.endDate
      ? Math.round(
          (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / DAY,
        ) + 1
      : trip.days;
  const nights = trip.nights;
  const foodMinor = 2 * days * trip.foodPerPersonMinor;
  const hotelMinor = nights * trip.hotelPerNightMinor;
  const flightsMinor = 2 * trip.flightPerPersonMinor;
  const baseMinor = foodMinor + hotelMinor + flightsMinor;
  const extrasMinor =
    trip.extrasMode === 'percentage'
      ? Math.ceil((baseMinor * trip.extrasBasisPoints) / 10000)
      : trip.extrasMinor;
  return {
    days,
    nights,
    foodMinor,
    hotelMinor,
    flightsMinor,
    baseMinor,
    extrasMinor,
    otherMinor: trip.otherMinor,
    totalMinor: baseMinor + extrasMinor + trip.otherMinor,
  };
}
export function validateTrips(trips: TripGoal[]): void {
  if (!Array.isArray(trips) || trips.length > 40)
    throw new Error('A household supports up to 40 trip goals.');
  const ids = new Set<string>(),
    labels = new Set<string>();
  let photos = 0;
  for (const t of trips) {
    if (
      !t ||
      typeof t.id !== 'string' ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(t.id) ||
      ids.has(t.id) ||
      typeof t.name !== 'string' ||
      !t.name.trim() ||
      t.name.length > 80 ||
      typeof t.label !== 'string' ||
      !/^trip:[a-z0-9-]{1,35}$/.test(t.label) ||
      labels.has(t.label)
    )
      throw new Error(
        'Enter a unique trip with a name of at most 80 characters.',
      );
    ids.add(t.id);
    labels.add(t.label);
    if (
      (t.startDate === null) !== (t.endDate === null) ||
      (t.startDate !== null &&
        (!validDate(t.startDate) ||
          !validDate(t.endDate!) ||
          t.endDate! < t.startDate))
    )
      throw new Error(
        'Enter both trip dates, or leave both blank. Return cannot precede departure.',
      );
    if (
      !Number.isInteger(t.days) ||
      t.days < 1 ||
      t.days > 366 ||
      !Number.isInteger(t.nights) ||
      t.nights < 0 ||
      t.nights > 366 ||
      (t.startDate && tripBudget(t).days > 366)
    )
      throw new Error(
        'Choose a trip duration of 1–366 days and 0–366 hotel nights.',
      );
    if (
      [
        t.foodPerPersonMinor,
        t.hotelPerNightMinor,
        t.flightPerPersonMinor,
        t.extrasMinor,
        t.otherMinor,
        t.allocatedMinor,
      ].some((n) => !Number.isSafeInteger(n) || n < 0 || n > MAX_MINOR) ||
      !['percentage', 'fixed'].includes(t.extrasMode) ||
      !Number.isInteger(t.extrasBasisPoints) ||
      t.extrasBasisPoints < 0 ||
      t.extrasBasisPoints > 10000 ||
      typeof t.archived !== 'boolean'
    )
      throw new Error('Check trip amounts and extra allowance (0–100%).');
    if (
      !Number.isSafeInteger(tripBudget(t).totalMinor) ||
      tripBudget(t).totalMinor > MAX_MINOR
    )
      throw new Error('Trip budget exceeds €1,000,000.');
    if (t.archived && t.allocatedMinor !== 0)
      throw new Error('Release the trip allocation before archiving.');
    if (
      t.photo !== null &&
      (typeof t.photo !== 'string' ||
        t.photo.length > 60000 ||
        !/^data:image\/jpeg;base64,[a-zA-Z0-9+/]+=*$/.test(t.photo))
    )
      throw new Error('Use a small JPEG destination photo.');
    photos += t.photo?.length ?? 0;
  }
  if (photos > 300000)
    throw new Error(
      'Trip photos exceed the shared limit. Remove an older destination photo first.',
    );
}
export function tripSavingsSpent(
  doc: HouseholdPlan,
  trip: TripGoal,
  month: string,
): number {
  const through = `${month}-31`;
  return activeEntries(doc.ledger, through)
    .filter(
      (e) =>
        e.kind === 'expense' &&
        e.source === 'household' &&
        e.fund === 'savings' &&
        e.labels.includes(trip.label),
    )
    .reduce((sum, e) => sum + ('amountMinor' in e ? e.amountMinor : 0), 0);
}
export function tripReserved(
  doc: HouseholdPlan,
  trip: TripGoal,
  month: string,
): number {
  return trip.archived
    ? 0
    : Math.max(0, trip.allocatedMinor - tripSavingsSpent(doc, trip, month));
}
export function tripSavings(doc: HouseholdPlan, month: string) {
  const savingsMinor = recordedFunds(doc, month).savingsMinor;
  const allocatedMinor = doc.trips
    .filter((t) => !t.archived)
    .reduce((n, t) => n + tripReserved(doc, t, month), 0);
  return {
    savingsMinor,
    allocatedMinor,
    unallocatedMinor: Math.max(0, savingsMinor - allocatedMinor),
    shortfallMinor: Math.max(0, allocatedMinor - Math.max(0, savingsMinor)),
  };
}
export function allocateTrip(
  doc: HouseholdPlan,
  id: string,
  amountMinor: number,
  month: string,
): HouseholdPlan {
  const trip = doc.trips.find((t) => t.id === id && !t.archived);
  if (!trip) throw new Error('Choose an active trip.');
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor < 0 ||
    amountMinor > MAX_MINOR
  )
    throw new Error('Enter a valid savings allocation.');
  if (
    amountMinor > trip.allocatedMinor &&
    amountMinor > tripBudget(trip).totalMinor
  )
    throw new Error('The allocation cannot exceed the trip budget.');
  if (
    Math.max(0, amountMinor - tripSavingsSpent(doc, trip, month)) -
      tripReserved(doc, trip, month) >
    tripSavings(doc, month).unallocatedMinor
  )
    throw new Error(
      'Not enough unallocated confirmed savings. Release another goal allocation or confirm savings first.',
    );
  const trips = doc.trips.map((t) =>
    t.id === id ? { ...t, allocatedMinor: amountMinor } : t,
  );
  validateTrips(trips);
  return { ...doc, trips };
}
