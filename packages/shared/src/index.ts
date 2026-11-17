export interface BudgetDraft {
  month: string;
  totalMinor: number;
  savingsMinor: number;
  memberNames: [string, string];
  firstMemberBasisPoints: number;
  revision: number;
}
export interface BudgetProjection {
  operatingMinor: number;
  memberTargetsMinor: [number, number];
}
export interface Workspace {
  mode: 'local-prototype' | 'device-pwa';
  currency: 'EUR';
  timezone: 'Europe/Busingen';
  draft: BudgetDraft;
  projection: BudgetProjection;
  recorded: {
    earmarkedMinor: number;
    expensesMinor: number;
    payableMinor: number;
  };
  categories: readonly string[];
}

export interface RecurringExpense {
  id: string;
  name: string;
  amountMinor: number;
  firstDueDate: string;
  endDate: string | null;
  archivedFromMonth: string | null;
  category: string;
  labels: string[];
}
export interface TransferConfirmation {
  id: string;
  month: string;
  member: 0 | 1;
  operatingMinor: number;
  savingsMinor: number;
  confirmedAt: string;
}
export interface HouseholdPlan {
  schemaVersion: 2;
  revision: number;
  memberNames: [string, string];
  expenses: RecurringExpense[];
  savingsTargets: { month: string; amountMinor: number }[];
  transfers: TransferConfirmation[];
  legacyDrafts: BudgetDraft[];
}
