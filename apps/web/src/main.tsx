import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  canonicalHousehold,
  confirmFundTransfer,
  fundingStatus,
  EXPENSE_CATEGORIES,
  monthlyPlan,
  parseMoney,
  recordedFunds,
  savingsFor,
  validateExpense,
  validateHousehold,
} from '@family/domain';
import type { Fund, HouseholdPlan, RecurringExpense } from '@family/shared';
import { readRecord, saveHousehold } from './storage';
import { FundActivity } from './FundActivity';
import { LedgerPanel } from './LedgerPanel';
import { SyncPanel } from './SyncPanel';
import { useAppearance } from './appearance';
import { AppearancePanel } from './AppearancePanel';
import { AppearanceContext } from './ProgressBar';
import './style.css';
const HistoryPanel = lazy(() => import('./HistoryPanel'));
import { NavIcon } from './NavIcon';

const money = (value: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
    value / 100,
  );
const amountInput = (value: number) => (value / 100).toFixed(2);
const today = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Busingen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
const monthName = (month: string) =>
  new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00Z`));
type Commit = (doc: HouseholdPlan) => Promise<boolean>;
type Page = 'overview' | 'plan' | 'charts' | 'settings';

function MonthlyPlan({
  document,
  month,
  disabled,
  commit,
  onDirty,
}: {
  document: HouseholdPlan;
  month: string;
  disabled: boolean;
  commit: Commit;
  onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(document);
  const [savings, setSavings] = useState(
    amountInput(savingsFor(document, month)),
  );
  const [adding, setAdding] = useState(false);
  const emptyExpense = () => ({
    name: '',
    amount: '',
    firstDueDate: `${month}-01`,
    category: 'Home & bills',
    customCategory: '',
    labels: '',
    duration: 'indefinite',
    endDate: '',
  });
  const [expense, setExpense] = useState(emptyExpense);
  const [expenseTouched, setExpenseTouched] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  useEffect(() => {
    setDraft(document);
    setSavings(amountInput(savingsFor(document, month)));
  }, [document, month]);
  let candidate = draft;
  let validation = '';
  try {
    const amountMinor = parseMoney(savings);
    if (amountMinor !== savingsFor(draft, month))
      candidate = {
        ...draft,
        savingsTargets: [
          ...draft.savingsTargets.filter((t) => t.month !== month),
          { month, amountMinor },
        ],
      };
    validateHousehold(candidate);
  } catch (error) {
    validation = (error as Error).message;
  }
  const dirty =
    canonicalHousehold(candidate) !== canonicalHousehold(document) ||
    !!validation ||
    expenseTouched;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  const plan = monthlyPlan(candidate, month);
  const other = draft.expenses.filter(
    (e) => !plan.expenses.some((active) => active.id === e.id),
  );
  function addExpense(event: React.FormEvent) {
    event.preventDefault();
    setExpenseError('');
    try {
      const entry: RecurringExpense = {
        id: crypto.randomUUID(),
        name: expense.name.trim(),
        amountMinor: parseMoney(expense.amount),
        firstDueDate: expense.firstDueDate,
        category: (expense.category || expense.customCategory).trim(),
        labels: [
          ...new Set(
            expense.labels
              .split(',')
              .map((label) => label.trim())
              .filter(Boolean),
          ),
        ],
        endDate: expense.duration === 'limited' ? expense.endDate : null,
        archivedFromMonth: null,
      };
      validateExpense(entry);
      const next = { ...draft, expenses: [...draft.expenses, entry] };
      validateHousehold(next);
      setDraft(next);
      setAdding(false);
      setExpense(emptyExpense());
      setExpenseTouched(false);
    } catch (error) {
      setExpenseError((error as Error).message);
    }
  }
  function archive(entry: RecurringExpense) {
    if (
      window.confirm(
        `Archive ${entry.name} from ${monthName(month)}? Earlier months and transfer confirmations will remain in history.`,
      )
    )
      setDraft({
        ...draft,
        expenses: draft.expenses.map((e) =>
          e.id === entry.id ? { ...e, archivedFromMonth: month } : e,
        ),
      });
  }
  const expenseRow = (entry: RecurringExpense, due?: string) => (
    <article className="expense-row" key={entry.id}>
      <div className="expense-description">
        <strong>{entry.name}</strong>
        <small>
          {entry.category}
          {entry.labels.length ? ` · ${entry.labels.join(' · ')}` : ''}
        </small>
        <small>
          {due ? `Due ${due}` : `From ${entry.firstDueDate}`}
          {entry.endDate
            ? ` · ends ${entry.endDate}`
            : ' · monthly until archived'}
          {entry.archivedFromMonth
            ? ` · archived from ${entry.archivedFromMonth}`
            : ''}
        </small>
      </div>
      <div className="expense-actions">
        <strong>{money(entry.amountMinor)}</strong>
        {!entry.archivedFromMonth && (
          <button
            className="text-button"
            type="button"
            disabled={disabled}
            onClick={() => archive(entry)}
          >
            Archive
          </button>
        )}
      </div>
    </article>
  );
  return (
    <section className="panel planning-page" aria-label="Monthly plan">
      <fieldset disabled={disabled}>
        <div className="section-heading">
          <h2>Recurring expenses</h2>
          <span className="subtle-label">Monthly payments</span>
        </div>
        {plan.expenses.length ? (
          <div className="expense-list">
            {plan.expenses.map((e) => expenseRow(e, e.due))}
          </div>
        ) : (
          <p className="empty-copy">
            No payments due this month. Add a recurring expense to define your
            operating budget.
          </p>
        )}
        {!adding ? (
          <button
            className="secondary"
            type="button"
            onClick={() => setAdding(true)}
          >
            Add recurring expense
          </button>
        ) : (
          <form className="expense-form" onSubmit={addExpense}>
            <h3>New recurring expense</h3>
            <label>
              Expense name
              <input
                aria-label="Expense name"
                maxLength={80}
                value={expense.name}
                onChange={(e) => {
                  setExpense({ ...expense, name: e.target.value });
                  setExpenseTouched(true);
                }}
                required
              />
            </label>
            <div className="input-row">
              <label>
                Monthly amount
                <input
                  aria-label="Monthly amount"
                  inputMode="decimal"
                  value={expense.amount}
                  onChange={(e) => {
                    setExpense({ ...expense, amount: e.target.value });
                    setExpenseTouched(true);
                  }}
                  required
                />
              </label>
              <label>
                First due date
                <input
                  aria-label="First due date"
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  value={expense.firstDueDate}
                  onChange={(e) => {
                    setExpense({ ...expense, firstDueDate: e.target.value });
                    setExpenseTouched(true);
                  }}
                  required
                />
              </label>
            </div>
            <label>
              Category
              <select
                aria-label="Category"
                value={expense.category}
                onChange={(e) => {
                  setExpense({ ...expense, category: e.target.value });
                  setExpenseTouched(true);
                }}
              >
                {[
                  ...new Set([
                    ...EXPENSE_CATEGORIES,
                    ...draft.expenses.map((entry) => entry.category),
                  ]),
                ].map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
                <option value="">Custom category…</option>
              </select>
            </label>
            {expense.category === '' && (
              <label>
                Custom category
                <input
                  aria-label="Custom category"
                  maxLength={40}
                  value={expense.customCategory}
                  onChange={(e) => {
                    setExpense({ ...expense, customCategory: e.target.value });
                    setExpenseTouched(true);
                  }}
                  required
                />
              </label>
            )}
            <label>
              Labels <small>Optional, separated by commas</small>
              <input
                aria-label="Labels"
                value={expense.labels}
                onChange={(e) => {
                  setExpense({ ...expense, labels: e.target.value });
                  setExpenseTouched(true);
                }}
              />
            </label>
            <label>
              Payment duration
              <select
                aria-label="Payment duration"
                value={expense.duration}
                onChange={(e) => {
                  setExpense({ ...expense, duration: e.target.value });
                  setExpenseTouched(true);
                }}
              >
                <option value="indefinite">Until archived</option>
                <option value="limited">Until a specific date</option>
              </select>
            </label>
            {expense.duration === 'limited' && (
              <label>
                Last payment date
                <input
                  aria-label="Last payment date"
                  type="date"
                  min={expense.firstDueDate}
                  max="2100-12-31"
                  value={expense.endDate}
                  onChange={(e) => {
                    setExpense({ ...expense, endDate: e.target.value });
                    setExpenseTouched(true);
                  }}
                  required
                />
              </label>
            )}
            {expenseError && (
              <p className="validation" role="alert">
                {expenseError}
              </p>
            )}
            <div className="action-row">
              <button className="secondary" type="submit">
                Add to plan
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setAdding(false);
                  setExpense(emptyExpense());
                  setExpenseTouched(false);
                  setExpenseError('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {other.length > 0 && (
          <details className="schedule-history">
            <summary>Other schedules &amp; history ({other.length})</summary>
            {other.map((e) => expenseRow(e))}
          </details>
        )}
        <div className="divider" />
        <div className="savings-setting">
          <div>
            <h2>Fixed savings</h2>
            <p className="muted">
              Monthly from {monthName(month)}, until changed.
            </p>
          </div>
          <label>
            Monthly savings
            <span className="currency-input">
              <span>€</span>
              <input
                aria-label="Monthly savings"
                inputMode="decimal"
                value={savings}
                onChange={(e) => setSavings(e.target.value)}
                required
              />
            </span>
          </label>
        </div>
        <dl className="plan-totals">
          <div>
            <dt>Operating budget</dt>
            <dd data-testid="operating-target">{money(plan.operatingMinor)}</dd>
          </div>
          <div>
            <dt>Total monthly target</dt>
            <dd data-testid="total-target">
              {validation ? '—' : money(plan.totalMinor)}
            </dd>
          </div>
        </dl>
        <div className="split-heading">
          <h3>Member contributions</h3>
          <span>50 / 50</span>
        </div>
        <div className="member-targets">
          {document.memberNames.map((name, i) => (
            <div key={i}>
              <div>
                <span>{name}</span>
                <strong data-testid={`target-${i}`}>
                  {validation ? '—' : money(plan.memberTargets[i])}
                </strong>
                <small>
                  {money(plan.operatingShares[i])} operating ·{' '}
                  {money(plan.savingsShares[i])} savings
                </small>
              </div>
            </div>
          ))}
        </div>
        {validation && (
          <p className="validation" role="alert">
            {validation}
          </p>
        )}
        <div className="form-footer">
          <small>Targets are plans, not transferred funds.</small>
          <button
            type="button"
            className="primary"
            disabled={disabled || !dirty || !!validation || expenseTouched}
            onClick={() => void commit(candidate)}
          >
            Save monthly plan
          </button>
        </div>
        {expenseTouched && (
          <p className="muted">
            Add the expense to your plan or cancel it before saving.
          </p>
        )}
      </fieldset>
    </section>
  );
}

function Overview({
  document,
  month,
  disabled,
  commit,
  openPlan,
  openSettings,
  member,
  onDirty,
}: {
  document: HouseholdPlan;
  month: string;
  disabled: boolean;
  commit: Commit;
  openPlan: () => void;
  openSettings: () => void;
  member: string;
  onDirty: (dirty: boolean) => void;
}) {
  const plan = monthlyPlan(document, month);
  const funds = recordedFunds(document, month);
  const [ledgerDirty, setLedgerDirty] = useState(false),
    [movementOpen, setMovementOpen] = useState(false);
  useEffect(
    () => onDirty(ledgerDirty || movementOpen),
    [ledgerDirty, movementOpen, onDirty],
  );
  useEffect(() => () => onDirty(false), [onDirty]);
  async function confirm(fund: Fund) {
    if (member !== '0' && member !== '1') return;
    const index = Number(member) as 0 | 1;
    const status = fundingStatus(document, month, index, fund);
    if (status.complete) return;
    if (
      window.confirm(
        `Confirm ${money(status.target)} transferred to ${fund} for ${monthName(month)}?`,
      )
    )
      await commit(
        confirmFundTransfer(
          document,
          month,
          index,
          fund,
          new Date().toISOString(),
        ),
      );
  }
  return (
    <>
      <section className="funds-grid" aria-label="Recorded funds">
        {(['operating', 'savings'] as const).map((fund) => (
          <article className="summary-card" key={fund}>
            <span className="card-label">
              {fund === 'operating' ? 'Operating funds' : 'Savings funds'}
            </span>
            <strong className="fund-value" data-testid={`${fund}-funds`}>
              {money(
                fund === 'operating'
                  ? funds.unencumberedMinor
                  : funds.savingsMinor,
              )}
            </strong>
            <div className="fund-month">
              <small className="fund-due" data-testid={`${fund}-due`}>
                Due{' '}
                {month === today.slice(0, 7) ? 'this month' : monthName(month)}:{' '}
                {money(
                  fund === 'operating'
                    ? plan.operatingMinor
                    : plan.savingsMinor,
                )}
                {member !== '' && (
                  <span>
                    You:{' '}
                    {money(
                      (fund === 'operating'
                        ? plan.operatingShares
                        : plan.savingsShares)[Number(member)],
                    )}
                  </span>
                )}
              </small>
              <div
                className="fund-confirmations"
                aria-label={`${fund} confirmations for ${monthName(month)}`}
              >
                {document.memberNames.map((name, i) => {
                  const status = fundingStatus(
                    document,
                    month,
                    i as 0 | 1,
                    fund,
                  );
                  const mine = member === String(i);
                  const label = status.notRequired
                    ? `${name}: ${fund} not required`
                    : status.confirmation
                      ? `${name}: ${fund} confirmed ${money(status.confirmation.amountMinor)}`
                      : mine
                        ? `Confirm my ${fund} transfer`
                        : `${name}: ${fund} awaiting confirmation`;
                  return (
                    <button
                      type="button"
                      className={`fund-check ${status.complete ? 'complete' : ''}`}
                      key={i}
                      title={`${name}: ${status.notRequired ? 'No transfer required' : status.confirmation ? 'Confirmed' : `${money(status.target)} pending`}`}
                      aria-label={label}
                      disabled={
                        disabled ||
                        ledgerDirty ||
                        movementOpen ||
                        status.complete ||
                        !mine
                      }
                      onClick={() => void confirm(fund)}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        aria-hidden="true"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>
                      <span>{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </article>
        ))}
      </section>
      <p className="funds-note">
        Balances through {monthName(month)} · checkmarks show this month's
        transfers.
        {funds.householdPayables > 0 && (
          <span className="funds-reserve">
            Operating pool {money(funds.operatingMinor)} · reserved for net
            household debts {money(funds.householdPayables)}.
          </span>
        )}
        {!member && (
          <span className="funds-reserve">
            <button className="inline-link" onClick={openSettings}>
              Choose your name in Settings
            </button>{' '}
            to confirm your transfers.
          </span>
        )}
        {plan.totalMinor === 0 && (
          <span className="funds-reserve">
            <button className="inline-link" onClick={openPlan}>
              Set monthly funding targets
            </button>
          </span>
        )}
      </p>
      <LedgerPanel
        key={month}
        document={document}
        member={member === '0' ? 'a' : member === '1' ? 'b' : ''}
        month={month}
        today={today}
        disabled={disabled || movementOpen}
        commit={commit}
        openSettings={openSettings}
        onDirty={setLedgerDirty}
      />
      <FundActivity
        document={document}
        member={member === '0' ? 'a' : member === '1' ? 'b' : ''}
        today={today}
        disabled={disabled || ledgerDirty}
        open={movementOpen}
        setOpen={setMovementOpen}
        commit={commit}
        openSettings={openSettings}
      />
    </>
  );
}
function Settings({
  member,
  setMember,
  document,
  disabled,
  commit,
  onDirty,
}: {
  member: string;
  setMember: (value: string) => void;
  document: HouseholdPlan;
  disabled: boolean;
  commit: Commit;
  onDirty: (dirty: boolean) => void;
}) {
  const [names, setNames] = useState(document.memberNames);
  useEffect(() => setNames(document.memberNames), [document]);
  const dirty = JSON.stringify(names) !== JSON.stringify(document.memberNames);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  return (
    <section className="panel">
      <div className="identity-settings">
        <h2>I am</h2>
        <label>
          Your identity on this device
          <select
            aria-label="Your identity"
            value={member}
            disabled={disabled}
            onChange={(e) => setMember(e.target.value)}
          >
            <option value="">Choose your name</option>
            {document.memberNames.map((name, i) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          Saved on this device. Choose your own name; v1 uses trust, without
          identity verification.
        </p>
      </div>
      <h2>Household members</h2>
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          void commit({ ...document, memberNames: names });
        }}
      >
        <fieldset disabled={disabled}>
          <div className="input-row">
            {names.map((name, i) => (
              <label key={i}>
                {i === 0 ? 'First member' : 'Second member'}
                <input
                  aria-label={i === 0 ? 'First member' : 'Second member'}
                  value={name}
                  maxLength={40}
                  required
                  onChange={(e) =>
                    setNames(
                      i === 0
                        ? [e.target.value, names[1]]
                        : [names[0], e.target.value],
                    )
                  }
                />
              </label>
            ))}
          </div>
          <button
            className="secondary"
            type="submit"
            disabled={disabled || !dirty}
          >
            Save members
          </button>
        </fieldset>
      </form>
      {document.legacyDrafts.length > 0 && (
        <details className="schedule-history">
          <summary>
            Earlier manual targets ({document.legacyDrafts.length})
          </summary>
          <p className="muted">
            Preserved from the earlier planner. They do not create recurring
            expenses or confirmed funds. The household JSON export includes
            these records.
          </p>
          {document.legacyDrafts.map((d) => (
            <div className="transfer-row" key={d.month}>
              <span>{d.month}</span>
              <span>
                {money(d.totalMinor)} target · {money(d.savingsMinor)} savings
              </span>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}
function App() {
  const appearance = useAppearance();
  const [member, setMember] = useState(() => {
    try {
      const saved = localStorage.getItem('family-active-member');
      return saved === '0' || saved === '1' ? saved : '';
    } catch {
      return '';
    }
  });
  function chooseMember(value: string) {
    setMember(value);
    try {
      localStorage.setItem('family-active-member', value);
    } catch {
      /* In-memory identity still works. */
    }
  }
  const [document, setDocument] = useState<HouseholdPlan | null>(null);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [view, setView] = useState<Page>('overview');
  const [busy, setBusy] = useState(true),
    [syncBusy, setSyncBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [syncStatus, setSyncStatus] = useState('Saved on this device only.');
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void readRecord()
      .then((record) => {
        if (!cancelled) setDocument(record.document);
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
  async function commit(next: HouseholdPlan): Promise<boolean> {
    if (busy || syncBusy) return false;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      validateHousehold(next);
      setDocument(await saveHousehold(next));
      setDirty(false);
      setRefreshKey((key) => key + 1);
      setNotice('Saved on this device. Synchronization pending.');
      return true;
    } catch (error) {
      setError((error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function changeView(next: Page) {
    if (
      next !== view &&
      (!dirty || window.confirm('Discard unsaved changes?'))
    ) {
      setView(next);
      setDirty(false);
      setError('');
      setNotice('');
    }
  }
  return (
    <AppearanceContext.Provider value={appearance.preferences}>
      <div className="app-shell">
        <header className="app-header">
          <div className="header-inner">
            <a
              className="brand"
              href={import.meta.env.BASE_URL}
              aria-label="Family Manager home"
            >
              <img
                className="brand-mark"
                src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
                alt="JML multicolor logo"
                width="36"
                height="36"
              />
              <span>Family</span>
            </a>
            <div className="header-actions">
              <nav aria-label="Main navigation">
                {(['overview', 'plan', 'charts'] as const).map((page) => (
                  <button
                    key={page}
                    className={`nav-icon ${view === page ? 'selected' : ''}`}
                    aria-label={
                      page === 'overview'
                        ? 'Overview'
                        : page === 'plan'
                          ? 'Monthly plan'
                          : 'Charts'
                    }
                    title={
                      page === 'overview'
                        ? 'Overview'
                        : page === 'plan'
                          ? 'Monthly plan'
                          : 'Charts'
                    }
                    aria-current={view === page ? 'page' : undefined}
                    disabled={busy || syncBusy}
                    onClick={() => changeView(page)}
                  >
                    <NavIcon name={page} />
                  </button>
                ))}
              </nav>
              <button
                className="settings-cog"
                aria-label="Settings"
                title="Settings"
                aria-current={view === 'settings' ? 'page' : undefined}
                disabled={busy || syncBusy}
                onClick={() => changeView('settings')}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="m9 3-.6 2.4-2 .9L4 5.7 2 9l1.8 1.8v2.4L2 15l2 3.3 2.4-.6 2 .9L9 21h6l.6-2.4 2-.9 2.4.6 2-3.3-1.8-1.8v-2.4L22 9l-2-3.3-2.4.6-2-.9L15 3Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>
        </header>
        <main className="focused-main">
          <section className="page-heading">
            <h1>
              {view === 'overview'
                ? 'Overview'
                : view === 'plan'
                  ? 'Monthly plan'
                  : view === 'charts'
                    ? 'Charts'
                    : 'Settings'}
            </h1>
            {(view === 'overview' || view === 'plan') && (
              <label className="month-picker">
                <span>Month</span>
                <input
                  aria-label="Planning month"
                  type="month"
                  min="2000-01"
                  max="2100-12"
                  value={month}
                  disabled={busy || syncBusy}
                  onChange={(e) => {
                    if (
                      e.target.value &&
                      (!dirty ||
                        window.confirm(
                          'Discard unsaved changes and switch months?',
                        ))
                    ) {
                      setMonth(e.target.value);
                      setDirty(false);
                      setNotice('');
                      setError('');
                    }
                  }}
                />
              </label>
            )}
          </section>
          {error && (
            <div className="message error" role="alert">
              {error}{' '}
              <button
                onClick={() => {
                  if (
                    !dirty ||
                    window.confirm('Discard unsaved changes and reload?')
                  )
                    window.location.reload();
                }}
              >
                Reload saved data
              </button>
            </div>
          )}
          {notice && (
            <div className="message success" role="status">
              {notice}
            </div>
          )}
          {!document ? (
            <section className="panel">
              <h2>
                {busy ? 'Opening household…' : 'Household data unavailable'}
              </h2>
            </section>
          ) : (
            <>
              {view === 'overview' && (
                <Overview
                  key={month}
                  document={document}
                  month={month}
                  disabled={busy || syncBusy}
                  commit={commit}
                  openPlan={() => changeView('plan')}
                  openSettings={() => changeView('settings')}
                  member={member}
                  onDirty={setDirty}
                />
              )}
              {view === 'plan' && (
                <MonthlyPlan
                  key={month}
                  document={document}
                  month={month}
                  disabled={busy || syncBusy}
                  commit={commit}
                  onDirty={setDirty}
                />
              )}
              {view === 'charts' && (
                <Suspense
                  fallback={
                    <section className="panel">Opening charts…</section>
                  }
                >
                  <HistoryPanel document={document} today={today} />
                </Suspense>
              )}
              {view === 'settings' && (
                <Settings
                  member={member}
                  setMember={chooseMember}
                  document={document}
                  disabled={busy || syncBusy}
                  commit={commit}
                  onDirty={setDirty}
                />
              )}
            </>
          )}
          <div className="settings-pane" hidden={view !== 'settings'}>
            <AppearancePanel {...appearance} />
            <SyncPanel
              dirty={dirty || busy}
              refreshKey={refreshKey}
              onBusy={setSyncBusy}
              onStatus={setSyncStatus}
              onRefresh={async () => setDocument((await readRecord()).document)}
            />
          </div>
          <footer>
            <span>EUR · Europe/Busingen</span>
            {view !== 'settings' && (
              <span className="sync-status" role="status">
                {syncStatus}
              </span>
            )}
          </footer>
        </main>
      </div>
    </AppearanceContext.Provider>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .catch(() => {
        const message = document.createElement('p');
        message.setAttribute('role', 'alert');
        message.textContent =
          'Offline installation failed. Reopen online to retry; device records are preserved.';
        document.getElementById('root')?.prepend(message);
      });
  });
}
