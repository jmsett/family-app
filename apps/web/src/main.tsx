import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  canonicalHousehold,
  confirmTransfer,
  EXPENSE_CATEGORIES,
  monthlyPlan,
  parseMoney,
  savingsFor,
  validateExpense,
  validateHousehold,
} from '@family/domain';
import type { HouseholdPlan, RecurringExpense } from '@family/shared';
import { readRecord, saveHousehold } from './storage';
import { SyncPanel } from './SyncPanel';
import './style.css';

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
type Page = 'overview' | 'plan' | 'settings';

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
        category: expense.category.trim(),
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
              <input
                aria-label="Category"
                list="expense-categories"
                maxLength={40}
                value={expense.category}
                onChange={(e) => {
                  setExpense({ ...expense, category: e.target.value });
                  setExpenseTouched(true);
                }}
                required
              />
              <datalist id="expense-categories">
                {EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
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
}: {
  document: HouseholdPlan;
  month: string;
  disabled: boolean;
  commit: Commit;
  openPlan: () => void;
}) {
  const plan = monthlyPlan(document, month);
  const [member, setMember] = useState<string>(() => {
    const saved = localStorage.getItem('family-active-member');
    return saved === '0' || saved === '1' ? saved : '';
  });
  const recorded = plan.transfers.find((t) => String(t.member) === member);
  async function confirm() {
    if (member !== '0' && member !== '1') return;
    const index = Number(member) as 0 | 1;
    if (
      window.confirm(
        `I am ${document.memberNames[index]} and confirm I transferred ${money(plan.operatingShares[index])} for operating funds and ${money(plan.savingsShares[index])} for savings in ${monthName(month)}. This is my declaration, not bank verification.`,
      )
    )
      await commit(
        confirmTransfer(document, month, index, new Date().toISOString()),
      );
  }
  return (
    <>
      <section className="funds-grid" aria-label="Confirmed funds">
        <article className="summary-card total">
          <span className="card-label">Operating funds</span>
          <strong data-testid="operating-funds">
            {money(plan.confirmedOperatingMinor)}
          </strong>
        </article>
        <article className="summary-card">
          <span className="card-label">Savings funds</span>
          <strong data-testid="savings-funds">
            {money(plan.confirmedSavingsMinor)}
          </strong>
        </article>
      </section>
      <p className="funds-note">
        Only member-confirmed transfers. Self-reported, not bank-verified.
      </p>
      <section className="panel" aria-label="Member transfers">
        <div className="section-heading">
          <h2>Member transfers</h2>
          <span className="subtle-label">
            {plan.transfers.length} of 2 confirmed
          </span>
        </div>
        <div className="transfer-list">
          {document.memberNames.map((name, i) => {
            const transfer = plan.transfers.find((t) => t.member === i);
            return (
              <div className="transfer-row" key={i}>
                <div>
                  <strong>{name}</strong>
                  <small>
                    {transfer
                      ? `${money(transfer.operatingMinor)} operating · ${money(transfer.savingsMinor)} savings`
                      : 'Awaiting transfer confirmation'}
                  </small>
                </div>
                <span
                  className={transfer ? 'confirmed-badge' : 'pending-badge'}
                >
                  {transfer ? 'Confirmed' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="confirmation-form">
          <label>
            I am
            <select
              aria-label="Confirming member"
              value={member}
              disabled={disabled}
              onChange={(e) => {
                setMember(e.target.value);
                localStorage.setItem('family-active-member', e.target.value);
              }}
            >
              <option value="">Choose your name</option>
              {document.memberNames.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {recorded ? (
            <p className="muted">
              Your transfer is recorded. Plan changes do not alter confirmed
              amounts.
            </p>
          ) : (
            <>
              {member && (
                <p className="transfer-breakdown">
                  Your transfer:{' '}
                  <strong>{money(plan.operatingShares[Number(member)])}</strong>{' '}
                  operating +{' '}
                  <strong>{money(plan.savingsShares[Number(member)])}</strong>{' '}
                  savings.
                </p>
              )}
              <button
                className="primary"
                disabled={disabled || !member || plan.totalMinor === 0}
                onClick={() => void confirm()}
              >
                Confirm my transfer
              </button>
            </>
          )}
          {plan.totalMinor === 0 && (
            <p className="muted">
              Define your recurring expenses and savings in{' '}
              <button className="inline-link" onClick={openPlan}>
                Monthly plan
              </button>{' '}
              first.
            </p>
          )}
          <p className="muted">
            Choose your own name. Confirm only after making the transfer.
          </p>
        </div>
      </section>
    </>
  );
}
function Settings({
  document,
  disabled,
  commit,
  onDirty,
}: {
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
      (!dirty || window.confirm('Discard unsaved plan changes?'))
    ) {
      setView(next);
      setDirty(false);
      setError('');
      setNotice('');
    }
  }
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a
            className="brand"
            href={import.meta.env.BASE_URL}
            aria-label="Family Manager home"
          >
            <span className="brand-mark" aria-hidden="true">
              fm
            </span>
            <span>Family</span>
          </a>
          <nav aria-label="Main navigation">
            {(['overview', 'plan', 'settings'] as const).map((page) => (
              <button
                key={page}
                className={view === page ? 'selected' : ''}
                aria-current={view === page ? 'page' : undefined}
                disabled={busy || syncBusy}
                onClick={() => changeView(page)}
              >
                {page === 'overview'
                  ? 'Overview'
                  : page === 'plan'
                    ? 'Monthly plan'
                    : 'Settings'}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="focused-main">
        <section className="page-heading">
          <h1>
            {view === 'overview'
              ? 'Overview'
              : view === 'plan'
                ? 'Monthly plan'
                : 'Settings'}
          </h1>
          {view !== 'settings' && (
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
                        'Discard unsaved plan changes and switch months?',
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
                document={document}
                month={month}
                disabled={busy || syncBusy}
                commit={commit}
                openPlan={() => changeView('plan')}
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
            {view === 'settings' && (
              <Settings
                document={document}
                disabled={busy || syncBusy}
                commit={commit}
                onDirty={setDirty}
              />
            )}
          </>
        )}
        <div className="settings-pane" hidden={view !== 'settings'}>
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
