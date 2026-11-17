import { useState } from 'react';
import { EXPENSE_CATEGORIES } from '@family/domain';
import {
  DEFAULT_APPEARANCE,
  EFFECTS,
  PALETTES,
  type Appearance,
  type AppearanceController,
  type ColorStops,
} from './appearance';
import { ProgressBar } from './ProgressBar';

export function AppearancePanel({
  preferences,
  update,
  saved,
}: AppearanceController) {
  const [progress, setProgress] = useState(72);
  const change = (patch: Partial<Appearance>) =>
    update({ ...preferences, ...patch });
  function palette(id: string) {
    const selected = PALETTES.find((p) => p.id === id);
    if (selected)
      change({
        palette: id,
        accent: selected.accent,
        operating: [...selected.operating] as ColorStops,
        savings: [...selected.savings] as ColorStops,
        chartColors: [...selected.chartColors],
      });
  }
  return (
    <section className="panel appearance-panel" aria-label="Appearance">
      <details>
        <summary>
          <span>
            <strong>Appearance</strong>
            <small>
              {EFFECTS.find((e) => e.id === preferences.effect)?.name} ·{' '}
              {preferences.theme === 'system'
                ? 'Device theme'
                : `${preferences.theme[0].toUpperCase()}${preferences.theme.slice(1)}`}
            </small>
          </span>
          <span aria-hidden="true">⌄</span>
        </summary>
        <div className="appearance-content">
          <p className="muted">
            JML colors and Afterglow effects. Saved automatically on this
            device.
          </p>
          <div className="input-row">
            <label>
              Theme
              <select
                aria-label="Theme"
                value={preferences.theme}
                onChange={(e) =>
                  change({ theme: e.target.value as Appearance['theme'] })
                }
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">Use device setting</option>
              </select>
            </label>
            <label>
              Bar effect
              <select
                aria-label="Bar effect"
                value={preferences.effect}
                onChange={(e) =>
                  change({ effect: e.target.value as Appearance['effect'] })
                }
              >
                {EFFECTS.map((effect) => (
                  <option key={effect.id} value={effect.id}>
                    {effect.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="input-row">
            <label>
              Color palette
              <select
                aria-label="Color palette"
                value={preferences.palette}
                onChange={(e) => palette(e.target.value)}
              >
                {PALETTES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="custom" disabled>
                  Custom colors
                </option>
              </select>
            </label>
            <label className="color-control">
              Interface accent
              <input
                aria-label="Interface accent"
                type="color"
                value={preferences.accent}
                onChange={(e) =>
                  change({ accent: e.target.value, palette: 'custom' })
                }
              />
            </label>
          </div>
          <div className="appearance-ranges">
            <label>
              Glow intensity <output>{preferences.glow}%</output>
              <input
                aria-label="Glow intensity"
                type="range"
                min={0}
                max={100}
                value={preferences.glow}
                onChange={(e) => change({ glow: Number(e.target.value) })}
              />
            </label>
            <label>
              Animation speed{' '}
              <output>{(preferences.speed / 100).toFixed(2)}×</output>
              <input
                aria-label="Animation speed"
                type="range"
                min={25}
                max={200}
                value={preferences.speed}
                onChange={(e) => change({ speed: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="motion-control">
            <input
              type="checkbox"
              checked={preferences.motion}
              onChange={(e) => change({ motion: e.target.checked })}
            />
            Animate bars
          </label>
          <p className="muted">
            Your device’s reduced-motion setting always takes priority.
          </p>
          <details className="color-options">
            <summary>Customize bar colors</summary>
            {(['operating', 'savings'] as const).map((variant) => (
              <fieldset key={variant}>
                <legend>
                  {variant === 'operating'
                    ? 'Operating bars'
                    : 'Savings & goal bars'}
                </legend>
                <div className="color-stops">
                  {preferences[variant].map((color, i) => (
                    <label className="color-control" key={i}>
                      {['Start', 'Middle', 'End'][i]}
                      <input
                        type="color"
                        aria-label={`${variant === 'operating' ? 'Operating' : 'Savings'} ${['start', 'middle', 'end'][i]} color`}
                        value={color}
                        onChange={(e) => {
                          const colors = [
                            ...preferences[variant],
                          ] as ColorStops;
                          colors[i] = e.target.value;
                          change({ [variant]: colors, palette: 'custom' });
                        }}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </details>
          <details className="color-options">
            <summary>Customize chart colors</summary>
            <div className="chart-colors">
              {EXPENSE_CATEGORIES.map((category, i) => (
                <label className="color-control" key={category}>
                  {category}
                  <input
                    type="color"
                    aria-label={`${category} chart color`}
                    value={preferences.chartColors[i]}
                    onChange={(e) => {
                      const chartColors = [...preferences.chartColors];
                      chartColors[i] = e.target.value;
                      change({ chartColors, palette: 'custom' });
                    }}
                  />
                </label>
              ))}
            </div>
          </details>
          <div className="appearance-preview" aria-label="Appearance preview">
            <div className="section-heading">
              <h3>Preview</h3>
              <span className="subtle-label">Sample values only</span>
            </div>
            <label>
              Preview progress <output>{progress}%</output>
              <input
                type="range"
                aria-label="Preview progress"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
              />
            </label>
            <div className="preview-label">
              <span>Operating</span>
              <span>{progress}%</span>
            </div>
            <ProgressBar label="Operating preview" value={progress} />
            <div className="preview-label">
              <span>Savings / goal</span>
              <span>{progress}%</span>
            </div>
            <ProgressBar
              label="Savings preview"
              value={progress}
              variant="savings"
            />
            <div className="preview-chart" aria-label="Example category bars">
              {EXPENSE_CATEGORIES.map((category, i) => (
                <div key={category}>
                  <span>{category}</span>
                  <ProgressBar
                    label={`${category} preview`}
                    value={[82, 64, 48, 36, 57, 24][i]}
                    chartIndex={i}
                  />
                </div>
              ))}
            </div>
            <p className="muted">
              Appearance examples, not spending data. Goal tracking and spending
              reports will use these same bar styles.
            </p>
          </div>
          {!saved && (
            <p className="validation" role="alert">
              The browser could not save these preferences. They apply for this
              session.
            </p>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => update(structuredClone(DEFAULT_APPEARANCE))}
          >
            Reset appearance
          </button>
        </div>
      </details>
    </section>
  );
}
