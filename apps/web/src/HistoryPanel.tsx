import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineType,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import {
  buildHistory,
  historyStart,
  EXPENSE_CATEGORIES,
  type HistoryMetric,
  type HistoryInterval,
  type HistoryPoint,
} from '@family/domain';
import type { HouseholdPlan } from '@family/shared';
import { AppearanceContext } from './ProgressBar';
import { formatMoney } from './SignedMoney';
const METRICS = {
  expenses: 'Expenses',
  savings: 'Savings',
  operating: 'Operating funds & goal',
};
type ChartMetric = Exclude<HistoryMetric, 'budget'>;
const INTERVALS = [
  ['day', 'D', 'Daily'],
  ['week', 'W', 'Weekly'],
  ['month', 'M', 'Monthly'],
  ['year', 'Y', 'Yearly'],
] as const;
const timeKey = (time: Time) =>
  typeof time === 'string'
    ? time
    : typeof time === 'object'
      ? `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`
      : new Date(time * 1000).toISOString().slice(0, 10);
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
const pointLabel = (p: HistoryPoint) =>
  p.startDate === p.endDate
    ? dateLabel(p.endDate)
    : `${dateLabel(p.startDate)} – ${dateLabel(p.endDate)}`;
export default function HistoryPanel({
  document: household,
  today,
}: {
  document: HouseholdPlan;
  today: string;
}) {
  const appearance = useContext(AppearanceContext);
  const [metric, setMetric] = useState<ChartMetric>('expenses'),
    [interval, setInterval] = useState<HistoryInterval>('month');
  const [style, setStyle] = useState<'bars' | 'line'>('bars'),
    [category, setCategory] = useState(''),
    [grid, setGrid] = useState(true);
  const [from, setFrom] = useState(() => historyStart(household, today)),
    [to, setTo] = useState(today);
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme ?? 'dark',
  );
  const [hover, setHover] = useState<HistoryPoint | null>(null),
    [visible, setVisible] = useState<{ first: number; last: number } | null>(
      null,
    ),
    [valuePage, setValuePage] = useState(0);
  const [valueRange, setValueRange] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const container = useRef<HTMLDivElement>(null),
    chartRef = useRef<IChartApi | null>(null);
  const rangeRef = useRef<{ from: number; to: number } | null>(null),
    keyRef = useRef('');
  const categories = useMemo(
    () =>
      [
        ...new Set(
          household.ledger
            .filter((e) => e.kind === 'expense')
            .map((e) => (e.kind === 'expense' ? e.category : '')),
        ),
      ].sort(),
    [household],
  );
  const result = useMemo(() => {
    try {
      return {
        points: buildHistory(household, {
          metric,
          interval,
          from,
          to,
          category: metric === 'expenses' ? category : undefined,
        }),
        error: '',
      };
    } catch (error) {
      return { points: [] as HistoryPoint[], error: (error as Error).message };
    }
  }, [household, metric, interval, from, to, category]);
  const { points, error } = result;
  const selected = useMemo(
    () => new Map(points.map((p) => [p.time, p])),
    [points],
  );
  const categoryIndex = EXPENSE_CATEGORIES.indexOf(category);
  const color =
    metric === 'savings'
      ? appearance.savings[0]
      : metric === 'operating'
        ? appearance.operating[1]
        : appearance.chartColors[
            (category
              ? categoryIndex < 0
                ? [...category].reduce((sum, c) => sum + c.charCodeAt(0), 0)
                : categoryIndex
              : 0) % appearance.chartColors.length
          ];
  const fundedColor = appearance.chartColors[4 % appearance.chartColors.length];
  const targetColor = appearance.accent;
  function refreshValueRange() {
    const range = chartRef.current?.priceScale('right').getVisibleRange();
    setValueRange(range ? { from: range.from, to: range.to } : null);
  }
  function fitAll() {
    chartRef.current?.priceScale('right').setAutoScale(true);
    chartRef.current?.timeScale().fitContent();
    requestAnimationFrame(refreshValueRange);
  }
  const resetKey = `${metric}:${interval}:${from}:${to}:${category}:${style}`;
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setTheme(document.documentElement.dataset.theme ?? 'dark'),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setValuePage(0);
  }, [resetKey]);
  useEffect(() => {
    if (!container.current) return;
    const css = getComputedStyle(document.documentElement),
      panel = css.getPropertyValue('--panel').trim(),
      muted = css.getPropertyValue('--muted').trim(),
      border = css.getPropertyValue('--border').trim();
    const chart = createChart(container.current, {
      autoSize: true,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: panel },
        textColor: muted,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: grid, color: border, style: 1 },
        horzLines: { visible: grid, color: border, style: 1 },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.15, bottom: 0.12 },
      },
      timeScale: { borderVisible: false, rightOffset: 1, minBarSpacing: 1 },
      crosshair: { mode: CrosshairMode.Normal },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: true,
      },
      localization: {
        locale: 'en-GB',
        priceFormatter: (value: number) => formatMoney(Math.round(value * 100)),
      },
    });
    chartRef.current = chart;
    const options = {
      color,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'price' as const, precision: 2, minMove: 0.01 },
    };
    const series: ISeriesApi<'Line'> | ISeriesApi<'Histogram'> =
      style === 'line'
        ? chart.addSeries(LineSeries, {
            ...options,
            lineWidth: 2,
            lineType:
              metric === 'expenses' ? LineType.Simple : LineType.WithSteps,
            crosshairMarkerVisible: true,
          })
        : chart.addSeries(HistogramSeries, options);
    series.setData(
      points.map((p) => ({
        time: p.time,
        value: p.amountMinor / 100,
        ...(style === 'bars' && p.amountMinor < 0 ? { color: '#ffb546' } : {}),
      })),
    );
    if (metric !== 'expenses') {
      const funded = chart.addSeries(LineSeries, {
        ...options,
        color: fundedColor,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        lineType: LineType.WithSteps,
        crosshairMarkerVisible: true,
      });
      const target = chart.addSeries(LineSeries, {
        ...options,
        color: targetColor,
        lineWidth: 2,
        lineStyle: LineStyle.SparseDotted,
        lineType: LineType.WithSteps,
        crosshairMarkerVisible: true,
      });
      funded.setData(
        points.map((p) => ({
          time: p.time,
          value: (p.fundedMinor ?? 0) / 100,
        })),
      );
      target.setData(
        points.map((p) => ({
          time: p.time,
          value: (p.targetMinor ?? 0) / 100,
        })),
      );
    }
    const scaleFrame = requestAnimationFrame(refreshValueRange);
    setHover(null);
    const last = Math.max(0, points.length - 1);
    if (keyRef.current === resetKey && rangeRef.current)
      chart.timeScale().setVisibleLogicalRange(rangeRef.current);
    else if (points.length) {
      const count =
        interval === 'day'
          ? 90
          : interval === 'week'
            ? 52
            : interval === 'month'
              ? 24
              : 10;
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(-0.5, last - count + 0.5),
        to: last + 0.5,
      });
    }
    keyRef.current = resetKey;
    const rangeChanged = (range: { from: number; to: number } | null) => {
      rangeRef.current = range;
      if (range && points.length)
        setVisible({
          first: Math.max(0, Math.min(last, Math.ceil(range.from))),
          last: Math.max(0, Math.min(last, Math.floor(range.to))),
        });
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(rangeChanged);
    rangeChanged(chart.timeScale().getVisibleLogicalRange());
    chart.subscribeCrosshairMove((event) =>
      setHover(
        event.time === undefined
          ? null
          : (selected.get(timeKey(event.time)) ?? null),
      ),
    );
    return () => {
      cancelAnimationFrame(scaleFrame);
      rangeRef.current = chart.timeScale().getVisibleLogicalRange();
      chartRef.current = null;
      chart.remove();
    };
  }, [
    points,
    selected,
    color,
    fundedColor,
    targetColor,
    theme,
    style,
    grid,
    metric,
    interval,
    resetKey,
  ]);
  const readout = hover ?? points[visible?.last ?? points.length - 1];
  const visibleFrom = points[visible?.first ?? 0]?.startDate,
    visibleTo = points[visible?.last ?? points.length - 1]?.endDate;
  function zoom(factor: number) {
    const chart = chartRef.current,
      range = chart?.timeScale().getVisibleLogicalRange();
    if (!chart || !range || !points.length) return;
    const span = Math.min(
      points.length,
      Math.max(Math.min(2, points.length), (range.to - range.from) * factor),
    );
    const center = (range.from + range.to) / 2;
    const left = Math.max(
      -0.5,
      Math.min(points.length - 0.5 - span, center - span / 2),
    );
    chart.timeScale().setVisibleLogicalRange({ from: left, to: left + span });
  }
  function pan(direction: number) {
    const chart = chartRef.current,
      range = chart?.timeScale().getVisibleLogicalRange();
    if (!chart || !range) return;
    const span = range.to - range.from,
      step = Math.max(1, span * 0.2) * direction;
    const left = Math.max(
      -0.5,
      Math.min(points.length - 0.5 - span, range.from + step),
    );
    chart.timeScale().setVisibleLogicalRange({ from: left, to: left + span });
  }
  const empty =
    metric === 'expenses'
      ? !points.some((p) => p.amountMinor !== 0)
      : !points.some((p) => p.amountMinor || p.fundedMinor || p.targetMinor);
  const rows = [...points].reverse().slice(valuePage * 30, valuePage * 30 + 30);
  return (
    <section className="panel history-explorer" aria-label="Historical charts">
      <div className="chart-toolbar">
        <label className="chart-series">
          <span className="sr-only">Chart series</span>
          <select
            aria-label="Chart series"
            value={metric}
            onChange={(e) => {
              const next = e.target.value as ChartMetric;
              setMetric(next);
              setStyle(next === 'expenses' ? 'bars' : 'line');
            }}
          >
            {Object.entries(METRICS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="chart-style" role="group" aria-label="Chart style">
          <button
            aria-label="Bars"
            title="Bars"
            aria-pressed={style === 'bars'}
            onClick={() => setStyle('bars')}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M5 20V9m7 11V4m7 16v-7" />
            </svg>
          </button>
          <button
            aria-label="Line"
            title="Line"
            aria-pressed={style === 'line'}
            onClick={() => setStyle('line')}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="m3 17 6-7 5 3 7-10" />
            </svg>
          </button>
        </div>
      </div>
      <div className="chart-readout">
        <strong data-testid="chart-value">
          {readout ? formatMoney(readout.amountMinor) : '—'}
        </strong>
        <span data-testid="chart-point-period">
          {readout ? pointLabel(readout) : 'Choose a valid date range'}
        </span>
        <small>
          {metric === 'expenses'
            ? `Period spending${category ? ` · ${category}` : ''}`
            : 'Available balance at interval end'}
        </small>
      </div>
      {metric !== 'expenses' && readout && (
        <>
          <div className="chart-funding-legend" aria-label="Fund chart legend">
            <span>
              <i style={{ borderColor: color }} aria-hidden="true" />
              Available funds
            </span>
            <span>
              <i
                style={{ borderColor: fundedColor, borderTopStyle: 'dashed' }}
                aria-hidden="true"
              />
              Funded in{' '}
              {dateLabel(readout.endDate).split(' ').slice(1).join(' ')}{' '}
              <strong data-testid="chart-funded">
                {formatMoney(readout.fundedMinor ?? 0)}
              </strong>
            </span>
            <span>
              <i
                style={{ borderColor: targetColor, borderTopStyle: 'dotted' }}
                aria-hidden="true"
              />
              Monthly goal{' '}
              <strong data-testid="chart-target">
                {formatMoney(readout.targetMinor ?? 0)}
              </strong>
            </span>
          </div>
          <p
            className="chart-funding-status"
            data-testid="chart-funding-status"
          >
            {!(readout.targetMinor ?? 0)
              ? 'No funding due for this month.'
              : (readout.fundedMinor ?? 0) >= (readout.targetMinor ?? 0)
                ? 'Monthly funding goal reached.'
                : `${formatMoney((readout.targetMinor ?? 0) - (readout.fundedMinor ?? 0))} to the monthly funding goal.`}
          </p>
        </>
      )}
      <div className="chart-controls">
        <div
          className="chart-intervals"
          role="group"
          aria-label="Chart interval"
        >
          {INTERVALS.map(([key, short, label]) => (
            <button
              key={key}
              aria-label={label}
              title={label}
              aria-pressed={interval === key}
              onClick={() => setInterval(key)}
            >
              {short}
            </button>
          ))}
        </div>
        <div className="chart-zoom" role="group" aria-label="Chart navigation">
          <button
            aria-label="Zoom out"
            title="Zoom out"
            disabled={!points.length}
            onClick={() => zoom(1.5)}
          >
            −
          </button>
          <button
            aria-label="Zoom in"
            title="Zoom in"
            disabled={!points.length}
            onClick={() => zoom(1 / 1.5)}
          >
            +
          </button>
          <button
            aria-label="Fit all history"
            title="Fit all history"
            disabled={!points.length}
            onClick={fitAll}
          >
            All
          </button>
        </div>
      </div>
      {error && (
        <p className="validation" role="alert">
          {error}
        </p>
      )}
      <span className="sr-only" id="chart-instructions">
        Arrows pan; + and minus zoom; Home fits all history. Exact values are
        available under Advanced options.
      </span>
      <div
        className="chart-surface"
        role="group"
        aria-label="History chart"
        aria-describedby="chart-instructions"
        tabIndex={0}
        onTouchStartCapture={(event) => {
          const chart = chartRef.current,
            rect = container.current?.getBoundingClientRect();
          if (!chart || !rect) return;
          const touch = event.touches[0];
          // The renderer also gates axis touch scaling on vertTouchDrag.
          // Enable it only for a gesture starting on the right axis so the
          // plot still allows normal vertical page scrolling.
          const onAxis =
            event.touches.length === 1 &&
            touch.clientX >= rect.right - chart.priceScale('right').width();
          chart.applyOptions({ handleScroll: { vertTouchDrag: onAxis } });
        }}
        onTouchEndCapture={() =>
          requestAnimationFrame(() => {
            chartRef.current?.applyOptions({
              handleScroll: { vertTouchDrag: false },
            });
            refreshValueRange();
          })
        }
        onTouchCancelCapture={() => {
          chartRef.current?.applyOptions({
            handleScroll: { vertTouchDrag: false },
          });
          requestAnimationFrame(refreshValueRange);
        }}
        onMouseUpCapture={() => requestAnimationFrame(refreshValueRange)}
        onWheelCapture={() => requestAnimationFrame(refreshValueRange)}
        onKeyDown={(e) => {
          if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            zoom(1 / 1.5);
          } else if (e.key === '-') {
            e.preventDefault();
            zoom(1.5);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            pan(e.key === 'ArrowLeft' ? -1 : 1);
          } else if (e.key === 'Home') {
            e.preventDefault();
            fitAll();
          }
        }}
      >
        <div
          ref={container}
          className="chart-canvas"
          aria-hidden="true"
          data-testid="history-chart"
        />
        {!error && empty && (
          <p className="chart-empty">
            {metric === 'expenses'
              ? 'No expenses in this range.'
              : 'No recorded funds or monthly goals yet.'}
          </p>
        )}
      </div>
      <div className="chart-footnote">
        <span data-testid="chart-visible-range">
          {visibleFrom && visibleTo
            ? `${dateLabel(visibleFrom)} – ${dateLabel(visibleTo)}`
            : '—'}
        </span>
        <small>
          <a
            href="https://www.tradingview.com/"
            target="_blank"
            rel="noreferrer"
          >
            TradingView Lightweight Charts™
          </a>{' '}
          © 2025 TradingView, Inc.
        </small>
      </div>
      <details className="advanced-options chart-advanced">
        <summary>Advanced options</summary>
        <div className="advanced-fields">
          <div className="input-row">
            <label>
              From
              <input
                aria-label="Chart from date"
                type="date"
                min="2000-01-01"
                max="2100-12-31"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              To
              <input
                aria-label="Chart to date"
                type="date"
                min="2000-01-01"
                max="2100-12-31"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
          {metric === 'expenses' && (
            <label>
              Category
              <select
                aria-label="Chart category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          <label className="chart-grid-option">
            <input
              type="checkbox"
              aria-label="Show chart grid"
              checked={grid}
              onChange={(e) => setGrid(e.target.checked)}
            />
            Show grid
          </label>
          <button
            className="text-button"
            onClick={() => {
              setFrom(historyStart(household, today));
              setTo(today);
              setCategory('');
            }}
          >
            Reset date range &amp; filters
          </button>
          <div className="chart-scale-controls">
            <output data-testid="chart-value-range">
              {valueRange
                ? `Value axis: ${formatMoney(Math.round(valueRange.from * 100))} – ${formatMoney(Math.round(valueRange.to * 100))}`
                : 'Value axis: Auto'}
            </output>
            <button
              className="text-button"
              onClick={() => {
                chartRef.current?.priceScale('right').setAutoScale(true);
                requestAnimationFrame(refreshValueRange);
              }}
            >
              Reset value scale
            </button>
          </div>
          <p className="muted">
            Drag horizontally to pan; pinch or scroll to zoom. Hold to inspect a
            value. Drag up or down on the right value axis to scale it; Reset
            value scale restores automatic fitting. Keyboard: arrows to pan, +/−
            to zoom, Home to fit. Expenses sum each interval; fund balances
            carry forward. Fund views compare available money, confirmed funding
            in the month ending each interval, and that month's goal. Spending
            and withdrawals reduce available funds without undoing a funding
            confirmation. Weekly intervals start Monday; partial intervals use
            only the selected dates.
          </p>
          <p className="muted">
            Contributions use their confirmation date within their planning
            month. Early or late confirmations are placed at that month’s
            nearest boundary. Reversals restate the original period. Fund
            balances are self-reported.
          </p>
          <details className="chart-values">
            <summary>Values</summary>
            <div className="chart-values-navigation">
              <button
                className="text-button"
                disabled={valuePage === 0}
                onClick={() => setValuePage((p) => p - 1)}
              >
                Newer
              </button>
              <span>
                {points.length ? valuePage * 30 + 1 : 0}–
                {Math.min(points.length, (valuePage + 1) * 30)} of{' '}
                {points.length}
              </span>
              <button
                className="text-button"
                disabled={(valuePage + 1) * 30 >= points.length}
                onClick={() => setValuePage((p) => p + 1)}
              >
                Older
              </button>
            </div>
            <div className="chart-value-table">
              <table>
                <caption>{METRICS[metric]} · EUR</caption>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>
                      {metric === 'expenses' ? 'Spending' : 'Closing balance'}
                    </th>
                    {metric !== 'expenses' && (
                      <>
                        <th>Funded this month</th>
                        <th>Monthly goal</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.time}>
                      <td>{pointLabel(p)}</td>
                      <td>{formatMoney(p.amountMinor)}</td>
                      {metric !== 'expenses' && (
                        <>
                          <td>{formatMoney(p.fundedMinor ?? 0)}</td>
                          <td>{formatMoney(p.targetMinor ?? 0)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <a
            className="muted"
            href={`${import.meta.env.BASE_URL}assets/lightweight-charts-LICENSE.txt`}
            target="_blank"
            rel="noreferrer"
          >
            Chart library license
          </a>
        </div>
      </details>
    </section>
  );
}
