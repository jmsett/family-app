import { useCallback, useEffect, useState } from 'react';

export type BarEffect = 'halo' | 'prism' | 'flare' | 'pixel' | 'solid';
export type ColorStops = [string, string, string];
export interface Appearance {
  version: 1;
  theme: 'dark' | 'light' | 'system';
  effect: BarEffect;
  palette: string;
  accent: string;
  operating: ColorStops;
  savings: ColorStops;
  chartColors: string[];
  glow: number;
  speed: number;
  motion: boolean;
}
const KEY = 'family-appearance-v1';
export const EFFECTS: { id: BarEffect; name: string }[] = [
  { id: 'halo', name: 'Electric halo' },
  { id: 'prism', name: 'Liquid prism' },
  { id: 'flare', name: 'Solar flare' },
  { id: 'pixel', name: 'Pixel rush' },
  { id: 'solid', name: 'Solid' },
];
export const PALETTES = [
  {
    id: 'jml',
    name: 'JML multicolor',
    accent: '#b58aff',
    operating: ['#278aff', '#5df0ff', '#dcffff'],
    savings: ['#ffb546', '#ff2ca8', '#7149ff'],
    chartColors: [
      '#b58aff',
      '#ff57b5',
      '#37dbea',
      '#ffb546',
      '#74e4ad',
      '#829cff',
    ],
  },
  {
    id: 'halo',
    name: 'Electric halo',
    accent: '#78ecff',
    operating: ['#278aff', '#5df0ff', '#dcffff'],
    savings: ['#416bff', '#94aaff', '#e5edff'],
    chartColors: [
      '#278aff',
      '#5df0ff',
      '#94aaff',
      '#78c9ff',
      '#4adbb7',
      '#d1edff',
    ],
  },
  {
    id: 'prism',
    name: 'Liquid prism',
    accent: '#e5a1ff',
    operating: ['#69dffd', '#fd76eb', '#65f5cc'],
    savings: ['#847bff', '#f6cd7d', '#76a7ff'],
    chartColors: [
      '#69dffd',
      '#847bff',
      '#fd76eb',
      '#f6cd7d',
      '#65f5cc',
      '#76a7ff',
    ],
  },
  {
    id: 'flare',
    name: 'Solar flare',
    accent: '#ff9cbb',
    operating: ['#ed3e9b', '#ff6287', '#ffba75'],
    savings: ['#ffba75', '#ff6287', '#ed3e9b'],
    chartColors: [
      '#ed3e9b',
      '#ff6287',
      '#ffba75',
      '#db82f1',
      '#f196b5',
      '#f7d084',
    ],
  },
  {
    id: 'pixel',
    name: 'Pixel rush',
    accent: '#9bf4b5',
    operating: ['#62ffb6', '#a6ffe2', '#1d5248'],
    savings: ['#41cdac', '#9bf4b5', '#205e52'],
    chartColors: [
      '#62ffb6',
      '#a6ffe2',
      '#44bfa4',
      '#7dbed6',
      '#b6e89a',
      '#70dda5',
    ],
  },
];
export const DEFAULT_APPEARANCE: Appearance = {
  version: 1,
  theme: 'dark',
  effect: 'halo',
  palette: 'jml',
  accent: PALETTES[0].accent,
  operating: [...PALETTES[0].operating] as ColorStops,
  savings: [...PALETTES[0].savings] as ColorStops,
  chartColors: [...PALETTES[0].chartColors],
  glow: 70,
  speed: 100,
  motion: true,
};
export function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}
export function decodeAppearance(value: unknown): Appearance {
  const raw =
    value && typeof value === 'object' ? (value as Partial<Appearance>) : {};
  if (raw.version !== 1) return structuredClone(DEFAULT_APPEARANCE);
  const stops = (value: unknown, fallback: ColorStops): ColorStops =>
    Array.isArray(value) && value.length === 3 && value.every(isColor)
      ? ([...value] as ColorStops)
      : [...fallback];
  const bound = (
    value: unknown,
    low: number,
    high: number,
    fallback: number,
  ) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(low, Math.min(high, value))
      : fallback;
  return {
    version: 1,
    theme: raw.theme === 'light' || raw.theme === 'system' ? raw.theme : 'dark',
    effect: EFFECTS.some((e) => e.id === raw.effect) ? raw.effect! : 'halo',
    palette:
      PALETTES.some((p) => p.id === raw.palette) || raw.palette === 'custom'
        ? raw.palette!
        : 'jml',
    accent: isColor(raw.accent) ? raw.accent : DEFAULT_APPEARANCE.accent,
    operating: stops(raw.operating, DEFAULT_APPEARANCE.operating),
    savings: stops(raw.savings, DEFAULT_APPEARANCE.savings),
    chartColors:
      Array.isArray(raw.chartColors) &&
      raw.chartColors.length === 6 &&
      raw.chartColors.every(isColor)
        ? [...raw.chartColors]
        : [...DEFAULT_APPEARANCE.chartColors],
    glow: bound(raw.glow, 0, 100, 70),
    speed: bound(raw.speed, 25, 200, 100),
    motion: typeof raw.motion === 'boolean' ? raw.motion : true,
  };
}
function read(): Appearance {
  try {
    return decodeAppearance(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return structuredClone(DEFAULT_APPEARANCE);
  }
}
export function contrastInk(hex: string): string {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05
    ? '#ffffff'
    : '#080914';
}
export function useAppearance() {
  const [preferences, setPreferences] = useState(read);
  const [saved, setSaved] = useState(true);
  const update = useCallback((next: Appearance) => {
    const clean = decodeAppearance(next);
    setPreferences(clean);
    try {
      localStorage.setItem(KEY, JSON.stringify(clean));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme =
        preferences.theme === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : preferences.theme;
      const root = document.documentElement;
      root.dataset.theme = theme;
      root.dataset.motion = String(preferences.motion);
      root.style.setProperty('--accent', preferences.accent);
      root.style.setProperty('--accent-ink', contrastInk(preferences.accent));
      root.style.setProperty('--glow-opacity', String(preferences.glow / 100));
      root.style.setProperty('--glow-blur', `${7 + preferences.glow * 0.15}px`);
      root.style.setProperty(
        '--drift-speed',
        `${4.5 / (preferences.speed / 100)}s`,
      );
      root.style.setProperty(
        '--sweep-speed',
        `${3.1 / (preferences.speed / 100)}s`,
      );
      root.style.colorScheme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'dark' ? '#080914' : '#f7f5fb');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preferences]);
  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key === KEY) {
        setPreferences(read());
        setSaved(true);
      }
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, []);
  return { preferences, update, saved };
}
export type AppearanceController = ReturnType<typeof useAppearance>;
