import type { HouseholdPlan } from '@family/shared';
import { activeEntries, effectivePayer } from './ledger';
import { monthlyPlan, validDate } from './planning';
export type HistoryMetric = 'expenses' | 'savings' | 'operating' | 'budget';
export type HistoryInterval = 'day' | 'week' | 'month' | 'year';
export interface HistoryPoint {
  time: string;
  startDate: string;
  endDate: string;
  amountMinor: number;
  fundedMinor?: number;
  targetMinor?: number;
}
const DAY = 86400000;
const epoch = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
export function monthEnd(month: string): string {
  const [year, index] = month.split('-').map(Number);
  return iso(Date.UTC(year, index, 0));
}
// A contribution is assigned to its planning month; the confirmation date is
// clamped to that month when a member confirms early or late.
const householdDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Busingen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function contributionDate(
  t: HouseholdPlan['transfers'][number],
): string {
  const date = householdDate.format(new Date(t.confirmedAt));
  return date < `${t.month}-01`
    ? `${t.month}-01`
    : date > monthEnd(t.month)
      ? monthEnd(t.month)
      : date;
}
export function historyStart(doc: HouseholdPlan, today: string): string {
  return (
    [
      ...doc.ledger.map((e) => e.date),
      ...doc.transfers.map(contributionDate),
      ...doc.expenses.map((e) => e.firstDueDate),
      ...doc.savingsTargets.map((t) => `${t.month}-01`),
      `${today.slice(0, 7)}-01`,
    ]
      .sort()[0]
      .slice(0, 7) + '-01'
  );
}
function period(date: string, interval: HistoryInterval): [string, string] {
  const time = epoch(date),
    d = new Date(time),
    year = d.getUTCFullYear(),
    month = d.getUTCMonth();
  if (interval === 'day') return [date, date];
  if (interval === 'week') {
    const start = time - ((d.getUTCDay() + 6) % 7) * DAY;
    return [iso(start), iso(start + 6 * DAY)];
  }
  if (interval === 'month')
    return [iso(Date.UTC(year, month, 1)), iso(Date.UTC(year, month + 1, 0))];
  return [iso(Date.UTC(year, 0, 1)), iso(Date.UTC(year, 11, 31))];
}
export function buildHistory(
  doc: HouseholdPlan,
  options: {
    metric: HistoryMetric;
    interval: HistoryInterval;
    from: string;
    to: string;
    category?: string;
  },
): HistoryPoint[] {
  const { metric, interval, from, to, category } = options;
  if (!validDate(from) || !validDate(to) || from > to)
    throw new Error('Choose a valid date range, with From before To.');
  if (
    !['expenses', 'savings', 'operating', 'budget'].includes(metric) ||
    !['day', 'week', 'month', 'year'].includes(interval)
  )
    throw new Error('Choose a chart series and interval.');
  type Change = {
    operating: number;
    savings: number;
    household: number;
    spending: number;
    operatingFunding: number;
    savingsFunding: number;
  };
  const changes = new Map<string, Change>();
  const at = (date: string) => {
    if (!changes.has(date))
      changes.set(date, {
        operating: 0,
        savings: 0,
        household: 0,
        spending: 0,
        operatingFunding: 0,
        savingsFunding: 0,
      });
    return changes.get(date)!;
  };
  for (const t of doc.transfers) {
    const change = at(contributionDate(t));
    change[t.fund] += t.amountMinor;
    change[t.fund === 'operating' ? 'operatingFunding' : 'savingsFunding'] +=
      t.amountMinor;
  }
  for (const event of activeEntries(doc.ledger)) {
    const c = at(event.date);
    if (event.kind === 'expense') {
      const payer = effectivePayer(event);
      c.household +=
        (payer === 'household' ? event.amountMinor : 0) - event.shares[2];
      if (payer === 'household')
        c[event.fund ?? 'operating'] -= event.amountMinor;
      if (!category || event.category === category)
        c.spending += event.amountMinor;
    } else if (event.kind === 'settlement') {
      if (event.from === 'household') {
        c[event.fund ?? 'operating'] -= event.amountMinor;
        c.household += event.amountMinor;
      }
      if (event.to === 'household') {
        c[event.fund ?? 'operating'] += event.amountMinor;
        c.household -= event.amountMinor;
      }
    } else {
      c[event.from] -= event.amountMinor;
      if (event.to !== 'external') c[event.to] += event.amountMinor;
    }
  }
  const dated = [...changes].sort(([a], [b]) => a.localeCompare(b));
  let index = 0,
    operating = 0,
    savings = 0,
    household = 0;
  const plans = new Map<
    string,
    { operatingMinor: number; savingsMinor: number }
  >();
  const funding = new Map<string, { operating: number; savings: number }>();
  const result: HistoryPoint[] = [];
  let cursor = from;
  // Read each financial change once, including opening balances before the range.
  while (cursor <= to) {
    const [start, end] = period(cursor, interval);
    const endDate = end > to ? to : end;
    let spending = 0;
    while (index < dated.length && dated[index][0] <= endDate) {
      const [date, c] = dated[index++];
      operating += c.operating;
      savings += c.savings;
      household += c.household;
      const month = date.slice(0, 7);
      const funded = funding.get(month) ?? { operating: 0, savings: 0 };
      funded.operating += c.operatingFunding;
      funded.savings += c.savingsFunding;
      funding.set(month, funded);
      if (date >= cursor) spending += c.spending;
    }
    const month = endDate.slice(0, 7);
    if (metric !== 'expenses' && !plans.has(month)) {
      const { operatingMinor, savingsMinor } = monthlyPlan(doc, month);
      plans.set(month, { operatingMinor, savingsMinor });
    }
    result.push({
      time: start,
      startDate: cursor,
      endDate,
      amountMinor:
        metric === 'expenses'
          ? spending
          : metric === 'savings'
            ? savings
            : metric === 'operating'
              ? operating - Math.max(0, -household)
              : plans.get(month)!.operatingMinor,
      ...(metric === 'operating' || metric === 'savings'
        ? {
            fundedMinor: funding.get(month)?.[metric] ?? 0,
            targetMinor:
              metric === 'operating'
                ? plans.get(month)!.operatingMinor
                : plans.get(month)!.savingsMinor,
          }
        : {}),
    });
    cursor = iso(epoch(endDate) + DAY);
  }
  return result;
}
