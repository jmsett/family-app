import type {
  DebtSettlement,
  HouseholdPlan,
  LedgerEvent,
  Party,
  PostedExpense,
  Shares,
  SplitMode,
} from '@family/shared';
import { MAX_MINOR, validDate } from './index';
export const PARTIES: Party[] = ['a', 'b', 'household'];
export function partyName(doc: HouseholdPlan, party: Party): string {
  return party === 'household'
    ? 'Household'
    : doc.memberNames[party === 'a' ? 0 : 1];
}
export function parsePercentage(value: string): number {
  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(value))
    throw new Error('Use percentages with at most two decimal places.');
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  const points = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (points > 10000) throw new Error('Percentages cannot exceed 100%.');
  return points;
}
export function splitAmount(
  total: number,
  mode: SplitMode,
  input: Shares,
): Shares {
  if (!Number.isSafeInteger(total) || total <= 0 || total > MAX_MINOR)
    throw new Error('Enter a positive expense amount of at most €1,000,000.');
  if (
    !Array.isArray(input) ||
    input.length !== 3 ||
    input.some((v) => !Number.isSafeInteger(v) || v < 0)
  )
    throw new Error('Invalid split values.');
  const sum = input.reduce((a, b) => a + b, 0);
  if (mode === 'amount') {
    if (sum !== total)
      throw new Error('Split amounts must add up to the expense amount.');
    return [...input];
  }
  if (mode === 'equal') {
    if (!sum || input.some((v) => v !== 0 && v !== 1))
      throw new Error('Select at least one person or the household.');
  } else if (mode === 'percentage') {
    if (sum !== 10000) throw new Error('Split percentages must total 100%.');
  } else throw new Error('Choose a split method.');
  const shares = input.map((value) =>
    Math.floor((total * value) / sum),
  ) as Shares;
  const order = input
    .map((value, i) => ({ i, remainder: (total * value) % sum }))
    .filter(({ i }) => input[i] > 0)
    .sort((a, b) => b.remainder - a.remainder || b.i - a.i);
  let left = total - shares.reduce((a, b) => a + b, 0);
  for (const item of order) {
    if (!left) break;
    shares[item.i]++;
    left--;
  }
  return shares;
}
const positive = (value: number) =>
  Number.isSafeInteger(value) && value > 0 && value <= MAX_MINOR;
