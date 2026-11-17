import { useEffect, useState } from 'react';
import {
  allocateTrip,
  parseMoney,
  parsePercentage,
  tripBudget,
  tripLabel,
  tripSavings,
  tripReserved,
  tripSavingsSpent,
  validateHousehold,
  validDate,
} from '@family/domain';
import type { HouseholdPlan, TripGoal } from '@family/shared';
import { formatMoney as money } from './SignedMoney';
import { ProgressBar } from './ProgressBar';
import { prepareTripPhoto } from './trip-photo';
type Commit = (doc: HouseholdPlan) => Promise<boolean>;
const inputAmount = (n: number) => (n / 100).toFixed(2);
function TripEditor({
  document,
  original,
  disabled,
  commit,
  close,
}: {
  document: HouseholdPlan;
  original?: TripGoal;
  disabled: boolean;
  commit: Commit;
  close: () => void;
}) {
  const [id] = useState(() => original?.id ?? crypto.randomUUID());
  const [name, setName] = useState(original?.name ?? '');
  const [start, setStart] = useState(original?.startDate ?? ''),
    [end, setEnd] = useState(original?.endDate ?? '');
  const [days, setDays] = useState(String(original?.days ?? 7)),
    [nights, setNights] = useState(String(original?.nights ?? 6));
  const [food, setFood] = useState(
      inputAmount(original?.foodPerPersonMinor ?? 3500),
    ),
    [hotel, setHotel] = useState(
      inputAmount(original?.hotelPerNightMinor ?? 10000),
    ),
    [flight, setFlight] = useState(
      inputAmount(original?.flightPerPersonMinor ?? 20000),
    );
  const [other, setOther] = useState(inputAmount(original?.otherMinor ?? 0));
  const [extrasMode, setExtrasMode] = useState<'percentage' | 'fixed'>(
      original?.extrasMode ?? 'percentage',
    ),
    [extras, setExtras] = useState(inputAmount(original?.extrasMinor ?? 0)),
    [extraPercent, setExtraPercent] = useState(
      String((original?.extrasBasisPoints ?? 1500) / 100),
    );
  const [photo, setPhoto] = useState(original?.photo ?? null),
    [photoBusy, setPhotoBusy] = useState(false),
    [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  let candidate: TripGoal | null = null,
    validation = '';
  try {
    candidate = {
      id,
      name: name.trim(),
      label: original?.label ?? tripLabel(name, id),
      startDate: start || null,
      endDate: end || null,
      days: Number(days),
      nights: Number(nights),
      foodPerPersonMinor: parseMoney(food),
      hotelPerNightMinor: parseMoney(hotel),
      flightPerPersonMinor: parseMoney(flight),
      extrasMode,
      extrasBasisPoints:
        extrasMode === 'percentage'
          ? parsePercentage(extraPercent)
          : (original?.extrasBasisPoints ?? 1500),
      extrasMinor:
        extrasMode === 'fixed'
          ? parseMoney(extras)
          : (original?.extrasMinor ?? 0),
      otherMinor: parseMoney(other),
      allocatedMinor: original?.allocatedMinor ?? 0,
      photo,
      archived: original?.archived ?? false,
    };
    const next = {
      ...document,
      trips: [...document.trips.filter((t) => t.id !== id), candidate],
    };
    validateHousehold(next);
    if (
      new TextEncoder().encode(JSON.stringify(next, null, 2)).length > 1000000
    )
      throw new Error(
        'Household JSON is too large to sync. Remove a destination photo before saving.',
      );
  } catch (e) {
    validation = (e as Error).message;
    candidate = null;
  }
  const changeDate = (which: 'start' | 'end', value: string) => {
    const a = which === 'start' ? value : start,
      b = which === 'end' ? value : end;
    if (which === 'start') setStart(value);
    else setEnd(value);
    if (validDate(a) && validDate(b) && b >= a)
      setNights(String(Math.round((Date.parse(b) - Date.parse(a)) / 86400000)));
  };
  const amountField = (
    label: string,
    value: string,
    set: (value: string) => void,
  ) => (
    <label>
      {label}
      <input
        aria-label={label}
        inputMode="decimal"
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
  return (
    <form
      className="panel trip-editor"
      aria-label={original ? 'Edit trip' : 'New trip'}
      onSubmit={async (e) => {
        e.preventDefault();
        setTouched(true);
        if (
          candidate &&
          !photoBusy &&
          (await commit({
            ...document,
            trips: [...document.trips.filter((t) => t.id !== id), candidate],
          }))
        )
          close();
      }}
    >
      <fieldset disabled={disabled || photoBusy}>
        <h2>{original ? 'Edit trip' : 'New trip'}</h2>
        <label>
          Trip name
          <input
            aria-label="Trip name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </label>
        {name.trim() && (
          <small>
            Expense label: {original?.label ?? tripLabel(name, id)}
            {original ? ' · retained when renamed' : ''}
          </small>
        )}
        <div className="input-row">
          <label>
            Departure (optional)
            <input
              aria-label="Trip departure"
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={start}
              onChange={(e) => changeDate('start', e.target.value)}
            />
          </label>
          <label>
            Return (optional)
            <input
              aria-label="Trip return"
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={end}
              onChange={(e) => changeDate('end', e.target.value)}
            />
          </label>
        </div>
        <div className="input-row">
          {!start && !end ? (
            <label>
              Estimated travel days
              <input
                aria-label="Estimated travel days"
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </label>
          ) : (
            <p className="muted">
              Food covers both travel dates. Hotel nights start from the date
              difference; adjust for overnight travel.
            </p>
          )}
          <label>
            Hotel nights
            <input
              aria-label="Hotel nights"
              inputMode="numeric"
              value={nights}
              onChange={(e) => setNights(e.target.value)}
            />
          </label>
        </div>
        <div className="input-row">
          {amountField('Daily food per person (€)', food, setFood)}
          {amountField('Hotel per night · 2 people (€)', hotel, setHotel)}
        </div>
        {amountField('Return flights per person (€)', flight, setFlight)}
        {amountField('Other planned expenses · total (€)', other, setOther)}
        <small>
          One lump sum for both people: tours, activities or other planned
          costs.
        </small>
        <div className="input-row">
          <label>
            Contingency
            <select
              aria-label="Trip extras method"
              value={extrasMode}
              onChange={(e) =>
                setExtrasMode(e.target.value as 'percentage' | 'fixed')
              }
            >
              <option value="percentage">Percentage estimate</option>
              <option value="fixed">Custom amount</option>
            </select>
          </label>
          {extrasMode === 'percentage'
            ? amountField('Extra allowance (%)', extraPercent, setExtraPercent)
            : amountField('Fixed contingency (€)', extras, setExtras)}
        </div>
        <small>
          The contingency is based on food, hotel and flights. Planned other
          expenses are added separately, without increasing this allowance.
        </small>
        <details className="calculator-options">
          <summary>Destination picture</summary>
          {photo && (
            <img className="trip-photo" src={photo} alt="Destination preview" />
          )}
          <label>
            Upload destination picture
            <input
              aria-label="Upload destination picture"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setError('');
                setPhotoBusy(true);
                try {
                  setPhoto(await prepareTripPhoto(file));
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setPhotoBusy(false);
                }
              }}
            />
          </label>
          <small>
            Compressed on this device and stored in your private household JSON.
            No public photo upload.
          </small>
          {photo && (
            <button
              className="text-button"
              type="button"
              onClick={() => setPhoto(null)}
            >
              Remove picture
            </button>
          )}
        </details>
        {candidate && (
          <p className="trip-budget-preview">
            Estimated total ·{' '}
            <strong data-testid="trip-budget-preview">
              {money(tripBudget(candidate).totalMinor)}
            </strong>{' '}
            · 2 people
          </p>
        )}
        {validation && touched && (
          <p className="validation" role="alert">
            {validation}
          </p>
        )}
        {error && (
          <p className="validation" role="alert">
            {error}
          </p>
        )}
        <div className="entry-actions">
          <button
            className="primary"
            type="submit"
            disabled={disabled || photoBusy}
          >
            {photoBusy ? 'Processing photo…' : 'Save trip'}
          </button>
          <button
            className="text-button"
            type="button"
            disabled={photoBusy}
            onClick={close}
          >
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
function AllocationEditor({
  document,
  trip,
  month,
  disabled,
  commit,
  close,
}: {
  document: HouseholdPlan;
  trip: TripGoal;
  month: string;
  disabled: boolean;
  commit: Commit;
  close: () => void;
}) {
  const [amount, setAmount] = useState(inputAmount(trip.allocatedMinor)),
    [error, setError] = useState('');
  const remaining = Math.max(
    0,
    tripBudget(trip).totalMinor - trip.allocatedMinor,
  );
  const available = tripSavings(document, month).unallocatedMinor;
  return (
    <form
      className="trip-allocation"
      aria-label={`Allocate savings to ${trip.name}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        try {
          if (
            await commit(
              allocateTrip(document, trip.id, parseMoney(amount), month),
            )
          )
            close();
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <fieldset disabled={disabled}>
        <label>
          Total savings earmarked for this trip (€)
          <input
            aria-label="Trip allocated savings"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <small>
          {money(available)} unallocated in joint savings. Set zero to release
          this goal’s allocation. This does not move money.
        </small>
        <button
          className="text-button"
          type="button"
          onClick={() =>
            setAmount(
              inputAmount(trip.allocatedMinor + Math.min(remaining, available)),
            )
          }
        >
          Allocate available savings
        </button>
        {error && (
          <p className="validation" role="alert">
            {error}
          </p>
        )}
        <div className="entry-actions">
          <button className="primary" type="submit">
            Save allocation
          </button>
          <button className="text-button" type="button" onClick={close}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export function Travel({
  document,
  today,
  disabled,
  commit,
  onDirty,
  showExpenses,
}: {
  document: HouseholdPlan;
  today: string;
  disabled: boolean;
  commit: Commit;
  onDirty: (dirty: boolean) => void;
  showExpenses: (trip: TripGoal) => void;
}) {
  const [editor, setEditor] = useState<TripGoal | 'new' | null>(null),
    [allocation, setAllocation] = useState<string | null>(null);
  const savings = tripSavings(document, today.slice(0, 7));
  const editing = editor !== null || allocation !== null;
  useEffect(() => onDirty(editing), [editing, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);
  const active = document.trips.filter((t) => !t.archived),
    archived = document.trips.filter((t) => t.archived);
  return (
    <div className="travel-page">
      <section className="panel trip-savings-summary">
        <div>
          <h2>Travel goals</h2>
          <small>
            {money(savings.unallocatedMinor)} unallocated joint savings ·{' '}
            {money(savings.allocatedMinor)} earmarked
          </small>
        </div>
        <button
          className="trip-add primary"
          aria-label="Add trip"
          title="Add trip"
          disabled={disabled || editing}
          onClick={() => setEditor('new')}
        >
          +
        </button>
      </section>
      {savings.shortfallMinor > 0 && (
        <p className="message error" role="alert">
          Savings are {money(savings.shortfallMinor)} below the total earmarked
          for trips. Release allocations or confirm more savings; earmarks do
          not reserve money at the bank.
        </p>
      )}
      {editor && (
        <TripEditor
          key={editor === 'new' ? 'new' : editor.id}
          document={document}
          original={editor === 'new' ? undefined : editor}
          disabled={disabled}
          commit={commit}
          close={() => setEditor(null)}
        />
      )}
      {!active.length && !editor && (
        <section className="panel">
          <p className="muted">
            Plan a destination, estimate the cost for two, then earmark
            confirmed savings with +.
          </p>
        </section>
      )}
      {active.map((trip) => {
        const budget = tripBudget(trip),
          remaining = Math.max(0, budget.totalMinor - trip.allocatedMinor),
          percent = budget.totalMinor
            ? (trip.allocatedMinor / budget.totalMinor) * 100
            : 0;
        const months =
          trip.startDate && trip.startDate > today
            ? Math.max(
                1,
                (Number(trip.startDate.slice(0, 4)) -
                  Number(today.slice(0, 4))) *
                  12 +
                  Number(trip.startDate.slice(5, 7)) -
                  Number(today.slice(5, 7)),
              )
            : null;
        return (
          <section
            className="panel trip-card"
            aria-label={`Trip: ${trip.name}`}
            key={trip.id}
          >
            <div className="trip-card-heading">
              <div>
                <h2>{trip.name}</h2>
                <small>
                  {trip.startDate
                    ? `${trip.startDate} → ${trip.endDate}`
                    : 'Dates flexible'}{' '}
                  · {budget.days} days / {budget.nights} nights
                </small>
              </div>
              <strong
                className="trip-funded"
                data-testid={`trip-percent-${trip.id}`}
              >
                {Math.round(percent)}%<small>funded</small>
              </strong>
            </div>
            {trip.photo && (
              <img
                className="trip-photo"
                src={trip.photo}
                alt={`${trip.name} destination`}
              />
            )}
            <div className="trip-funding-caption">
              <span>
                {money(trip.allocatedMinor)} / {money(budget.totalMinor)}
              </span>
              <small>
                {remaining
                  ? `${money(remaining)} to go`
                  : budget.totalMinor
                    ? 'Goal covered'
                    : 'Set a budget'}
              </small>
            </div>
            <ProgressBar
              label={`${trip.name} joint savings`}
              value={percent}
              variant="savings"
              valueText={`${Math.round(percent)}% funded · ${money(trip.allocatedMinor)} of ${money(budget.totalMinor)}`}
            />
            {months && remaining > 0 && (
              <small className="trip-saving-pace">
                {money(Math.ceil(remaining / months))} / month until departure
              </small>
            )}
            {allocation === trip.id && (
              <AllocationEditor
                document={document}
                trip={trip}
                month={today.slice(0, 7)}
                disabled={disabled}
                commit={commit}
                close={() => setAllocation(null)}
              />
            )}
            <div className="trip-actions">
              <button
                className="secondary"
                disabled={disabled || editing}
                onClick={() => setAllocation(trip.id)}
              >
                Allocate savings
              </button>
              <button
                className="text-button"
                disabled={disabled || editing}
                onClick={() => setEditor(trip)}
              >
                Edit
              </button>
              <button
                className="text-button"
                disabled={disabled || editing}
                onClick={() => showExpenses(trip)}
              >
                Expenses
              </button>
            </div>
            <details className="trip-details">
              <summary>Budget &amp; details</summary>
              <dl className="plan-totals">
                <div>
                  <dt>Food · 2 × {budget.days} days</dt>
                  <dd>{money(budget.foodMinor)}</dd>
                </div>
                <div>
                  <dt>Hotel · {budget.nights} nights</dt>
                  <dd>{money(budget.hotelMinor)}</dd>
                </div>
                <div>
                  <dt>Flights · 2 return fares</dt>
                  <dd>{money(budget.flightsMinor)}</dd>
                </div>
                <div>
                  <dt>Other planned expenses</dt>
                  <dd>{money(budget.otherMinor)}</dd>
                </div>
                <div>
                  <dt>
                    Contingency
                    {trip.extrasMode === 'percentage'
                      ? ` · ${trip.extrasBasisPoints / 100}%`
                      : ''}
                  </dt>
                  <dd>{money(budget.extrasMinor)}</dd>
                </div>
              </dl>
              <p className="muted">
                {money(tripReserved(document, trip, today.slice(0, 7)))} still
                reserved ·{' '}
                {money(tripSavingsSpent(document, trip, today.slice(0, 7)))}{' '}
                paid from savings.
              </p>
              <small>Expense label: {trip.label}</small>
              <p className="muted">
                Funding includes the amount already paid from savings. The
                remaining earmark is part of joint savings, not additional cash
                or a payment. Tagged savings-funded purchases consume the
                earmark; reversed purchases restore it. Personal expenses do not
                use joint savings.
              </p>
              <button
                className="text-button"
                disabled={disabled || editing}
                onClick={() => {
                  if (
                    window.confirm(
                      `Archive ${trip.name} and release ${money(trip.allocatedMinor)} earmarked savings?`,
                    )
                  )
                    void commit({
                      ...document,
                      trips: document.trips.map((t) =>
                        t.id === trip.id
                          ? { ...t, archived: true, allocatedMinor: 0 }
                          : t,
                      ),
                    });
                }}
              >
                Archive trip
              </button>
            </details>
          </section>
        );
      })}
      {!!archived.length && (
        <details className="panel">
          <summary>Archived trips ({archived.length})</summary>
          {archived.map((t) => (
            <div className="transfer-row" key={t.id}>
              <span>
                {t.name}
                <small>{t.label}</small>
              </span>
              <button
                className="text-button"
                disabled={disabled || editing}
                onClick={() =>
                  void commit({
                    ...document,
                    trips: document.trips.map((r) =>
                      r.id === t.id ? { ...r, archived: false } : r,
                    ),
                  })
                }
              >
                Restore trip
              </button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
