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
export interface RecurringExpenseChange {
  expenseId: string;
  month: string;
  name: string;
  amountMinor: number;
  dueDay: number;
  endDate: string | null;
  category: string;
  labels: string[];
}
export type Fund = 'operating' | 'savings';
export interface TransferConfirmation {
  id: string;
  month: string;
  member: 0 | 1;
  fund: Fund;
  amountMinor: number;
  confirmedAt: string;
  generation: number;
}
export interface FundingRetraction {
  id: string;
  confirmationId: string;
  member: 0 | 1;
  retractedAt: string;
}
export interface HouseholdPlan {
  schemaVersion: 9;
  revision: number;
  memberNames: [string, string];
  expenses: RecurringExpense[];
  expenseChanges: RecurringExpenseChange[];
  savingsTargets: { month: string; amountMinor: number }[];
  incomes: { month: string; amountsMinor: [number, number] }[];
  fundingRules: FundingRule[];
  trips: TripGoal[];
  transfers: TransferConfirmation[];
  transferRetractions: FundingRetraction[];
  legacyDrafts: BudgetDraft[];
  ledger: LedgerEvent[];
}
export interface TripGoal {
  id: string;
  name: string;
  label: string;
  startDate: string | null;
  endDate: string | null;
  days: number;
  nights: number;
  foodPerPersonMinor: number;
  hotelPerNightMinor: number;
  flightPerPersonMinor: number;
  extrasMode: 'percentage' | 'fixed';
  extrasBasisPoints: number;
  extrasMinor: number;
  otherMinor: number;
  allocatedMinor: number;
  photo: string | null;
  archived: boolean;
}
export interface FundingRule {
  month: string;
  mode: 'fixed' | 'income';
  operatingBasisPoints: number;
  leisureBasisPoints: number;
  savingsBasisPoints: number;
}

export type Party = 'a' | 'b' | 'household';
export type SplitMode = 'equal' | 'amount' | 'percentage';
export type Shares = [number, number, number];
interface LedgerBase {
  id: string;
  date: string;
  createdAt: string;
  actor: 'a' | 'b';
}
export interface PostedExpense extends LedgerBase {
  kind: 'expense';
  replacesId?: string;
  description: string;
  amountMinor: number;
  payer: Party;
  source: 'personal' | 'household';
  fund?: Fund;
  splitMode: SplitMode;
  splitInput: Shares;
  shares: Shares;
  category: string;
  labels: string[];
}
export interface DebtSettlement extends LedgerBase {
  kind: 'settlement';
  fund?: Fund;
  from: Party;
  to: Party;
  amountMinor: number;
  note: string;
}
export interface LedgerReversal extends LedgerBase {
  kind: 'reversal';
  targetId: string;
  reason: string;
}
export interface FundMovement extends LedgerBase {
  kind: 'fund-movement';
  from: Fund;
  to: Fund | 'external';
  amountMinor: number;
  note: string;
}
export type LedgerEvent =
  PostedExpense | DebtSettlement | LedgerReversal | FundMovement;