export function canonicalEvent(event: LedgerEvent): string {
  const base = {
    id: event.id,
    kind: event.kind,
    date: event.date,
    createdAt: event.createdAt,
    actor: event.actor,
  };
  if (event.kind === 'expense')
    return JSON.stringify({
      ...base,
      ...(event.replacesId ? { replacesId: event.replacesId } : {}),
      description: event.description,
      amountMinor: event.amountMinor,
      payer: event.payer,
      source: event.source,
      splitMode: event.splitMode,
      splitInput: event.splitInput,
      shares: event.shares,
      category: event.category,
      labels: event.labels,
    });
  if (event.kind === 'settlement')
    return JSON.stringify({
      ...base,
      from: event.from,
      to: event.to,
      amountMinor: event.amountMinor,
      note: event.note,
    });
  return JSON.stringify({
    ...base,
    targetId: event.targetId,
    reason: event.reason,
  });
}
export function validateLedger(events: LedgerEvent[]): void {
  if (!Array.isArray(events) || events.length > 3000)
    throw new Error(
      'Invalid ledger or supported history size exceeded. Export your data for review.',
    );
  const entries = new Map<string, LedgerEvent>();
  for (const event of events) {
    if (
      !event ||
      typeof event.id !== 'string' ||
      !event.id ||
      event.id.length > 100 ||
      entries.has(event.id) ||
      !validDate(event.date) ||
      !['a', 'b'].includes(event.actor) ||
      typeof event.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(event.createdAt))
    )
      throw new Error('Invalid or duplicate financial entry.');
    entries.set(event.id, event);
    if (event.kind === 'expense') {
      if (
        (event.replacesId !== undefined &&
          (typeof event.replacesId !== 'string' ||
            !event.replacesId ||
            event.replacesId === event.id)) ||
        typeof event.description !== 'string' ||
        !event.description.trim() ||
        event.description.length > 120 ||
        !positive(event.amountMinor) ||
        !PARTIES.includes(event.payer) ||
        !['personal', 'household'].includes(event.source) ||
        (event.payer === 'household' && event.source !== 'household') ||
        typeof event.category !== 'string' ||
        !event.category.trim() ||
        event.category.length > 40 ||
        !Array.isArray(event.labels) ||
        event.labels.length > 12 ||
        event.labels.some(
          (t) => typeof t !== 'string' || !t.trim() || t.length > 40,
        )
      )
        throw new Error(
          'Enter a description, positive amount, payer, category and valid labels.',
        );
      const expected = splitAmount(
        event.amountMinor,
        event.splitMode,
        event.splitInput,
      );
      if (
        !Array.isArray(event.shares) ||
        event.shares.length !== 3 ||
        expected.some((value, i) => value !== event.shares[i])
      )
        throw new Error('Expense shares do not match the split.');
    } else if (event.kind === 'settlement') {
      if (
        !PARTIES.includes(event.from) ||
        !PARTIES.includes(event.to) ||
        event.from === event.to ||
        !positive(event.amountMinor) ||
        typeof event.note !== 'string' ||
        event.note.length > 200
      )
        throw new Error(
          'Choose different settlement parties and a positive amount.',
        );
    } else if (event.kind === 'reversal') {
      if (
        typeof event.targetId !== 'string' ||
        typeof event.reason !== 'string' ||
        !event.reason.trim() ||
        event.reason.length > 200
      )
        throw new Error('A correction needs a reason and an original entry.');
    } else throw new Error('Unknown financial entry type.');
  }
  for (const event of events)
    if (event.kind === 'reversal') {
      const original = entries.get(event.targetId);
      if (
        !original ||
        original.kind === 'reversal' ||
        event.date !== original.date
      )
        throw new Error(
          'Corrections must reverse an existing payment or expense in its original period.',
        );
    }
  const corrected = new Set<string>();
  const reversed = new Set(
    events
      .filter((e) => e.kind === 'reversal')
      .map((e) => (e.kind === 'reversal' ? e.targetId : '')),
  );
  for (const event of events) {
    if (event.kind !== 'expense' || !event.replacesId) continue;
    const original = entries.get(event.replacesId);
    if (original?.kind !== 'expense' || !reversed.has(original.id))
      throw new Error(
        'A replacement expense must reference a reversed original expense.',
      );
    let root = original;
    const ancestors = new Set([event.id]);
    while (root.replacesId) {
      if (ancestors.has(root.id))
        throw new Error('Correction history contains a cycle.');
      ancestors.add(root.id);
      const parent = entries.get(root.replacesId);
      if (parent?.kind !== 'expense')
        throw new Error('Invalid original expense in correction history.');
      root = parent;
    }
    if (!reversed.has(event.id)) {
      if (corrected.has(root.id))
        throw new Error(
          'Concurrent corrections replace the same expense. Both copies are preserved; reverse one replacement before syncing again.',
        );
      corrected.add(root.id);
    }
  }
}
export function activeEntries(
  events: LedgerEvent[],
  through = '2100-12-31',
): (PostedExpense | DebtSettlement)[] {
  const reversed = new Set(
    events
      .filter((e) => e.kind === 'reversal' && e.date <= through)
      .map((e) => (e.kind === 'reversal' ? e.targetId : '')),
  );
  return events.filter(
    (event): event is PostedExpense | DebtSettlement =>
      event.kind !== 'reversal' &&
      event.date <= through &&
      !reversed.has(event.id),
  );
}
export function effectivePayer(expense: PostedExpense): Party {
  return expense.source === 'household' ? 'household' : expense.payer;
}
export function netBalances(events: LedgerEvent[]): Record<Party, number> {
  const balances = { a: 0, b: 0, household: 0 };
  for (const event of activeEntries(events)) {
    if (event.kind === 'expense') {
      balances[effectivePayer(event)] += event.amountMinor;
      PARTIES.forEach((party, i) => {
        balances[party] -= event.shares[i];
      });
    } else {
      balances[event.from] += event.amountMinor;
      balances[event.to] -= event.amountMinor;
    }
  }
  return balances;
}
export function suggestedPayments(
  events: LedgerEvent[],
): { from: Party; to: Party; amountMinor: number }[] {
  const net = netBalances(events),
    debtors = PARTIES.filter((p) => net[p] < 0),
    creditors = PARTIES.filter((p) => net[p] > 0);
  const result = [];
  for (const from of debtors)
    for (const to of creditors) {
      const amountMinor = Math.min(-net[from], net[to]);
      if (amountMinor > 0) {
        result.push({ from, to, amountMinor });
        net[from] += amountMinor;
        net[to] -= amountMinor;
      }
    }
  // With exactly three parties this requires one or two payments, the minimum.
  return result;
}
export function settlementLimit(
  events: LedgerEvent[],
  from: Party,
  to: Party,
): number {
  if (from === to) return 0;
  const net = netBalances(events);
  let direct = 0;
  for (const entry of activeEntries(events)) {
    if (entry.kind === 'expense') {
      const payer = effectivePayer(entry);
      if (payer === to) direct += entry.shares[PARTIES.indexOf(from)];
      if (payer === from) direct -= entry.shares[PARTIES.indexOf(to)];
    } else {
      if (entry.from === from && entry.to === to) direct -= entry.amountMinor;
      if (entry.from === to && entry.to === from) direct += entry.amountMinor;
    }
  }
  return Math.max(
    0,
    Math.min(-net[from], net[to]),
    Math.min(direct, Math.max(0, -net[from], net[to])),
  );
}
export function appendEntries(
  doc: HouseholdPlan,
  additions: LedgerEvent[],
): HouseholdPlan {
  const map = new Map(doc.ledger.map((e) => [e.id, e]));
  for (const event of additions) {
    const existing = map.get(event.id);
    if (existing && canonicalEvent(existing) !== canonicalEvent(event))
      throw new Error(
        'This financial entry ID already contains different information.',
      );
    if (existing) continue;
    if (
      event.kind === 'settlement' &&
      event.amountMinor >
        settlementLimit([...map.values()], event.from, event.to)
    )
      throw new Error(
        'The repayment exceeds the current net debt. Review the outstanding balance.',
      );
    if (
      event.kind === 'reversal' &&
      [...map.values()].some(
        (e) => e.kind === 'reversal' && e.targetId === event.targetId,
      )
    )
      throw new Error('This entry has already been reversed.');
    map.set(event.id, event);
  }
  const ledger = [...map.values()];
  validateLedger(ledger);
  return { ...doc, ledger };
}
export function recordedFunds(doc: HouseholdPlan, month: string) {
  const [year, index] = month.split('-').map(Number);
  const through = `${month}-${new Date(Date.UTC(year, index, 0)).getUTCDate()}`;
  let operatingMinor = doc.transfers
    .filter((t) => t.month <= month)
    .reduce((sum, t) => sum + t.operatingMinor, 0);
  const savingsMinor = doc.transfers
    .filter((t) => t.month <= month)
    .reduce((sum, t) => sum + t.savingsMinor, 0);
  for (const event of activeEntries(doc.ledger, through)) {
    if (event.kind === 'expense' && effectivePayer(event) === 'household')
      operatingMinor -= event.amountMinor;
    if (event.kind === 'settlement') {
      if (event.from === 'household') operatingMinor -= event.amountMinor;
      if (event.to === 'household') operatingMinor += event.amountMinor;
    }
  }
  const householdPayables = Math.max(
    0,
    -netBalances(doc.ledger.filter((e) => e.date <= through)).household,
  );
  return {
    operatingMinor,
    savingsMinor,
    householdPayables,
    unencumberedMinor: operatingMinor - householdPayables,
  };
}
export function categorySpending(doc: HouseholdPlan, from: string, to: string) {
  const totals = new Map<string, number>();
  for (const event of activeEntries(doc.ledger))
    if (event.kind === 'expense' && event.date >= from && event.date <= to)
      totals.set(
        event.category,
        (totals.get(event.category) ?? 0) + event.amountMinor,
      );
  return [...totals]
    .map(([category, amountMinor]) => ({ category, amountMinor }))
    .sort(
      (a, b) =>
        b.amountMinor - a.amountMinor || a.category.localeCompare(b.category),
    );
}
export function mergeLedger(
  local: LedgerEvent[],
  remote: LedgerEvent[],
): LedgerEvent[] {
  const map = new Map(remote.map((e) => [e.id, e]));
  for (const event of local) {
    const existing = map.get(event.id);
    if (existing && canonicalEvent(existing) !== canonicalEvent(event))
      throw new Error(
        'Conflicting versions of a financial entry. Export both copies for review.',
      );
    if (!existing) map.set(event.id, event);
  }
  const merged = [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
  validateLedger(merged);
  const localIds = new Set(local.map((e) => e.id)),
    remoteIds = new Set(remote.map((e) => e.id));
  const localOnly = local.filter((e) => !remoteIds.has(e.id)),
    remoteOnly = remote.filter((e) => !localIds.has(e.id));
  if (localOnly.length && remoteOnly.length) {
    const active = new Set(activeEntries(merged).map((e) => e.id));
    const repayments = [...localOnly, ...remoteOnly]
      .filter(
        (e): e is DebtSettlement => e.kind === 'settlement' && active.has(e.id),
      )
      .sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      );
    const repaymentIds = new Set(repayments.map((e) => e.id));
    const checked = merged.filter((e) => !repaymentIds.has(e.id));
    for (const event of repayments) {
      if (event.amountMinor > settlementLimit(checked, event.from, event.to))
        throw new Error(
          'Concurrent repayments exceed the net debt. Both copies are preserved. Reverse the duplicate or incorrect payment before syncing again.',
        );
      checked.push(event);
    }
  }
  return merged;
}
