import type {
  BudgetDraft,
  Fund,
  HouseholdPlan,
  RecurringExpense,
  TransferConfirmation,
} from '@family/shared';
import { MAX_MINOR, validateDraft } from './index';
import { canonicalEvent, validateLedger } from './ledger';

export const EXPENSE_CATEGORIES = [
  'Home & bills',
  'Food',
  'Transportation',
  'Entertainment',
  'Health',
  'Other',
];
export function validMonth(month: string): boolean {
  return (
    typeof month === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
    month >= '2000-01' &&
    month <= '2100-12'
  );
}
export function validDate(date: string): boolean {
  return (
    typeof date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    validMonth(date.slice(0, 7)) &&
    Number.isFinite(new Date(`${date}T12:00:00Z`).getTime()) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
  );
}
function amount(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MINOR)
    throw new Error('Amounts must be whole cents between zero and €1,000,000.');
}
export function initialHousehold(): HouseholdPlan {
  return {
    schemaVersion: 4,
    revision: 0,
    memberNames: ['Member A', 'Member B'],
    expenses: [],
    savingsTargets: [],
    transfers: [],
    legacyDrafts: [],
    ledger: [],
  };
}
export function validateExpense(expense: RecurringExpense): void {
  if (
    !expense ||
    typeof expense.id !== 'string' ||
    !expense.id ||
    expense.id.length > 100 ||
    typeof expense.name !== 'string' ||
    !expense.name.trim() ||
    expense.name.length > 80
  )
    throw new Error('Enter an expense name of at most 80 characters.');
  amount(expense.amountMinor);
  if (!expense.amountMinor)
    throw new Error('Expense amount must be greater than zero.');
  if (
    !validDate(expense.firstDueDate) ||
    (expense.endDate !== null &&
      (!validDate(expense.endDate) || expense.endDate < expense.firstDueDate))
  )
    throw new Error(
      'Choose valid due and end dates. End date cannot precede the first payment.',
    );
  if (
    expense.archivedFromMonth !== null &&
    !validMonth(expense.archivedFromMonth)
  )
    throw new Error('Invalid archive month.');
  if (
    typeof expense.category !== 'string' ||
    !expense.category.trim() ||
    expense.category.length > 40 ||
    !Array.isArray(expense.labels) ||
    expense.labels.length > 12 ||
    expense.labels.some(
      (label) =>
        typeof label !== 'string' || !label.trim() || label.length > 40,
    )
  )
    throw new Error(
      'Use a category and up to 12 labels of at most 40 characters.',
    );
}
export function dueDate(
  expense: RecurringExpense,
  month: string,
): string | null {
  if (!validMonth(month))
    throw new Error('Choose a month between 2000 and 2100.');
  if (
    month < expense.firstDueDate.slice(0, 7) ||
    (expense.archivedFromMonth && month >= expense.archivedFromMonth)
  )
    return null;
  const [year, index] = month.split('-').map(Number);
  const day = Math.min(
    Number(expense.firstDueDate.slice(8)),
    new Date(Date.UTC(year, index, 0)).getUTCDate(),
  );
  const due = `${month}-${String(day).padStart(2, '0')}`;
  return expense.endDate && due > expense.endDate ? null : due;
}
export function validateHousehold(doc: HouseholdPlan): void {
  if (
    !doc ||
    doc.schemaVersion !== 4 ||
    !Number.isSafeInteger(doc.revision) ||
    doc.revision < 0 ||
    !Array.isArray(doc.expenses) ||
    !Array.isArray(doc.savingsTargets) ||
    !Array.isArray(doc.transfers) ||
    !Array.isArray(doc.legacyDrafts) ||
    !Array.isArray(doc.ledger)
  )
    throw new Error('Invalid or unsupported household data.');
  validateDraft({
    month: '2000-01',
    totalMinor: 0,
    savingsMinor: 0,
    firstMemberBasisPoints: 5000,
    memberNames: doc.memberNames,
    revision: doc.revision,
  });
  if (
    doc.expenses.length > 1000 ||
    doc.transfers.length > 5000 ||
    doc.savingsTargets.length > 1212 ||
    doc.legacyDrafts.length > 1212
  )
    throw new Error('Household data exceeds the supported size.');
  const ids = new Set<string>();
  for (const expense of doc.expenses) {
    validateExpense(expense);
    if (ids.has(expense.id)) throw new Error('Duplicate expense ID.');
    ids.add(expense.id);
  }
  ids.clear();
  for (const target of doc.savingsTargets) {
    if (!validMonth(target.month) || ids.has(target.month))
      throw new Error('Invalid or duplicate savings month.');
    amount(target.amountMinor);
    ids.add(target.month);
  }
  ids.clear();
  for (const transfer of doc.transfers) {
    if (
      !transfer ||
      !validMonth(transfer.month) ||
      ![0, 1].includes(transfer.member) ||
      !(['operating', 'savings'] as string[]).includes(transfer.fund) ||
      transfer.id !== `${transfer.month}:${transfer.member}:${transfer.fund}` ||
      ids.has(transfer.id) ||
      typeof transfer.confirmedAt !== 'string' ||
      !Number.isFinite(Date.parse(transfer.confirmedAt))
    )
      throw new Error('Invalid or duplicate transfer confirmation.');
    amount(transfer.amountMinor);
    if (transfer.amountMinor <= 0)
      throw new Error('A transfer must contain a positive amount.');
    ids.add(transfer.id);
  }
  for (const draft of doc.legacyDrafts) validateDraft(draft);
  validateLedger(doc.ledger);
  // Validate aggregate limits, including forecasts at future effective boundaries.
  const months = new Set([
    ...doc.expenses.map((e) => e.firstDueDate.slice(0, 7)),
    ...doc.savingsTargets.map((t) => t.month),
    ...doc.transfers.map((t) => t.month),
  ]);
  for (const month of months) {
    const operating = doc.expenses
      .filter((e) => dueDate(e, month))
      .reduce((sum, e) => sum + e.amountMinor, 0);
    const savings = savingsFor(doc, month);
    amount(operating);
    amount(operating + savings);
    for (const fund of ['operating', 'savings'] as const)
      amount(
        doc.transfers
          .filter((t) => t.month === month && t.fund === fund)
          .reduce((sum, t) => sum + t.amountMinor, 0),
      );
  }
}
export function savingsFor(doc: HouseholdPlan, month: string): number {
  return (
    [...doc.savingsTargets]
      .filter((t) => t.month <= month)
      .sort((a, b) => b.month.localeCompare(a.month))[0]?.amountMinor ?? 0
  );
}
export function monthlyPlan(doc: HouseholdPlan, month: string) {
  if (!validMonth(month))
    throw new Error('Choose a month between 2000 and 2100.');
  const expenses = doc.expenses
    .flatMap((expense) => {
      const due = dueDate(expense, month);
      return due ? [{ ...expense, due }] : [];
    })
    .sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
  const operatingMinor = expenses.reduce(
    (sum, expense) => sum + expense.amountMinor,
    0,
  );
  const savingsMinor = savingsFor(doc, month);
  const split = (value: number): [number, number] => [
    Math.floor(value / 2),
    value - Math.floor(value / 2),
  ];
  const operatingShares = split(operatingMinor);
  const memberTargets = split(operatingMinor + savingsMinor);
  const savingsShares: [number, number] = [
    memberTargets[0] - operatingShares[0],
    memberTargets[1] - operatingShares[1],
  ];
  const transfers = doc.transfers.filter((t) => t.month === month);
  return {
    expenses,
    operatingMinor,
    savingsMinor,
    totalMinor: operatingMinor + savingsMinor,
    operatingShares,
    savingsShares,
    memberTargets,
    confirmedOperatingMinor: transfers
      .filter((t) => t.fund === 'operating')
      .reduce((sum, t) => sum + t.amountMinor, 0),
    confirmedSavingsMinor: transfers
      .filter((t) => t.fund === 'savings')
      .reduce((sum, t) => sum + t.amountMinor, 0),
    transfers,
  };
}
export function confirmFundTransfer(
  doc: HouseholdPlan,
  month: string,
  member: 0 | 1,
  fund: Fund,
  confirmedAt: string,
): HouseholdPlan {
  if (member !== 0 && member !== 1)
    throw new Error('Choose a household member.');
  if (
    doc.transfers.some(
      (t) => t.month === month && t.member === member && t.fund === fund,
    )
  )
    throw new Error(
      'This member has already confirmed this fund for the month.',
    );
  const plan = monthlyPlan(doc, month);
  const amountMinor = (
    fund === 'operating' ? plan.operatingShares : plan.savingsShares
  )[member];
  if (!amountMinor) throw new Error('No transfer is required for this fund.');
  const next = {
    ...doc,
    transfers: [
      ...doc.transfers,
      {
        id: `${month}:${member}:${fund}`,
        month,
        member,
        fund,
        amountMinor,
        confirmedAt,
      },
    ],
  };
  validateHousehold(next);
  return next;
}
// Retained for combined declarations in domain integrations; the UI confirms each fund independently.
export function confirmTransfer(
  doc: HouseholdPlan,
  month: string,
  member: 0 | 1,
  confirmedAt: string,
): HouseholdPlan {
  if (doc.transfers.some((t) => t.month === month && t.member === member))
    throw new Error('This member has already confirmed a transfer this month.');
  const plan = monthlyPlan(doc, month);
  let next = doc;
  if (plan.operatingShares[member])
    next = confirmFundTransfer(next, month, member, 'operating', confirmedAt);
  if (plan.savingsShares[member])
    next = confirmFundTransfer(next, month, member, 'savings', confirmedAt);
  if (next === doc) throw new Error('No transfer is required.');
  return next;
}
export function fundingStatus(
  doc: HouseholdPlan,
  month: string,
  member: 0 | 1,
  fund: Fund,
) {
  const plan = monthlyPlan(doc, month);
  const confirmation = plan.transfers.find(
    (t) => t.member === member && t.fund === fund,
  );
  const target = (
    fund === 'operating' ? plan.operatingShares : plan.savingsShares
  )[member];
  return {
    confirmation,
    target,
    complete: !!confirmation || target === 0,
    notRequired: !confirmation && target === 0,
  };
}
export function migrateLegacyDrafts(drafts: BudgetDraft[]): HouseholdPlan {
  const legacyDrafts = [...drafts].sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  const next = {
    ...initialHousehold(),
    legacyDrafts,
    memberNames:
      legacyDrafts.at(-1)?.memberNames ?? initialHousehold().memberNames,
    savingsTargets: legacyDrafts.map((draft) => ({
      month: draft.month,
      amountMinor: draft.savingsMinor,
    })),
  };
  validateHousehold(next);
  return next;
}
export function canonicalHousehold(doc: HouseholdPlan): string {
  return JSON.stringify({
    memberNames: doc.memberNames,
    ledger: [...doc.ledger]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((e) => JSON.parse(canonicalEvent(e))),
    expenses: [...doc.expenses].sort((a, b) => a.id.localeCompare(b.id)),
    savingsTargets: [...doc.savingsTargets].sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
    transfers: [...doc.transfers].sort((a, b) => a.id.localeCompare(b.id)),
    legacyDrafts: [...doc.legacyDrafts].sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
  });
}

