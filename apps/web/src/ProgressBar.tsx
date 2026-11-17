import { createContext, useContext, type CSSProperties } from 'react';
import { DEFAULT_APPEARANCE, type ColorStops } from './appearance';

export const AppearanceContext = createContext(DEFAULT_APPEARANCE);
export function ProgressBar({
  label,
  value,
  variant = 'operating',
  chartIndex,
  valueText,
}: {
  label: string;
  value: number;
  variant?: 'operating' | 'savings';
  chartIndex?: number;
  valueText?: string;
}) {
  const preferences = useContext(AppearanceContext);
  const percent = Math.max(
    0,
    Math.min(100, Number.isFinite(value) ? value : 0),
  );
  const chartColor =
    chartIndex === undefined
      ? null
      : preferences.chartColors[chartIndex % preferences.chartColors.length];
  const stops: ColorStops = chartColor
    ? [chartColor, chartColor, chartColor]
    : preferences[variant];
  const style = {
    '--stop-1': stops[0],
    '--stop-2': stops[1],
    '--stop-3': stops[2],
  } as CSSProperties;
  return (
    <div
      className={`color-bar effect-${preferences.effect}`}
      style={style}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-valuetext={valueText ?? `${Math.round(percent)}%`}
    >
      {percent > 0 && (
        <span className="bar-fill" style={{ width: `${percent}%` }} />
      )}
    </div>
  );
}
