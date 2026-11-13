import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { parseMoney, projectBudget } from '@family/domain';
import type { BudgetDraft, Workspace } from '@family/shared';
import './style.css';

const money = (minor: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
    minor / 100,
  );
const amountInput = (minor: number) => (minor / 100).toFixed(2);
const monthLabel = (month: string) =>
  new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T12:00:00Z`));
const currentMonth = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Busingen',
  year: 'numeric',
  month: '2-digit',
}).format(new Date());

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.message ?? 'The server could not complete this request.',
    );
  return data as T;
}

function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [draft, setDraft] = useState<BudgetDraft | null>(null);
  const [total, setTotal] = useState('');
  const [savings, setSavings] = useState('');
  const [month, setMonth] = useState(currentMonth);
  const [view, setView] = useState<'overview' | 'plan'>('overview');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function accept(data: Workspace) {
    setWorkspace(data);
    setDraft(data.draft);
    setTotal(amountInput(data.draft.totalMinor));
    setSavings(amountInput(data.draft.savingsMinor));
  }
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    setError('');
    setNotice('');
    request<Workspace>(`/api/workspace?month=${encodeURIComponent(month)}`, {
      signal: controller.signal,
    })
      .then(accept)
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [month]);

  let candidate: BudgetDraft | null = null;
  let validation = '';
  try {
    if (draft) {
      candidate = {
        ...draft,
        totalMinor: parseMoney(total),
        savingsMinor: parseMoney(savings),
      };
      projectBudget(candidate);
    }
  } catch (err) {
    validation = (err as Error).message;
    candidate = null;
  }
  const projection = candidate ? projectBudget(candidate) : null;
  const dirty =
    !!draft &&
    (total !== amountInput(workspace?.draft.totalMinor ?? 0) ||
      savings !== amountInput(workspace?.draft.savingsMinor ?? 0) ||
      JSON.stringify(draft) !== JSON.stringify(workspace?.draft));
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!candidate) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      accept(
        await request<Workspace>('/api/budget-draft', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(candidate),
        }),
      );
      setNotice(
        'Draft saved on this computer. No money has been recorded or moved.',
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Family Manager home">
          <span className="brand-mark">
            fm<span>✳</span>
          </span>
          <span>
            family
            <br />
            <b>manager</b>
          </span>
        </a>
        <div className="household">
          <span className="house-icon">⌂</span>
          <div>
            <strong>Our household</strong>
            <small>Two people. One plan.</small>
          </div>
        </div>
        <p className="nav-label">YOUR SPACE</p>
        <nav aria-label="Main navigation">
          <button
            className={view === 'overview' ? 'selected' : ''}
            onClick={() => setView('overview')}
            aria-current={view === 'overview' ? 'page' : undefined}
          >
            <span>◫</span> Overview
          </button>
          <button
            className={view === 'plan' ? 'selected' : ''}
            onClick={() => setView('plan')}
            aria-current={view === 'plan' ? 'page' : undefined}
          >
            <span>▤</span> Monthly plan
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" /> LOCAL PROTOTYPE
          <p>Your plan stays on this computer. Account access comes next.</p>
          <small>Foundation · milestone 0</small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            OUR HOUSEHOLD{' '}
            <span className="breadcrumb">
              / {view === 'overview' ? 'Overview' : 'Monthly plan'}
            </span>
          </span>
          <span className="local-badge">
            <span className="status-dot" /> Local only
          </span>
        </header>
        <section className="page-heading">
          <div>
            <p className="eyebrow">A LITTLE CLARITY, TOGETHER</p>
            <h1>
              {view === 'overview'
                ? 'Make room for what matters.'
                : 'A plan you can agree on.'}
            </h1>
            <p>
              {view === 'overview'
                ? 'Your household plan, with every number in its place.'
                : 'Set your monthly targets before setting money aside.'}
            </p>
          </div>
          <label className="month-picker">
            <span>Planning month</span>
            <input
              aria-label="Planning month"
              type="month"
              min="2000-01"
              max="2100-12"
              value={month}
              disabled={busy}
              onChange={(e) => {
                if (
                  e.target.value &&
                  (!dirty ||
                    window.confirm(
                      'Discard unsaved changes and switch months?',
                    ))
                ) {
                  setWorkspace(null);
                  setDraft(null);
                  setMonth(e.target.value);
                }
              }}
            />
          </label>
        </section>
        {error && (
          <div className="message error" role="alert">
            {error}{' '}
            <button
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm(
                    'Discard your changes and reload the saved draft?',
                  )
                )
                  window.location.reload();
              }}
            >
              Reload saved draft
            </button>
          </div>
        )}
        {notice && (
          <div className="message success" role="status">
            {notice}
          </div>
        )}
        {!workspace || !draft ? (
          <section className="panel empty-state" aria-busy={busy}>
            <h2>
              {busy ? 'Opening your monthly plan…' : 'Your plan is unavailable'}
            </h2>
            <p>
              {busy
                ? 'Connecting to the local household database.'
                : 'Check that the API is running, then reload the page.'}
            </p>
          </section>
        ) : (
          <>
            <div className="draft-banner">
              <span className="pill">DRAFT</span>
              <p>
                <strong>{monthLabel(month)} is a proposal.</strong> Targets
                below are plans, not money available to spend.
              </p>
              <span className="save-state">
                {busy
                  ? 'Saving…'
                  : dirty
                    ? 'Unsaved changes'
                    : draft.revision
                      ? 'Saved locally'
                      : 'Not saved yet'}
              </span>
            </div>
            {view === 'overview' && (
              <section
                className="summary-grid"
                aria-label="Monthly target summary"
              >
                <article className="summary-card total">
                  <span className="card-label">
                    TOTAL MONTHLY TARGET <span>↗</span>
                  </span>
                  <strong>
                    {candidate ? money(candidate.totalMinor) : '—'}
                  </strong>
                  <p>For everyday life & future plans</p>
                  <div className="allocation-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${candidate && candidate.totalMinor ? (candidate.savingsMinor / candidate.totalMinor) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="allocation-legend">
                    <span>● Operating</span>
                    <span>● Savings</span>
                  </div>
                </article>
                <article className="summary-card">
                  <span className="card-label">
                    OPERATING TARGET <span>⌂</span>
                  </span>
                  <strong>
                    {projection ? money(projection.operatingMinor) : '—'}
                  </strong>
                  <p>Planned for your monthly essentials</p>
                  <span className="subtle-tag">Budget ≠ bank balance</span>
                </article>
                <article className="summary-card">
                  <span className="card-label">
                    SAVINGS TARGET <span>✳</span>
                  </span>
                  <strong>
                    {candidate ? money(candidate.savingsMinor) : '—'}
                  </strong>
                  <p>A little space for the bigger things</p>
                  <span className="subtle-tag">Planned allocation only</span>
                </article>
              </section>
            )}
            <div className="content-grid">
              <section className="panel planner">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">PLAN TOGETHER</p>
                    <h2>Your monthly blueprint</h2>
                  </div>
                  <span className="step-label">01 / Set targets</span>
                </div>
                <form onSubmit={(event) => void save(event)}>
                  <fieldset disabled={busy}>
                    <legend className="sr-only">Monthly budget draft</legend>
                    <div className="input-row">
                      <label>
                        Total allocation{' '}
                        <span className="currency-input">
                          <span>€</span>
                          <input
                            aria-label="Total allocation"
                            inputMode="decimal"
                            value={total}
                            onChange={(e) => {
                              setTotal(e.target.value);
                              setNotice('');
                            }}
                            required
                          />
                        </span>
                        <small>Operating + general savings</small>
                      </label>
                      <label>
                        General savings{' '}
                        <span className="currency-input">
                          <span>€</span>
                          <input
                            aria-label="General savings"
                            inputMode="decimal"
                            value={savings}
                            onChange={(e) => {
                              setSavings(e.target.value);
                              setNotice('');
                            }}
                            required
                          />
                        </span>
                        <small>Included in your total allocation</small>
                      </label>
                    </div>
                    <div className="divider" />
                    <div className="split-heading">
                      <h3>How will you share it?</h3>
                      <span>
                        {draft.firstMemberBasisPoints / 100} /{' '}
                        {(10000 - draft.firstMemberBasisPoints) / 100}
                      </span>
                    </div>
                    <div className="input-row names">
                      <label>
                        First member
                        <input
                          aria-label="First member"
                          value={draft.memberNames[0]}
                          maxLength={40}
                          onChange={(e) => {
                            setDraft({
                              ...draft,
                              memberNames: [
                                e.target.value,
                                draft.memberNames[1],
                              ],
                            });
                            setNotice('');
                          }}
                          required
                        />
                      </label>
                      <label>
                        Second member
                        <input
                          aria-label="Second member"
                          value={draft.memberNames[1]}
                          maxLength={40}
                          onChange={(e) => {
                            setDraft({
                              ...draft,
                              memberNames: [
                                draft.memberNames[0],
                                e.target.value,
                              ],
                            });
                            setNotice('');
                          }}
                          required
                        />
                      </label>
                    </div>
                    <label className="range-label" htmlFor="split">
                      {draft.memberNames[0] || 'First member'}’s share{' '}
                      <strong>{draft.firstMemberBasisPoints / 100}%</strong>
                    </label>
                    <input
                      id="split"
                      type="range"
                      min="0"
                      max="10000"
                      step="100"
                      value={draft.firstMemberBasisPoints}
                      onChange={(e) => {
                        setDraft({
                          ...draft,
                          firstMemberBasisPoints: Number(e.target.value),
                        });
                        setNotice('');
                      }}
                    />
                    <div className="member-targets">
                      {draft.memberNames.map((name, index) => (
                        <div key={index}>
                          <span className={`avatar avatar-${index}`}>
                            {name.trim().slice(0, 1).toUpperCase() || '?'}
                          </span>
                          <div>
                            <span>{name || `Member ${index + 1}`}</span>
                            <strong data-testid={`target-${index}`}>
                              {projection
                                ? money(projection.memberTargetsMinor[index])
                                : '—'}
                            </strong>
                            <small>Contribution target</small>
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
                      <small>
                        Saving a draft creates no contribution or expense.
                      </small>
                      <button
                        className="primary"
                        type="submit"
                        disabled={
                          !candidate || busy || (!dirty && draft.revision > 0)
                        }
                      >
                        {busy ? 'Saving…' : 'Save draft'}{' '}
                        <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                  </fieldset>
                </form>
              </section>
              <div className="right-column">
                <section className="panel reality">
                  <p className="eyebrow">THE RECORDED PICTURE</p>
                  <h2>Plans are a starting point.</h2>
                  <p className="muted">
                    Nothing is marked as funded just because you made a plan.
                  </p>
                  <dl>
                    <div>
                      <dt>Earmarked by members</dt>
                      <dd>{money(workspace.recorded.earmarkedMinor)}</dd>
                    </div>
                    <div>
                      <dt>Recorded expenses</dt>
                      <dd>{money(workspace.recorded.expensesMinor)}</dd>
                    </div>
                    <div>
                      <dt>Household owes members</dt>
                      <dd>{money(workspace.recorded.payableMinor)}</dd>
                    </div>
                  </dl>
                  <div className="note">
                    <span>i</span>
                    <p>
                      Financial entry is coming in the ledger milestone. These
                      recorded totals remain zero in this prototype.
                    </p>
                  </div>
                </section>
                <section className="next-card">
                  <span className="plant" aria-hidden="true">
                    ✳
                  </span>
                  <p className="eyebrow">BUILT ONE STEP AT A TIME</p>
                  <h2>First, a shared foundation.</h2>
                  <p>
                    Try a month, adjust your split, and save a plan. Your
                    feedback shapes the next milestone: private household
                    access.
                  </p>
                </section>
              </div>
            </div>
            <footer>
              <span>
                Family Manager <span aria-hidden="true">·</span> A calmer kind
                of money talk.
              </span>
              <span>EUR · Europe/Busingen</span>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
