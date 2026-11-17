import type { BudgetDraft, BudgetProjection } from '@family/shared';

export const MAX_MINOR = 100_000_000;
export const DEFAULT_CATEGORIES = [
  'Groceries',
  'Home & bills',
  'Transport',
  'Health',
  'Leisure',
  'Other',
] as const;

export function parseMoney(value: string): number {
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(value))
    throw new Error('Enter a positive amount with at most two decimal places.');
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor > MAX_MINOR)
    throw new Error('Amount must be at most €1,000,000.');
  return minor;
}

export function validateDraft(draft: BudgetDraft): void {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.month) ||
    draft.month < '2000-01' ||
    draft.month > '2100-12'
  )
    throw new Error('Choose a month between 2000 and 2100.');
  for (const amount of [draft.totalMinor, draft.savingsMinor]) {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_MINOR)
      throw new Error(
        'Amounts must be whole cents between zero and €1,000,000.',
      );
  }
  if (draft.savingsMinor > draft.totalMinor)
    throw new Error('Savings cannot exceed the total allocation.');
  if (
    !Number.isInteger(draft.firstMemberBasisPoints) ||
    draft.firstMemberBasisPoints < 0 ||
    draft.firstMemberBasisPoints > 10_000
  )
    throw new Error('Contribution shares must total 100%.');
  if (
    !Array.isArray(draft.memberNames) ||
    draft.memberNames.length !== 2 ||
    draft.memberNames.some(
      (name) => typeof name !== 'string' || !name.trim() || name.length > 40,
    )
  )
    throw new Error('Enter two member names of at most 40 characters.');
  if (
    draft.memberNames[0].trim().toLowerCase() ===
    draft.memberNames[1].trim().toLowerCase()
  )
    throw new Error('Use different names for each member.');
  if (!Number.isSafeInteger(draft.revision) || draft.revision < 0)
    throw new Error('Invalid draft revision.');
}

export function projectBudget(draft: BudgetDraft): BudgetProjection {
  validateDraft(draft);
  // First member rounds down; second receives any remainder. Targets always sum exactly.
  const first = Math.floor(
    (draft.totalMinor * draft.firstMemberBasisPoints) / 10_000,
  );
  return {
    operatingMinor: draft.totalMinor - draft.savingsMinor,
    memberTargetsMinor: [first, draft.totalMinor - first],
  };
}

export function initialDraft(month: string): BudgetDraft {
  return {
    month,
    totalMinor: 120_000,
    savingsMinor: 20_000,
    memberNames: ['Member A', 'Member B'],
    firstMemberBasisPoints: 5000,
    revision: 0,
  };
}

export * from './planning';

export * from './ledger';

export * from './history';

export * from './investments';