// Read-only structural migration: no recorded money or entries are invented.
export function upgradeHousehold(value: unknown): HouseholdPlan {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid household data.');
  const raw = value as Record<string, unknown>;
  let next = raw;
  if (raw.schemaVersion === 2 || raw.schemaVersion === 3) {
    if (!Array.isArray(raw.transfers))
      throw new Error('Invalid transfer history.');
    const ids = new Set<string>();
    const transfers: TransferConfirmation[] = [];
    for (const old of raw.transfers) {
      if (
        !old ||
        old.id !== `${old.month}:${old.member}` ||
        ids.has(old.id) ||
        !validMonth(old.month) ||
        ![0, 1].includes(old.member) ||
        typeof old.confirmedAt !== 'string' ||
        !Number.isFinite(Date.parse(old.confirmedAt))
      )
        throw new Error('Invalid legacy transfer confirmation.');
      amount(old.operatingMinor);
      amount(old.savingsMinor);
      if (old.operatingMinor + old.savingsMinor <= 0)
        throw new Error('Invalid empty legacy transfer.');
      ids.add(old.id);
      for (const fund of ['operating', 'savings'] as const) {
        const amountMinor =
          fund === 'operating' ? old.operatingMinor : old.savingsMinor;
        if (amountMinor > 0)
          transfers.push({
            id: `${old.id}:${fund}`,
            month: old.month,
            member: old.member,
            fund,
            amountMinor,
            confirmedAt: old.confirmedAt,
          });
      }
    }
    next = { ...raw, schemaVersion: 4, ledger: raw.ledger ?? [], transfers };
  }
  validateHousehold(next as unknown as HouseholdPlan);
  return next as unknown as HouseholdPlan;
}
