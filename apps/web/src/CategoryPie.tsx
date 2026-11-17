import { useContext } from 'react';
import { EXPENSE_CATEGORIES } from '@family/domain';
import { AppearanceContext } from './ProgressBar';
import { formatMoney } from './SignedMoney';
export function CategoryPie({
  spending,
}: {
  spending: { category: string; amountMinor: number }[];
}) {
  const appearance = useContext(AppearanceContext);
  const total = spending.reduce((sum, row) => sum + row.amountMinor, 0);
  if (!total) return null;
  let accumulated = 0;
  const rows = spending.map((row) => {
    const start = -Math.PI / 2 + (accumulated / total) * 2 * Math.PI;
    accumulated += row.amountMinor;
    const end = -Math.PI / 2 + (accumulated / total) * 2 * Math.PI;
    const known = EXPENSE_CATEGORIES.indexOf(row.category);
    const index =
      known < 0
        ? [...row.category].reduce((sum, c) => sum + c.charCodeAt(0), 0)
        : known;
    const color = appearance.chartColors[index % appearance.chartColors.length];
    const percent = new Intl.NumberFormat('en-GB', {
      style: 'percent',
      maximumFractionDigits: 1,
    }).format(row.amountMinor / total);
    const path = `M 120 120 L ${120 + 100 * Math.cos(start)} ${120 + 100 * Math.sin(start)} A 100 100 0 ${end - start > Math.PI ? 1 : 0} 1 ${120 + 100 * Math.cos(end)} ${120 + 100 * Math.sin(end)} Z`;
    return { ...row, path, color, percent };
  });
  return (
    <figure className="category-pie">
      <svg
        viewBox="0 0 240 240"
        role="img"
        aria-label="Spending by category pie chart"
      >
        <desc>
          {rows
            .map(
              (row) =>
                `${row.category}: ${formatMoney(row.amountMinor)} (${row.percent})`,
            )
            .join('; ')}
        </desc>
        {rows.map((row) =>
          rows.length === 1 ? (
            <circle
              key={row.category}
              cx="120"
              cy="120"
              r="100"
              fill={row.color}
            >
              <title>
                {row.category}: {formatMoney(row.amountMinor)} · {row.percent}
              </title>
            </circle>
          ) : (
            <path
              key={row.category}
              d={row.path}
              fill={row.color}
              stroke="var(--panel)"
              strokeWidth="1.5"
            >
              <title>
                {row.category}: {formatMoney(row.amountMinor)} · {row.percent}
              </title>
            </path>
          ),
        )}
      </svg>
      <figcaption>
        <ul>
          {rows.map((row) => (
            <li key={row.category}>
              <span
                className="category-swatch"
                style={{ background: row.color }}
                aria-hidden="true"
              />
              <span className="pie-category">
                {row.category}
                <small>{row.percent}</small>
              </span>
              <strong>{formatMoney(row.amountMinor)}</strong>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
