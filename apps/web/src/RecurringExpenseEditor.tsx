import { Select } from './Select';
import { useState } from 'react';
import {
  editRecurringExpense,
  EXPENSE_CATEGORIES,
  parseMoney,
  recurringExpenseFor,
} from '@family/domain';
import type { HouseholdPlan } from '@family/shared';
const monthName = (month: string) =>
  new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00Z`));
export function RecurringExpenseEditor({
  document,
  id,
  month,
  disabled,
  apply,
  cancel,
}: {
  document: HouseholdPlan;
  id: string;
  month: string;
  disabled: boolean;
  apply: (next: HouseholdPlan) => void;
  cancel: () => void;
}) {
  const original = document.expenses.find((e) => e.id === id)!;
  const current = recurringExpenseFor(document, id, month);
  const firstMonth = original.firstDueDate.slice(0, 7);
  const [scope, setScope] = useState<'forward' | 'all'>(
    month >= firstMonth ? 'forward' : 'all',
  );
  const [name, setName] = useState(current.name),
    [amount, setAmount] = useState((current.amountMinor / 100).toFixed(2)),
    [day, setDay] = useState(String(current.dueDay));
  const [category, setCategory] = useState(current.category),
    [customCategory, setCustomCategory] = useState(''),
    [labels, setLabels] = useState(current.labels.join(', '));
  const [duration, setDuration] = useState(
      current.endDate ? 'limited' : 'indefinite',
    ),
    [end, setEnd] = useState(current.endDate ?? ''),
    [error, setError] = useState('');
  const categories = [
    ...new Set([
      ...EXPENSE_CATEGORIES,
      ...document.expenses.map((e) => e.category),
      ...document.expenseChanges.map((c) => c.category),
    ]),
  ];
  return (
    <form
      className="expense-form"
      aria-label="Edit recurring expense"
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        try {
          apply(
            editRecurringExpense(
              document,
              id,
              month,
              {
                name: name.trim(),
                amountMinor: parseMoney(amount),
                dueDay: Number(day),
                category: (category || customCategory).trim(),
                labels: [
                  ...new Set(
                    labels
                      .split(',')
                      .map((l) => l.trim())
                      .filter(Boolean),
                  ),
                ],
                endDate: duration === 'limited' ? end : null,
              },
              scope,
            ),
          );
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <fieldset disabled={disabled}>
        <h3>Edit recurring expense</h3>
        <label>
          Apply changes
          <Select
            aria-label="Recurring edit scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as 'forward' | 'all')}
          >
            <option value="forward" disabled={month < firstMonth}>
              From {monthName(month)} onward
            </option>
            <option value="all">All months from {monthName(firstMonth)}</option>
          </Select>
        </label>
        <small>
          {scope === 'forward'
            ? `Earlier months stay unchanged. This replaces any scheduled changes from ${monthName(month)} onward.`
            : 'This corrects the schedule from its original start, replacing all existing versions.'}{' '}
          Changes apply after Save monthly plan.
        </small>
        <label>
          Expense name
          <input
            aria-label="Expense name"
            value={name}
            maxLength={80}
            required
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="input-row">
          <label>
            Monthly amount
            <input
              aria-label="Monthly amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label>
            Due day of month
            <input
              aria-label="Recurring due day"
              type="number"
              min="1"
              max="31"
              inputMode="numeric"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
            />
          </label>
        </div>
        <small>
          First defined {original.firstDueDate}. Due days 29–31 use the last day
          in shorter months.
        </small>
        <label>
          Category
          <Select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="">Custom category…</option>
          </Select>
        </label>
        {!category && (
          <label>
            Custom category
            <input
              aria-label="Custom category"
              value={customCategory}
              maxLength={40}
              required
              onChange={(e) => setCustomCategory(e.target.value)}
            />
          </label>
        )}
        <label>
          Labels <small>Optional, separated by commas</small>
          <input
            aria-label="Labels"
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
          />
        </label>
        <label>
          Payment duration
          <Select
            aria-label="Payment duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option value="indefinite">Until archived</option>
            <option value="limited">Until a specific date</option>
          </Select>
        </label>
        {duration === 'limited' && (
          <label>
            Last payment date
            <input
              aria-label="Last payment date"
              type="date"
              min={original.firstDueDate}
              max="2100-12-31"
              value={end}
              required
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        )}
        {original.archivedFromMonth && (
          <p className="muted">
            Still archived from {monthName(original.archivedFromMonth)}. Editing
            corrects the schedule without reactivating it.
          </p>
        )}
        {error && (
          <p className="validation" role="alert">
            {error}
          </p>
        )}
        <div className="action-row">
          <button type="submit" className="secondary">
            Apply edit to plan
          </button>
          <button type="button" className="text-button" onClick={cancel}>
            Cancel edit
          </button>
        </div>
      </fieldset>
    </form>
  );
}
