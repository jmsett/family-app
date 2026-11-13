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
  mode: 'local-prototype';
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
