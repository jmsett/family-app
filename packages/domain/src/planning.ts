import type {
  BudgetDraft,
  Fund,
  FundingRule,
  HouseholdPlan,
  RecurringExpense,
  RecurringExpenseChange,
  TransferConfirmation,
} from '@family/shared';
import { MAX_MINOR, validateDraft } from './index';
import { canonicalEvent, validateLedger } from './ledger';
import { validateTrips } from './travel';

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
    schemaVersion: 9,
    revision: 0,
    memberNames: ['Member A', 'Member B'],
    expenses: [],
    expenseChanges: [],
    savingsTargets: [],
    incomes: [],
    fundingRules: [],
    trips: [],
    transfers: [],
    transferRetractions: [],
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
  expense: RecurringExpense & { dueDay?: number },
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
    expense.dueDay ?? Number(expense.firstDueDate.slice(8)),
    new Date(Date.UTC(year, index, 0)).getUTCDate(),
  );
  const due = `${month}-${String(day).padStart(2, '0')}`;
  return expense.endDate && due > expense.endDate ? null : due;
}
export function recurringExpenseFor(
  doc: HouseholdPlan,
  id: string,
  month: string,
): RecurringExpense & { dueDay: number } {
  const original = doc.expenses.find((e) => e.id === id);
  if (!original || !validMonth(month))
    throw new Error('Choose a recurring expense and a valid month.');
  const change = [...doc.expenseChanges]
    .filter((c) => c.expenseId === id && c.month <= month)
    .sort((a, b) => b.month.localeCompare(a.month))[0];
  return recurringValues(original, change);
}
function recurringValues(
  original: RecurringExpense,
  change?: RecurringExpenseChange,
): RecurringExpense & { dueDay: number } {
  return change
    ? {
        ...original,
        name: change.name,
        amountMinor: change.amountMinor,
        dueDay: change.dueDay,
        endDate: change.endDate,
        category: change.category,
        labels: [...change.labels],
      }
    : { ...original, dueDay: Number(original.firstDueDate.slice(8)) };
}
export function editRecurringExpense(
  doc: HouseholdPlan,
  id: string,
  month: string,
  values: Omit<RecurringExpenseChange, 'expenseId' | 'month'>,
  scope: 'forward' | 'all',
): HouseholdPlan {
  const original = doc.expenses.find((e) => e.id === id);
  if (!original || !validMonth(month) || !['forward', 'all'].includes(scope))
    throw new Error('Choose a recurring expense, month and edit scope.');
  const from = scope === 'all' ? original.firstDueDate.slice(0, 7) : month;
  if (from < original.firstDueDate.slice(0, 7))
    throw new Error(
      'Choose a month on or after the first payment, or apply to all months.',
    );
  const change = { ...values, expenseId: id, month: from };
  const next = {
    ...doc,
    expenseChanges: [
      ...doc.expenseChanges.filter((c) => c.expenseId !== id || c.month < from),
      change,
    ],
  };
  validateHousehold(next);
  return next;
}
export function deleteRecurringExpense(
  doc: HouseholdPlan,
  id: string,
): HouseholdPlan {
  if (!doc.expenses.some((e) => e.id === id))
    throw new Error('Recurring expense not found.');
  const next = {
    ...doc,
    expenses: doc.expenses.filter((e) => e.id !== id),
    expenseChanges: doc.expenseChanges.filter((c) => c.expenseId !== id),
  };
  validateHousehold(next);
  return next;
}
export function validateHousehold(doc: HouseholdPlan): void {
  if (
    !doc ||
    doc.schemaVersion !== 9 ||
    !Number.isSafeInteger(doc.revision) ||
    doc.revision < 0 ||
    !Array.isArray(doc.expenses) ||
    !Array.isArray(doc.expenseChanges) ||
    !Array.isArray(doc.savingsTargets) ||
    !Array.isArray(doc.incomes) ||
    !Array.isArray(doc.fundingRules) ||
    !Array.isArray(doc.trips) ||
    !Array.isArray(doc.transfers) ||
    !Array.isArray(doc.transferRetractions) ||
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
    doc.expenseChanges.length > 5000 ||
    doc.transfers.length > 5000 ||
    doc.transferRetractions.length > 5000 ||
    doc.savingsTargets.length > 1212 ||
    doc.incomes.length > 1212 ||
    doc.fundingRules.length > 1212 ||
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
  const recurringById = new Map(doc.expenses.map((e) => [e.id, e]));
  for (const change of doc.expenseChanges) {
    const original = change && recurringById.get(change.expenseId);
    if (
      !original ||
      !validMonth(change.month) ||
      change.month < original.firstDueDate.slice(0, 7) ||
      !Number.isInteger(change.dueDay) ||
      change.dueDay < 1 ||
      change.dueDay > 31 ||
      ids.has(`${change.expenseId}:${change.month}`)
    )
      throw new Error(
        'Invalid, orphaned or duplicate recurring expense change.',
      );
    validateExpense({
      ...original,
      name: change.name,
      amountMinor: change.amountMinor,
      endDate: change.endDate,
      category: change.category,
      labels: change.labels,
    });
    ids.add(`${change.expenseId}:${change.month}`);
  }
  ids.clear();
  for (const target of doc.savingsTargets) {
    if (!validMonth(target.month) || ids.has(target.month))
      throw new Error('Invalid or duplicate savings month.');
    amount(target.amountMinor);
    ids.add(target.month);
  }
  ids.clear();
  for (const income of doc.incomes) {
    if (
      !income ||
      !validMonth(income.month) ||
      ids.has(income.month) ||
      !Array.isArray(income.amountsMinor) ||
      income.amountsMinor.length !== 2
    )
      throw new Error('Invalid or duplicate income month.');
    income.amountsMinor.forEach(amount);
    amount(income.amountsMinor[0] + income.amountsMinor[1]);
    ids.add(income.month);
  }
  ids.clear();
  for (const rule of doc.fundingRules) {
    if (
      !rule ||
      !validMonth(rule.month) ||
      ids.has(rule.month) ||
      !['fixed', 'income'].includes(rule.mode) ||
      [
        rule.operatingBasisPoints,
        rule.leisureBasisPoints,
        rule.savingsBasisPoints,
      ].some((n) => !Number.isSafeInteger(n) || n < 0 || n > 10000) ||
      rule.operatingBasisPoints +
        rule.leisureBasisPoints +
        rule.savingsBasisPoints !==
        10000
    )
      throw new Error('Funding percentages must total 100%.');
    ids.add(rule.month);
  }
  ids.clear();
  for (const transfer of doc.transfers) {
    if (
      !transfer ||
      !validMonth(transfer.month) ||
      ![0, 1].includes(transfer.member) ||
      !(['operating', 'savings'] as string[]).includes(transfer.fund) ||
      !Number.isSafeInteger(transfer.generation) ||
      transfer.generation < 0 ||
      transfer.generation > 5000 ||
      transfer.id !==
        confirmationId(
          transfer.month,
          transfer.member,
          transfer.fund,
          transfer.generation,
        ) ||
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
  const confirmations = new Map(doc.transfers.map((t) => [t.id, t]));
  const retracted = new Set<string>();
  for (const entry of doc.transferRetractions) {
    const target = entry && confirmations.get(entry.confirmationId);
    if (
      !target ||
      entry.id !== `retract:${target.id}` ||
      entry.member !== target.member ||
      retracted.has(target.id) ||
      typeof entry.retractedAt !== 'string' ||
      !Number.isFinite(Date.parse(entry.retractedAt))
    )
      throw new Error('Invalid or duplicate funding retraction.');
    retracted.add(target.id);
  }
  for (const transfer of doc.transfers)
    if (transfer.generation > 0) {
      const previous = confirmationId(
        transfer.month,
        transfer.member,
        transfer.fund,
        transfer.generation - 1,
      );
      if (!confirmations.has(previous) || !retracted.has(previous))
        throw new Error(
          'A new funding confirmation must follow a retracted confirmation.',
        );
    }
  for (const draft of doc.legacyDrafts) validateDraft(draft);
  validateLedger(doc.ledger);
  validateTrips(doc.trips);
  for (const entry of doc.ledger) {
    if (
      entry.kind === 'expense' &&
      entry.source === 'household' &&
      entry.fund === 'savings' &&
      doc.trips.filter((t) => entry.labels.includes(t.label)).length > 1
    )
      throw new Error(
        'A savings-funded expense can use only one trip label. Split it into separate expenses for multiple trips.',
      );
  }
  // Validate aggregate limits, including forecasts at future effective boundaries.
  const months = new Set([
    ...doc.expenses.map((e) => e.firstDueDate.slice(0, 7)),
    ...doc.expenseChanges.map((c) => c.month),
    ...doc.savingsTargets.map((t) => t.month),
    ...doc.incomes.map((t) => t.month),
    ...doc.fundingRules.map((t) => t.month),
    ...doc.transfers.map((t) => t.month),
  ]);
  for (const month of months) {
    const {
      recurringMinor: operating,
      operatingMinor: target,
      savingsMinor: savings,
    } = monthlyPlan(doc, month);
    amount(operating);
    amount(target + savings);
    for (const fund of ['operating', 'savings'] as const)
      amount(
        activeTransfers(doc)
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
export function incomesFor(
  doc: HouseholdPlan,
  month: string,
): [number, number] {
  return (
    [...doc.incomes]
      .filter((t) => t.month <= month)
      .sort((a, b) => b.month.localeCompare(a.month))[0]?.amountsMinor ?? [0, 0]
  );
}
export function fundingRuleFor(doc: HouseholdPlan, month: string): FundingRule {
  return (
    [...doc.fundingRules]
      .filter((t) => t.month <= month)
      .sort((a, b) => b.month.localeCompare(a.month))[0] ?? {
      month,
      mode: 'fixed',
      operatingBasisPoints: 5000,
      leisureBasisPoints: 3000,
      savingsBasisPoints: 2000,
    }
  );
}
export function monthlyPlan(doc: HouseholdPlan, month: string) {
  if (!validMonth(month))
    throw new Error('Choose a month between 2000 and 2100.');
  const changes = new Map<string, RecurringExpenseChange>();
  for (const change of doc.expenseChanges) {
    const previous = changes.get(change.expenseId);
    if (change.month <= month && (!previous || previous.month < change.month))
      changes.set(change.expenseId, change);
  }
  const expenses = doc.expenses
    .flatMap((original) => {
      const expense = recurringValues(original, changes.get(original.id));
      const due = dueDate(expense, month);
      return due ? [{ ...expense, due }] : [];
    })
    .sort((a, b) => a.due.localeCompare(b.due) || a.name.localeCompare(b.name));
  const recurringMinor = expenses.reduce(
    (sum, expense) => sum + expense.amountMinor,
    0,
  );
  const rule = fundingRuleFor(doc, month);
  const incomes = incomesFor(doc, month);
  const minimumIncome = Math.min(...incomes);
  const perMember = (basisPoints: number) =>
    Math.floor((minimumIncome * basisPoints) / 10000);
  const operatingMinor =
    rule.mode === 'income'
      ? 2 * perMember(rule.operatingBasisPoints)
      : recurringMinor;
  const savingsMinor =
    rule.mode === 'income'
      ? 2 * perMember(rule.savingsBasisPoints)
      : savingsFor(doc, month);
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
  const transfers = activeTransfers(doc).filter((t) => t.month === month);
  return {
    expenses,
    recurringMinor,
    rule,
    incomes,
    leisureAllowances: incomes.map((n) =>
      Math.floor((n * rule.leisureBasisPoints) / 10000),
    ),
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
function confirmationId(
  month: string,
  member: 0 | 1,
  fund: Fund,
  generation: number,
): string {
  const key = `${month}:${member}:${fund}`;
  return generation === 0 ? key : `${key}:${generation}`;
}
export function activeTransfers(doc: HouseholdPlan): TransferConfirmation[] {
  const retracted = new Set(
    doc.transferRetractions.map((r) => r.confirmationId),
  );
  return doc.transfers.filter((t) => !retracted.has(t.id));
}
export function retractFundTransfer(
  doc: HouseholdPlan,
  id: string,
  member: 0 | 1,
  retractedAt: string,
): HouseholdPlan {
  const target = doc.transfers.find((t) => t.id === id);
  if (!target || target.member !== member)
    throw new Error('You can retract only your own funding confirmation.');
  if (doc.transferRetractions.some((r) => r.confirmationId === id)) return doc;
  const next = {
    ...doc,
    transferRetractions: [
      ...doc.transferRetractions,
      { id: `retract:${id}`, confirmationId: id, member, retractedAt },
    ],
  };
  validateHousehold(next);
  return next;
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
    activeTransfers(doc).some(
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
  const generation =
    Math.max(
      -1,
      ...doc.transfers
        .filter(
          (t) => t.month === month && t.member === member && t.fund === fund,
        )
        .map((t) => t.generation),
    ) + 1;
  const next = {
    ...doc,
    transfers: [
      ...doc.transfers,
      {
        id: confirmationId(month, member, fund, generation),
        generation,
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
  if (
    activeTransfers(doc).some((t) => t.month === month && t.member === member)
  )
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
    trips: [...doc.trips]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        label: t.label,
        startDate: t.startDate,
        endDate: t.endDate,
        days: t.days,
        nights: t.nights,
        foodPerPersonMinor: t.foodPerPersonMinor,
        hotelPerNightMinor: t.hotelPerNightMinor,
        flightPerPersonMinor: t.flightPerPersonMinor,
        extrasMode: t.extrasMode,
        extrasBasisPoints: t.extrasBasisPoints,
        extrasMinor: t.extrasMinor,
        otherMinor: t.otherMinor,
        allocatedMinor: t.allocatedMinor,
        photo: t.photo,
        archived: t.archived,
      })),
    incomes: [...doc.incomes]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((t) => ({ month: t.month, amountsMinor: t.amountsMinor })),
    fundingRules: [...doc.fundingRules]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((r) => ({
        month: r.month,
        mode: r.mode,
        operatingBasisPoints: r.operatingBasisPoints,
        leisureBasisPoints: r.leisureBasisPoints,
        savingsBasisPoints: r.savingsBasisPoints,
      })),
    ledger: [...doc.ledger]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((e) => JSON.parse(canonicalEvent(e))),
    expenses: [...doc.expenses].sort((a, b) => a.id.localeCompare(b.id)),
    expenseChanges: [...doc.expenseChanges]
      .sort(
        (a, b) =>
          a.expenseId.localeCompare(b.expenseId) ||
          a.month.localeCompare(b.month),
      )
      .map((c) => ({
        expenseId: c.expenseId,
        month: c.month,
        name: c.name,
        amountMinor: c.amountMinor,
        dueDay: c.dueDay,
        endDate: c.endDate,
        category: c.category,
        labels: c.labels,
      })),
    savingsTargets: [...doc.savingsTargets].sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
    transfers: [...doc.transfers]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => ({
        id: t.id,
        month: t.month,
        member: t.member,
        fund: t.fund,
        amountMinor: t.amountMinor,
        confirmedAt: t.confirmedAt,
        generation: t.generation,
      })),
    transferRetractions: [...doc.transferRetractions]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((r) => ({
        id: r.id,
        confirmationId: r.confirmationId,
        member: r.member,
        retractedAt: r.retractedAt,
      })),
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
            generation: 0,
          });
      }
    }
    next = { ...raw, schemaVersion: 4, ledger: raw.ledger ?? [], transfers };
  }
  if (next.schemaVersion === 4) {
    if (!Array.isArray(next.transfers))
      throw new Error('Invalid transfer history.');
    next = {
      ...next,
      schemaVersion: 5,
      transfers: next.transfers.map((t) => ({ ...t, generation: 0 })),
      transferRetractions: next.transferRetractions ?? [],
    };
  }
  if (next.schemaVersion === 5) {
    next = { ...next, schemaVersion: 6, incomes: [], fundingRules: [] };
  }
  if (next.schemaVersion === 6) next = { ...next, schemaVersion: 7, trips: [] };
  if (next.schemaVersion === 7) {
    if (!Array.isArray(next.trips)) throw new Error('Invalid trip data.');
    next = {
      ...next,
      schemaVersion: 8,
      trips: next.trips.map((t) => ({ ...t, otherMinor: 0 })),
    };
  }
  if (next.schemaVersion === 8)
    next = { ...next, schemaVersion: 9, expenseChanges: [] };
  validateHousehold(next as unknown as HouseholdPlan);
  return next as unknown as HouseholdPlan;
}
