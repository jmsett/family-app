import { useEffect, useRef, useState } from 'react';
import {
  appendEntries,
  categorySpending,
  EXPENSE_CATEGORIES,
  netBalances,
  parseMoney,
  parsePercentage,
  PARTIES,
  partyName,
  settlementLimit,
  splitAmount,
  suggestedPayments,
  validateLedger,
} from '@family/domain';
import type {
  DebtSettlement,
  HouseholdPlan,
  LedgerEvent,
  Party,
  PostedExpense,
  Shares,
  SplitMode,
} from '@family/shared';
import { ProgressBar } from './ProgressBar';
const money = (value: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
    value / 100,
  );
const inputMoney = (value: number) => (value / 100).toFixed(2);
type Commit = (doc: HouseholdPlan) => Promise<boolean>;
type Common = {
  document: HouseholdPlan;
  actor: 'a' | 'b';
  today: string;
  disabled: boolean;
  commit: Commit;
  close: () => void;
};

function ExpenseEditor({
  document,
  actor,
  today,
  disabled,
  commit,
  close,
  original,
}: { original?: PostedExpense } & Common) {
  const [id] = useState(() => crypto.randomUUID()),
    [createdAt] = useState(() => new Date().toISOString());
  const [description, setDescription] = useState(original?.description ?? '');
  const [amount, setAmount] = useState(
    original ? inputMoney(original.amountMinor) : '',
  );
  const [date, setDate] = useState(original?.date ?? today);
  const [payer, setPayer] = useState<Party>(original?.payer ?? actor);
  const [source, setSource] = useState<'personal' | 'household'>(
    original?.source ?? 'personal',
  );
  const [mode, setMode] = useState<SplitMode>(original?.splitMode ?? 'equal');
  const [selected, setSelected] = useState<boolean[]>(
    original ? original.splitInput.map((v) => v > 0) : [true, true, false],
  );
  const [values, setValues] = useState<string[]>(
    original
      ? original.splitInput.map((v) =>
          original.splitMode === 'equal' ? String(v) : inputMoney(v),
        )
      : ['50', '50', '0'],
  );
  const [preset, setPreset] = useState(original ? 'custom' : 'equal'),
    [debtor, setDebtor] = useState<Party>(actor === 'a' ? 'b' : 'a');
  const [category, setCategory] = useState(original?.category ?? 'Food'),
    [customCategory, setCustomCategory] = useState('');
  const [labels, setLabels] = useState(original?.labels.join(', ') ?? ''),
    [reason, setReason] = useState(''),
    [error, setError] = useState('');
  const categories = [
    ...new Set([
      ...EXPENSE_CATEGORIES,
      ...document.expenses.map((e) => e.category),
      ...document.ledger
        .filter((e): e is PostedExpense => e.kind === 'expense')
        .map((e) => e.category),
    ]),
  ];
  let candidate: PostedExpense | null = null,
    validation = '';
  try {
    const amountMinor = parseMoney(amount);
    const splitInput = (
      mode === 'equal'
        ? selected.map((v) => (v ? 1 : 0))
        : values.map((v) =>
            mode === 'percentage'
              ? parsePercentage(v || '0')
              : parseMoney(v || '0'),
          )
    ) as Shares;
    const shares = splitAmount(amountMinor, mode, splitInput);
    candidate = {
      id,
      kind: 'expense',
      ...(original ? { replacesId: original.id } : {}),
      description: description.trim(),
      amountMinor,
      date,
      payer,
      source,
      splitMode: mode,
      splitInput,
      shares,
      category: (category || customCategory).trim(),
      labels: [
        ...new Set(
          labels
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ],
      actor,
      createdAt,
    };
    validateLedger([{ ...candidate, replacesId: undefined }]);
  } catch (error) {
    validation = (error as Error).message;
    candidate = null;
  }
  function setup(value: string) {
    setPreset(value);
    setMode('equal');
    setSource(value === 'household' ? 'household' : 'personal');
    setPayer(value === 'household' ? 'household' : actor);
    if (value === 'equal') setSelected([true, true, false]);
    if (value === 'advance' || value === 'household')
      setSelected([false, false, true]);
    if (value === 'full') setSelected(PARTIES.map((p) => p === debtor));
  }
  function changeMode(next: SplitMode) {
    const shares = candidate?.shares ?? [0, 0, 0];
    if (next === 'amount') setValues(shares.map(inputMoney));
    if (next === 'percentage')
      setValues(
        splitAmount(
          10000,
          'equal',
          (selected.some(Boolean)
            ? selected.map((v) => (v ? 1 : 0))
            : [1, 1, 0]) as Shares,
        ).map(inputMoney),
      );
    setMode(next);
    setPreset('custom');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!candidate) return;
    setError('');
    try {
      const additions: LedgerEvent[] = original
        ? [
            {
              id: `${id}:reversal`,
              kind: 'reversal',
              targetId: original.id,
              reason: reason.trim(),
              date: original.date,
              createdAt,
              actor,
            },
            candidate,
          ]
        : [candidate];
      if (await commit(appendEntries(document, additions))) close();
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <form
      className="ledger-editor"
      onSubmit={save}
      aria-label={original ? 'Correct expense' : 'Add expense'}
    >
      <fieldset disabled={disabled}>
        <h3>{original ? 'Correct expense' : 'Add expense'}</h3>
        {!original && (
          <label>
            Quick setup
            <select
              aria-label="Expense quick setup"
              value={preset}
              onChange={(e) => setup(e.target.value)}
            >
              <option value="equal">
                {partyName(document, actor)} paid, split equally
              </option>
              <option value="full">
                {partyName(document, actor)} is owed the full amount
              </option>
              <option value="advance">
                {partyName(document, actor)} paid for the household
              </option>
              <option value="household">Household paid</option>
              <option value="custom">Custom split</option>
            </select>
          </label>
        )}
        <label>
          Description
          <input
            aria-label="Expense description"
            value={description}
            maxLength={120}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </label>
        <div className="input-row">
          <label>
            Amount (€)
            <input
              aria-label="Expense amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label>
            Payment date
            <input
              aria-label="Expense date"
              type="date"
              min="2000-01-01"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
        </div>
        <div className="input-row">
          <label>
            Paid by
            <select
              aria-label="Expense payer"
              value={payer}
              onChange={(e) => {
                const value = e.target.value as Party;
                setPayer(value);
                setSource(value === 'household' ? 'household' : 'personal');
                setPreset('custom');
              }}
            >
              {PARTIES.map((p) => (
                <option key={p} value={p}>
                  {partyName(document, p)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Funding source
            <select
              aria-label="Expense funding source"
              value={source}
              disabled={payer === 'household'}
              onChange={(e) => setSource(e.target.value as typeof source)}
            >
              <option value="personal">Personal funds</option>
              <option value="household">Household funds</option>
            </select>
          </label>
        </div>
        <p className="muted">
          Personal money advanced for the household creates a debt. Existing
          household funds do not create another reimbursement.
        </p>
        {preset === 'full' && (
          <label>
            Who owes the full amount?
            <select
              aria-label="Full amount debtor"
              value={debtor}
              onChange={(e) => {
                const value = e.target.value as Party;
                setDebtor(value);
                setSelected(PARTIES.map((p) => p === value));
              }}
            >
              {PARTIES.filter((p) => p !== actor).map((p) => (
                <option key={p} value={p}>
                  {partyName(document, p)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Split method
          <select
            aria-label="Split method"
            value={mode}
            onChange={(e) => changeMode(e.target.value as SplitMode)}
          >
            <option value="equal">Equally</option>
            <option value="amount">Unequally by amount</option>
            <option value="percentage">By percentage</option>
          </select>
        </label>
        <div className="split-rows" aria-label="Expense beneficiaries">
          {PARTIES.map((party, i) => (
            <div className="split-row" key={party}>
              {mode === 'equal' ? (
                <label className="beneficiary-check">
                  <input
                    type="checkbox"
                    aria-label={`Include ${partyName(document, party)}`}
                    checked={selected[i]}
                    onChange={(e) => {
                      const next = [...selected];
                      next[i] = e.target.checked;
                      setSelected(next);
                      setPreset('custom');
                    }}
                  />
                  {partyName(document, party)}
                </label>
              ) : (
                <label>
                  {partyName(document, party)}
                  <input
                    aria-label={`${partyName(document, party)} ${mode === 'amount' ? 'split amount' : 'split percentage'}`}
                    inputMode="decimal"
                    value={values[i]}
                    onChange={(e) => {
                      const next = [...values];
                      next[i] = e.target.value;
                      setValues(next);
                    }}
                  />
                </label>
              )}
              <span>
                {mode === 'percentage' ? '% · ' : ''}
                {candidate ? money(candidate.shares[i]) : '—'}
              </span>
            </div>
          ))}
        </div>
        <p className="muted">
          Use Household for shared household costs; choose people for personal
          splits.
        </p>
        <label>
          Category
          <select
            aria-label="Actual expense category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="">Custom category…</option>
          </select>
        </label>
        {!category && (
          <label>
            Custom category
            <input
              aria-label="Actual custom category"
              maxLength={40}
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              required
            />
          </label>
        )}
        <label>
          Labels <small>Optional, separated by commas</small>
          <input
            aria-label="Actual expense labels"
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
          />
        </label>
        {original && (
          <label>
            Correction reason
            <input
              aria-label="Correction reason"
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </label>
        )}
        {(error || (amount && validation)) && (
          <p className="validation" role="alert">
            {error || validation}
          </p>
        )}
        <div className="entry-actions">
          <button
            className="primary"
            type="submit"
            disabled={disabled || !candidate || (!!original && !reason.trim())}
          >
            {original ? 'Save correction' : 'Save expense'}
          </button>
          <button className="text-button" type="button" onClick={close}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
function SettlementEditor({
  document,
  actor,
  today,
  disabled,
  commit,
  close,
  suggestion,
}: { suggestion?: { from: Party; to: Party; amountMinor: number } } & Common) {
  const first = suggestion ?? suggestedPayments(document.ledger)[0];
  const [id] = useState(() => crypto.randomUUID()),
    [createdAt] = useState(() => new Date().toISOString());
  const [from, setFrom] = useState<Party>(first?.from ?? actor),
    [to, setTo] = useState<Party>(first?.to ?? (actor === 'a' ? 'b' : 'a'));
  const [amount, setAmount] = useState(
      first ? inputMoney(first.amountMinor) : '',
    ),
    [date, setDate] = useState(today),
    [note, setNote] = useState(''),
    [error, setError] = useState('');
  const limit = settlementLimit(document.ledger, from, to);
  let candidate: DebtSettlement | null = null,
    validation = '';
  try {
    const amountMinor = parseMoney(amount);
    candidate = {
      id,
      kind: 'settlement',
      from,
      to,
      amountMinor,
      date,
      note: note.trim(),
      actor,
      createdAt,
    };
    validateLedger([candidate]);
    if (amountMinor > limit)
      throw new Error(
        'The payment exceeds the outstanding balance between these parties.',
      );
  } catch (error) {
    validation = (error as Error).message;
    candidate = null;
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!candidate) return;
    setError('');
    if (
      !window.confirm(
        `Record that ${partyName(document, from)} paid ${money(candidate.amountMinor)} to ${partyName(document, to)}?`,
      )
    )
      return;
    try {
      if (await commit(appendEntries(document, [candidate]))) close();
    } catch (error) {
      setError((error as Error).message);
    }
  }
  return (
    <form
      className="ledger-editor"
      onSubmit={save}
      aria-label="Record settlement"
    >
      <fieldset disabled={disabled}>
        <h3>Settle up</h3>
        <p className="muted">
          Record a payment already made. Full and partial repayments reduce debt
          without adding spending.
        </p>
        <div className="input-row">
          <label>
            From
            <select
              aria-label="Settlement from"
              value={from}
              onChange={(e) => setFrom(e.target.value as Party)}
            >
              {PARTIES.map((p) => (
                <option key={p} value={p}>
                  {partyName(document, p)}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select
              aria-label="Settlement to"
              value={to}
              onChange={(e) => setTo(e.target.value as Party)}
            >
              {PARTIES.map((p) => (
                <option key={p} value={p}>
                  {partyName(document, p)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted">Outstanding: {money(limit)}</p>
        <div className="input-row">
          <label>
            Paid amount (€)
            <input
              aria-label="Settlement amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label>
            Payment date
            <input
              aria-label="Settlement date"
              type="date"
              min="2000-01-01"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
        </div>
        <label>
          Note <small>Optional</small>
          <input
            aria-label="Settlement note"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {(error || (amount && validation)) && (
          <p className="validation" role="alert">
            {error || validation}
          </p>
        )}
        <div className="entry-actions">
          <button
            className="primary"
            type="submit"
            disabled={disabled || !candidate}
          >
            Record payment
          </button>
          <button className="text-button" type="button" onClick={close}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
function ReversalEditor({
  document,
  actor,
  disabled,
  commit,
  close,
  target,
}: { target: LedgerEvent } & Common) {
  const [id] = useState(() => crypto.randomUUID()),
    [createdAt] = useState(() => new Date().toISOString());
  const [reason, setReason] = useState(''),
    [error, setError] = useState('');
  return (
    <form
      className="ledger-editor"
      aria-label="Reverse entry"
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        try {
          if (
            await commit(
              appendEntries(document, [
                {
                  id,
                  kind: 'reversal',
                  targetId: target.id,
                  reason: reason.trim(),
                  date: target.date,
                  actor,
                  createdAt,
                },
              ]),
            )
          )
            close();
        } catch (error) {
          setError((error as Error).message);
        }
      }}
    >
      <fieldset disabled={disabled}>
        <h3>
          Reverse recorded {target.kind === 'expense' ? 'expense' : 'payment'}
        </h3>
        <p className="muted">
          The original stays in history. Its effect is reversed in its original
          period.
        </p>
        <label>
          Reason
          <input
            aria-label="Reversal reason"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="validation">
            {error}
          </p>
        )}
        <div className="entry-actions">
          <button
            type="submit"
            className="primary"
            disabled={disabled || !reason.trim()}
          >
            Record reversal
          </button>
          <button type="button" className="text-button" onClick={close}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export function LedgerPanel({
  document,
  member,
  month,
  today,
  disabled,
  commit,
  openSettings,
  onDirty,
}: {
  document: HouseholdPlan;
  member: '' | 'a' | 'b';
  month: string;
  today: string;
  disabled: boolean;
  commit: Commit;
  openSettings: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  type Editor =
    | { type: 'expense'; original?: PostedExpense }
    | {
        type: 'settlement';
        suggestion?: { from: Party; to: Party; amountMinor: number };
      }
    | { type: 'reverse'; target: LedgerEvent };
  const [editor, setEditor] = useState<Editor | null>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (editor) {
      const form = panel.current?.querySelector('form');
      form?.scrollIntoView({ block: 'start' });
      form
        ?.querySelector<HTMLElement>('select, input')
        ?.focus({ preventScroll: true });
    }
  }, [editor]);
  const [year, index] = month.split('-').map(Number);
  const [fromDate, setFromDate] = useState(`${month}-01`),
    [toDate, setToDate] = useState(
      `${month}-${new Date(Date.UTC(year, index, 0)).getUTCDate()}`,
    );
  const [filterParty, setFilterParty] = useState('all'),
    [filterCategory, setFilterCategory] = useState('all');
  useEffect(() => {
    setFromDate(`${month}-01`);
    setToDate(`${month}-${new Date(Date.UTC(year, index, 0)).getUTCDate()}`);
  }, [month, year, index]);
  useEffect(() => onDirty(editor !== null), [editor, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  const balances = netBalances(document.ledger),
    suggestions = suggestedPayments(document.ledger);
  const reversed = new Set(
    document.ledger
      .filter((e) => e.kind === 'reversal')
      .map((e) => (e.kind === 'reversal' ? e.targetId : '')),
  );
  const categories = [
    ...new Set(
      document.ledger
        .filter((e): e is PostedExpense => e.kind === 'expense')
        .map((e) => e.category),
    ),
  ].sort();
  const matches = (event: LedgerEvent): boolean => {
    const original =
      event.kind === 'reversal'
        ? document.ledger.find((e) => e.id === event.targetId)
        : event;
    if (!original) return false;
    const party = filterParty as Party;
    const partyMatch =
      filterParty === 'all' ||
      (original.kind === 'expense'
        ? original.payer === party ||
          (original.source === 'household' && party === 'household') ||
          original.shares[PARTIES.indexOf(party)] > 0
        : original.kind === 'settlement'
          ? original.from === party || original.to === party
          : false);
    return (
      partyMatch &&
      (filterCategory === 'all' ||
        (original.kind === 'expense' && original.category === filterCategory))
    );
  };
  const history = document.ledger
    .filter((e) => e.date >= fromDate && e.date <= toDate && matches(e))
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
  const chartDoc = {
    ...document,
    ledger: document.ledger.filter((e) => e.kind === 'reversal' || matches(e)),
  };
  const spending =
      fromDate <= toDate ? categorySpending(chartDoc, fromDate, toDate) : [],
    total = spending.reduce((sum, e) => sum + e.amountMinor, 0);
  function edit(value: Editor) {
    if (member) setEditor(value);
    else openSettings();
  }
  const common = member
    ? {
        document,
        actor: member,
        today,
        disabled,
        commit,
        close: () => setEditor(null),
      }
    : null;
  const label = (event: LedgerEvent): string =>
    event.kind === 'expense'
      ? event.description
      : event.kind === 'settlement'
        ? `${partyName(document, event.from)} → ${partyName(document, event.to)}`
        : `Reversal: ${document.ledger.find((e) => e.id === event.targetId)?.kind === 'expense' ? (document.ledger.find((e) => e.id === event.targetId) as PostedExpense).description : 'repayment'}`;
  return (
    <section
      ref={panel}
      className="panel ledger-panel"
      aria-label="Balances and settlements"
    >
      <div className="section-heading">
        <h2>Balances &amp; settlements</h2>
        <span className="subtle-label">All dates</span>
      </div>
      <p className="muted">
        Outstanding debts carry across months. Positive balances are owed money.
      </p>
      {member && (
        <p className="personal-balance" data-testid="personal-balance">
          {balances[member] < 0
            ? `You owe ${money(-balances[member])} net`
            : balances[member] > 0
              ? `You’re owed ${money(balances[member])} net`
              : 'Your net balance is settled.'}
        </p>
      )}
      <div className="balance-rows">
        {PARTIES.map((p) => (
          <div className="balance-row" key={p}>
            <span>{partyName(document, p)}</span>
            <strong data-testid={`balance-${p}`}>
              {balances[p] > 0
                ? `Owed ${money(balances[p])}`
                : balances[p] < 0
                  ? `Owes ${money(-balances[p])}`
                  : 'Settled'}
            </strong>
          </div>
        ))}
      </div>
      {suggestions.length > 0 ? (
        <div className="suggested-payments">
          <h3>Suggested payments</h3>
          <p className="muted">
            Fewest payments for these three parties. Suggestions do not move
            money.
          </p>
          {suggestions.map((s) => (
            <div className="suggestion-row" key={`${s.from}:${s.to}`}>
              <span>
                {partyName(document, s.from)} → {partyName(document, s.to)}
              </span>
              <div>
                <strong>{money(s.amountMinor)}</strong>
                <button
                  className="secondary"
                  disabled={disabled || editor !== null}
                  onClick={() => edit({ type: 'settlement', suggestion: s })}
                  aria-label={`Record payment from ${partyName(document, s.from)} to ${partyName(document, s.to)}`}
                >
                  Record
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="settled-message">All balances are settled.</p>
      )}
      <div className="entry-actions">
        <button
          className="primary"
          disabled={disabled || editor !== null}
          onClick={() => edit({ type: 'expense' })}
        >
          Add expense
        </button>
        <button
          className="secondary"
          disabled={disabled || editor !== null || !suggestions.length}
          onClick={() => edit({ type: 'settlement' })}
        >
          Settle up
        </button>
      </div>
      {!member && (
        <p className="muted">
          <button className="inline-link" onClick={openSettings}>
            Choose your name in Settings
          </button>{' '}
          to record expenses and payments.
        </p>
      )}
      {common && editor?.type === 'expense' && (
        <ExpenseEditor
          key={editor.original?.id ?? 'new'}
          {...common}
          original={editor.original}
        />
      )}
      {common && editor?.type === 'settlement' && (
        <SettlementEditor {...common} suggestion={editor.suggestion} />
      )}
      {common && editor?.type === 'reverse' && (
        <ReversalEditor {...common} target={editor.target} />
      )}
      <details className="activity-details">
        <summary>
          Expenses &amp; payment history ({document.ledger.length})
        </summary>
        <div className="history-filters">
          <div className="input-row">
            <label>
              From date
              <input
                aria-label="History from date"
                type="date"
                min="2000-01-01"
                max="2100-12-31"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label>
              To date
              <input
                aria-label="History to date"
                type="date"
                min="2000-01-01"
                max="2100-12-31"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
          </div>
          <div className="input-row">
            <label>
              Person / household
              <select
                aria-label="History party"
                value={filterParty}
                onChange={(e) => setFilterParty(e.target.value)}
              >
                <option value="all">Everyone</option>
                {PARTIES.map((p) => (
                  <option key={p} value={p}>
                    {partyName(document, p)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                aria-label="History category"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted">
            Filters affect history and spending charts, not outstanding
            balances.
          </p>
        </div>
        {fromDate > toDate && (
          <p className="validation" role="alert">
            From date must not follow To date.
          </p>
        )}
        {history.length ? (
          history.map((event) => (
            <article
              className={`activity-row ${reversed.has(event.id) ? 'reversed-entry' : ''}`}
              key={event.id}
              aria-label={`${event.kind}: ${label(event)}`}
            >
              <div>
                <strong>{label(event)}</strong>
                <small>
                  {event.date} ·{' '}
                  {event.kind === 'expense'
                    ? `${partyName(document, event.payer)} paid · ${event.source === 'household' ? 'household funds' : 'personal funds'} · ${event.category}`
                    : event.kind === 'settlement'
                      ? 'Repayment'
                      : event.reason}
                  {reversed.has(event.id) ? ' · Reversed' : ''}
                </small>
                <small>
                  Recorded by {partyName(document, event.actor)} ·{' '}
                  {event.createdAt.slice(0, 10)}
                </small>
                {event.kind === 'expense' && (
                  <small>
                    {event.splitMode === 'equal'
                      ? 'Equal split'
                      : event.splitMode === 'percentage'
                        ? 'Percentage split'
                        : 'Exact amounts'}{' '}
                    ·{' '}
                    {PARTIES.filter((_, i) => event.shares[i] > 0)
                      .map(
                        (p) =>
                          `${partyName(document, p)} ${money(event.shares[PARTIES.indexOf(p)])}`,
                      )
                      .join(' · ')}
                  </small>
                )}
                {event.kind === 'expense' && event.labels.length > 0 && (
                  <small>{event.labels.join(' · ')}</small>
                )}
                {event.kind === 'settlement' && event.note && (
                  <small>{event.note}</small>
                )}
              </div>
              <div className="activity-actions">
                {event.kind !== 'reversal' && (
                  <strong>{money(event.amountMinor)}</strong>
                )}
                {!reversed.has(event.id) && event.kind !== 'reversal' && (
                  <div>
                    {event.kind === 'expense' && (
                      <button
                        className="text-button"
                        disabled={disabled || editor !== null}
                        onClick={() =>
                          edit({ type: 'expense', original: event })
                        }
                      >
                        Correct
                      </button>
                    )}
                    <button
                      className="text-button"
                      disabled={disabled || editor !== null}
                      onClick={() => edit({ type: 'reverse', target: event })}
                    >
                      Reverse
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))
        ) : (
          <p className="empty-copy">No entries in this range.</p>
        )}
      </details>
      <details className="activity-details">
        <summary>Spending by category</summary>
        <p className="muted">
          Actual purchases from {fromDate} to {toDate}. Recurring forecasts and
          repayments are excluded.
        </p>
        <p className="chart-total">
          Total:{' '}
          <strong data-testid="actual-spending-total">{money(total)}</strong>
        </p>
        {spending.map((row) => {
          const known = EXPENSE_CATEGORIES.indexOf(row.category);
          const colorIndex =
            known < 0
              ? [...row.category].reduce((sum, c) => sum + c.charCodeAt(0), 0) %
                6
              : known;
          return (
            <div className="spending-row" key={row.category}>
              <span>{row.category}</span>
              <strong>{money(row.amountMinor)}</strong>
              <ProgressBar
                label={`${row.category} actual spending`}
                value={total ? (row.amountMinor / total) * 100 : 0}
                chartIndex={colorIndex}
                valueText={money(row.amountMinor)}
              />
            </div>
          );
        })}
        {!spending.length && (
          <p className="empty-copy">No recorded purchases in this range.</p>
        )}
      </details>
    </section>
  );
}
