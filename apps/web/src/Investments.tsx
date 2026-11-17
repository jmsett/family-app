import { useEffect, useState } from 'react';
import {
  defaultHomeAssumptions,
  homeAffordability,
  incomesFor,
  parseMoney,
  parsePercentage,
} from '@family/domain';
import type { HomeAssumptions } from '@family/domain';
import type { HouseholdPlan } from '@family/shared';
import { formatMoney as money } from './SignedMoney';
const storageKey = `family-home-scenarios-v1${new URLSearchParams(window.location.search).get('demo') === '1' ? '-demo' : ''}`;
const percentKeys = [
  'capLowBasisPoints',
  'capHighBasisPoints',
  'rateLowBasisPoints',
  'rateHighBasisPoints',
  'purchaseCostsBasisPoints',
];
function initial() {
  let values = defaultHomeAssumptions;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (stored) {
      homeAffordability(0, stored);
      values = stored;
    }
  } catch {
    /* Use validated defaults. */
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      String(key === 'years' ? value : value / 100),
    ]),
  );
}
export function Investments({
  document,
  month,
  onMonth,
}: {
  document: HouseholdPlan;
  month: string;
  onMonth: (month: string) => void;
}) {
  const [fields, setFields] = useState(initial);
  const incomes = incomesFor(document, month);
  const income = incomes[0] + incomes[1];
  let result: ReturnType<typeof homeAffordability> | null = null,
    error = '';
  let assumptions: HomeAssumptions | null = null;
  try {
    assumptions = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        key === 'years'
          ? Number(value)
          : percentKeys.includes(key)
            ? parsePercentage(value)
            : parseMoney(value),
      ]),
    ) as unknown as HomeAssumptions;
    result = homeAffordability(income, assumptions);
  } catch (e) {
    error = (e as Error).message;
  }
  const serialized = assumptions && result ? JSON.stringify(assumptions) : null;
  useEffect(() => {
    if (serialized)
      try {
        localStorage.setItem(storageKey, serialized);
      } catch {
        /* In-memory calculator remains usable. */
      }
  }, [serialized]);
  const field = (key: keyof HomeAssumptions, label: string) => (
    <label key={key}>
      {label}
      <input
        aria-label={label}
        inputMode={key === 'years' ? 'numeric' : 'decimal'}
        value={fields[key]}
        onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
      />
    </label>
  );
  const maxPrice = Math.max(
    1,
    ...(result?.sensitivity.map((s) => s.high.priceMinor) ?? []),
  );
  return (
    <div className="investments-page">
      <section className="panel" aria-label="Net annual income">
        <div className="panel-heading">
          <h2>Net annual income</h2>
          <label>
            Income month
            <input
              aria-label="Investment income month"
              type="month"
              min="2000-01"
              max="2100-12"
              value={month}
              onChange={(e) => {
                if (e.target.value) onMonth(e.target.value);
              }}
            />
          </label>
        </div>
        <dl className="income-summary">
          {document.memberNames.map((name, i) => (
            <div key={i}>
              <dt>{name}</dt>
              <dd data-testid={`annual-income-${i}`}>
                {money(incomes[i] * 12)}
              </dd>
              <small>{money(incomes[i])} / month</small>
            </div>
          ))}
          <div>
            <dt>Household</dt>
            <dd data-testid="annual-household-income">{money(income * 12)}</dd>
            <small>{money(income)} / month</small>
          </div>
        </dl>
        <small>
          Current take-home income × 12, excluding extra payments. Edit income
          in Settings.
        </small>
      </section>
      <section
        className="panel affordability-panel"
        aria-label="Home affordability"
      >
        <h2>Home affordability</h2>
        <details className="calculator-options">
          <summary>1 · Monthly loan budget</summary>
          <p className="muted">
            Household net income × housing share, minus monthly ownership costs
            and existing debt payments.
          </p>
          <div className="input-row">
            {field('capLowBasisPoints', 'Housing share minimum (%)')}
            {field('capHighBasisPoints', 'Housing share maximum (%)')}
          </div>
          <div className="input-row">
            {field('costsLowMinor', 'Monthly ownership costs minimum (€)')}
            {field('costsHighMinor', 'Monthly ownership costs maximum (€)')}
          </div>
          <small>
            Include utilities, maintenance, property tax, insurance and any
            building fees. €350–500 is an editable starting estimate.
          </small>
          {field('otherDebtMinor', 'Other monthly debt payments (€)')}
        </details>
        <details className="calculator-options">
          <summary>2 · Rates &amp; purchase assumptions</summary>
          <div className="input-row">
            {field('rateLowBasisPoints', 'Best-case annual interest (%)')}
            {field('rateHighBasisPoints', 'Worst-case annual interest (%)')}
          </div>
          <div className="input-row">
            {field('years', 'Full repayment term (years)')}
            {field('cashMinor', 'Available upfront cash (€)')}
          </div>
          {field('purchaseCostsBasisPoints', 'Purchase costs (% of price)')}
          <small>
            Cash covers purchase costs and the remainder goes toward the price.
            Keep an emergency reserve outside this amount. A fixed-rate loan is
            fully repaid over the chosen term. Purchase costs vary by location;
            the default 10% is an assumption.
          </small>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setFields(
                Object.fromEntries(
                  Object.entries(defaultHomeAssumptions).map(([k, v]) => [
                    k,
                    String(k === 'years' ? v : v / 100),
                  ]),
                ),
              );
            }}
          >
            Reset assumptions
          </button>
        </details>
        {error && (
          <p className="validation" role="alert">
            {error}
          </p>
        )}
        {result && assumptions && (
          <>
            <div className="home-price-result">
              <small>Estimated home price range</small>
              <strong data-testid="home-price-range">
                {money(result.low.priceMinor)} – {money(result.high.priceMinor)}
              </strong>
              <span>
                {assumptions.years} years ·{' '}
                {(assumptions.rateLowBasisPoints / 100).toFixed(2)}–
                {(assumptions.rateHighBasisPoints / 100).toFixed(2)}% interest
              </span>
            </div>
            <div className="scenario-cards">
              <div>
                <small>Conservative</small>
                <strong data-testid="home-low-price">
                  {money(result.low.priceMinor)}
                </strong>
                <span>{money(result.low.paymentMinor)} / month loan</span>
                <small>{money(result.low.loanMinor)} borrowed</small>
              </div>
              <div>
                <small>Optimistic</small>
                <strong data-testid="home-high-price">
                  {money(result.high.priceMinor)}
                </strong>
                <span>{money(result.high.paymentMinor)} / month loan</span>
                <small>{money(result.high.loanMinor)} borrowed</small>
              </div>
            </div>
            <div
              className="affordability-plot"
              role="group"
              aria-label="Home price ranges by interest rate; higher rates reduce the affordable price"
            >
              <div className="sensitivity-heading">
                <span>Interest</span>
                <span>Home price · lower to upper budget</span>
              </div>
              {result.sensitivity.map((s, i) => (
                <div className="sensitivity-row" key={i}>
                  <span>{(s.rate / 100).toFixed(2)}%</span>
                  <div className="sensitivity-track">
                    <div
                      className="sensitivity-band"
                      style={{
                        left: `${(100 * s.low.priceMinor) / maxPrice}%`,
                        width: `${(100 * (s.high.priceMinor - s.low.priceMinor)) / maxPrice}%`,
                      }}
                    />
                  </div>
                  <small>
                    {money(s.low.priceMinor)} – {money(s.high.priceMinor)}
                  </small>
                </div>
              ))}
            </div>
            {income === 0 && (
              <p className="muted">
                Enter net monthly income in Settings to calculate the loan
                budget.
              </p>
            )}
            {result.low.paymentMinor === 0 && income > 0 && (
              <p className="muted">
                The conservative scenario leaves no monthly loan budget after
                costs.
              </p>
            )}
            {assumptions.cashMinor <
              (result.high.priceMinor * assumptions.purchaseCostsBasisPoints) /
                10000 && (
              <p className="muted">
                Upfront cash is below estimated purchase costs; this scenario
                assumes the gap can be financed. A lender may require more cash.
              </p>
            )}
            <p className="muted">
              Planning estimate using your assumptions, not a lender offer.
              Rates stay constant for the full term; refinancing and income
              changes are not modeled.
            </p>
            <details className="calculator-options">
              <summary>Calculation details</summary>
              <p>
                Monthly loan payment = max(0, household monthly net income ×
                housing share − ownership costs − other debt payments).
              </p>
              <p>
                Loan = payment × (1 − (1 + monthly interest)⁻ᵐᵒⁿᵗʰˢ) / monthly
                interest. At 0% interest, loan = payment × months.
              </p>
              <p>
                Home price = (loan + available cash) / (1 + purchase cost rate).
                Conservative combines the lower budget with the higher rate;
                optimistic combines the higher budget with the lower rate. No
                savings are withdrawn by using this calculator.
              </p>
              <a
                href="https://www.consumerfinance.gov/owning-a-home/prepare/decide-how-much-you-want-spend/"
                target="_blank"
                rel="noreferrer"
              >
                About affordability assumptions
              </a>
            </details>
          </>
        )}
      </section>
    </div>
  );
}
