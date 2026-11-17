import { useState } from 'react';
import { appendEntries, parseMoney, validateLedger } from '@family/domain';
import type { Fund, FundMovement, HouseholdPlan } from '@family/shared';
import { formatMoney } from './SignedMoney';
export function FundActivity({
  document,
  member,
  today,
  disabled,
  open,
  setOpen,
  commit,
  openSettings,
}: {
  document: HouseholdPlan;
  member: '' | 'a' | 'b';
  today: string;
  disabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  commit: (doc: HouseholdPlan) => Promise<boolean>;
  openSettings: () => void;
}) {
  const [from, setFrom] = useState<Fund>('savings'),
    [to, setTo] = useState<Fund | 'external'>('operating');
  const [amount, setAmount] = useState(''),
    [note, setNote] = useState(''),
    [date, setDate] = useState(today),
    [error, setError] = useState('');
  const [id, setId] = useState(() => crypto.randomUUID());
  let candidate: FundMovement | null = null,
    validation = '';
  try {
    candidate = {
      id,
      kind: 'fund-movement',
      from,
      to,
      amountMinor: parseMoney(amount),
      date,
      note: note.trim(),
      actor: member || 'a',
      createdAt: new Date().toISOString(),
    };
    validateLedger([candidate]);
  } catch (error) {
    validation = (error as Error).message;
    candidate = null;
  }
  return (
    <details className="panel fund-activity">
      <summary>Fund activity</summary>
      <button
        className="secondary"
        disabled={disabled || open}
        onClick={() => {
          if (!member) {
            openSettings();
            return;
          }
          setOpen(true);
        }}
      >
        Move or withdraw funds
      </button>
      {open && (
        <form
          className="ledger-editor"
          aria-label="Fund movement"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!candidate || !member) return;
            setError('');
            if (
              !window.confirm(
                `Record ${formatMoney(candidate.amountMinor)} from ${from} to ${to === 'external' ? 'outside tracked funds' : to}?`,
              )
            )
              return;
            try {
              if (await commit(appendEntries(document, [candidate]))) {
                setOpen(false);
                setAmount('');
                setNote('');
                setDate(today);
                setId(crypto.randomUUID());
              }
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        >
          <fieldset disabled={disabled}>
            <h3>Move or withdraw funds</h3>
            <div className="input-row">
              <label>
                From
                <select
                  aria-label="Move from fund"
                  value={from}
                  onChange={(e) => setFrom(e.target.value as Fund)}
                >
                  <option value="operating">Operating</option>
                  <option value="savings">Savings</option>
                </select>
              </label>
              <label>
                To
                <select
                  aria-label="Move to fund"
                  value={to}
                  onChange={(e) => setTo(e.target.value as Fund | 'external')}
                >
                  <option value="operating">Operating</option>
                  <option value="savings">Savings</option>
                  <option value="external">Outside tracked funds</option>
                </select>
              </label>
            </div>
            <label>
              Amount (€)
              <input
                aria-label="Fund movement amount"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Description
              <input
                aria-label="Fund movement description"
                required
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <details className="advanced-options">
              <summary>Advanced options</summary>
              <label>
                Date
                <input
                  aria-label="Fund movement date"
                  type="date"
                  min="2000-01-01"
                  max={today}
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </details>
            <p className="muted">
              Record a movement already made. Transfers change fund balances
              without creating spending or personal debt. For a purchase, use
              Add expense and choose the paying fund under Advanced options.
            </p>
            {to === 'external' && (
              <p className="muted">
                This withdrawal leaves the tracked household funds. It is not an
                expense.
              </p>
            )}
            {(error || (amount && validation)) && (
              <p className="validation" role="alert">
                {error || validation}
              </p>
            )}
            <div className="entry-actions">
              <button className="primary" type="submit" disabled={!candidate}>
                Record movement
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setOpen(false);
                  setAmount('');
                  setNote('');
                  setError('');
                  setDate(today);
                  setId(crypto.randomUUID());
                }}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {document.transfers.length > 0 ? (
        <div className="transfer-list">
          {[...document.transfers]
            .sort(
              (a, b) =>
                b.month.localeCompare(a.month) ||
                a.member - b.member ||
                a.fund.localeCompare(b.fund),
            )
            .map((t) => (
              <div className="transfer-row" key={t.id}>
                <div>
                  <strong>{document.memberNames[t.member]}</strong>
                  <small>
                    {t.month} · {t.fund} ·{' '}
                    {new Date(t.confirmedAt).toLocaleDateString()}
                  </small>
                </div>
                <strong>{formatMoney(t.amountMinor)}</strong>
              </div>
            ))}
        </div>
      ) : (
        <p className="muted">No confirmed contributions yet.</p>
      )}
      <p className="muted">
        Movements and their reversal controls appear in Expenses &amp; payment
        history.
      </p>
    </details>
  );
}
