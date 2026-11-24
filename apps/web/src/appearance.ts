import { useCallback, useEffect, useState } from 'react';

export type BarEffect = 'halo' | 'prism' | 'flare' | 'pixel' | 'solid';
export type ColorStops = [string, string, string];
export interface PaletteColors {
  accent: string;
  operating: ColorStops;
  savings: ColorStops;
  chartColors: string[];
}
interface Surfaces {
  page: string;
  panel: string;
  input: string;
  text: string;
  muted: string;
  border: string;
  soft: string;
}
interface Palette extends PaletteColors {
  id: string;
  name: string;
  description: string;
  dark: Surfaces;
  light: Surfaces;
}
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
  customPalette: PaletteColors | null;
}
const KEY = 'family-appearance-v1';
export const EFFECTS: { id: BarEffect; name: string }[] = [
  { id: 'halo', name: 'Electric halo' },
  { id: 'prism', name: 'Liquid prism' },
  { id: 'flare', name: 'Solar flare' },
  { id: 'pixel', name: 'Pixel rush' },
  { id: 'solid', name: 'Solid' },
];
const darkSurfaces: Surfaces = {
  page: '#090d14',
  panel: '#121923',
  input: '#0c121b',
  text: '#edf3f8',
  muted: '#a3b2c4',
  border: '#2b3849',
  soft: '#1c2939',
};
const lightSurfaces: Surfaces = {
  page: '#f2f5f8',
  panel: '#ffffff',
  input: '#f6f8fa',
  text: '#172536',
  muted: '#53667c',
  border: '#cbd5df',
  soft: '#e5ecf3',
};
export const PALETTES: Palette[] = [
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Electric yellow · ice cyan',
    accent: '#f3ed62',
    operating: ['#139aaa', '#61e8ed', '#b5ffff'],
    savings: ['#a9b735', '#e8eb65', '#fcf5b0'],
    chartColors: [
      '#61e8ed',
      '#f3ed62',
      '#fd8bb3',
      '#a6a0ff',
      '#73d9ad',
      '#e5ab75',
    ],
    dark: darkSurfaces,
    light: lightSurfaces,
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    description: 'Hot pink · ultraviolet',
    accent: '#ff8ada',
    operating: ['#634bce', '#ac9cff', '#d6ceff'],
    savings: ['#b93a95', '#ff8ada', '#ffc2ec'],
    chartColors: [
      '#ff8ada',
      '#ac9cff',
      '#73def1',
      '#f4c87d',
      '#8eddb8',
      '#cf9cff',
    ],
    dark: {
      ...darkSurfaces,
      page: '#100b1c',
      panel: '#1b142b',
      input: '#130e21',
      border: '#40304f',
      soft: '#2c203e',
    },
    light: {
      ...lightSurfaces,
      page: '#f8f2fa',
      input: '#fcf7fe',
      border: '#dfcfe5',
      soft: '#f1e4f5',
    },
  },
  {
    id: 'replicant',
    name: 'Replicant',
    description: 'Desert amber · rain teal',
    accent: '#ffbd80',
    operating: ['#287e88', '#6dd6ce', '#b9f0e9'],
    savings: ['#bc6a36', '#ffbd80', '#ffe0ae'],
    chartColors: [
      '#ffbd80',
      '#6dd6ce',
      '#d3a5da',
      '#e5d687',
      '#95bbf2',
      '#eb91a0',
    ],
    dark: {
      ...darkSurfaces,
      page: '#130e0c',
      panel: '#211a16',
      input: '#17110e',
      border: '#483a30',
      soft: '#33271f',
    },
    light: {
      ...lightSurfaces,
      page: '#faf4ed',
      input: '#fdf8f2',
      border: '#dfd0bf',
      soft: '#f2e7d9',
    },
  },
  {
    id: 'noir',
    name: 'Neon Noir',
    description: 'Jade neon · signal coral',
    accent: '#8ce6bd',
    operating: ['#278967', '#8ce6bd', '#c5f5df'],
    savings: ['#b54d63', '#ff9dba', '#ffd1df'],
    chartColors: [
      '#8ce6bd',
      '#ff9dba',
      '#86bcef',
      '#dec38c',
      '#baabeb',
      '#7cdbd8',
    ],
    dark: {
      ...darkSurfaces,
      page: '#090f10',
      panel: '#121e20',
      input: '#0c1618',
      border: '#2d4143',
      soft: '#203234',
    },
    light: {
      ...lightSurfaces,
      page: '#eff7f4',
      input: '#f4faf7',
      border: '#c6dcd4',
      soft: '#e0eee8',
    },
  },
];
export const DEFAULT_APPEARANCE: Appearance = {
  version: 1,
  theme: 'dark',
  effect: 'halo',
  palette: 'cyberpunk',
  accent: PALETTES[0].accent,
  operating: [...PALETTES[0].operating] as ColorStops,
  savings: [...PALETTES[0].savings] as ColorStops,
  chartColors: [...PALETTES[0].chartColors],
  glow: 70,
  speed: 100,
  motion: true,
  customPalette: null,
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
  const colors = (value: Partial<PaletteColors>): PaletteColors => ({
    accent: isColor(value.accent) ? value.accent : DEFAULT_APPEARANCE.accent,
    operating: stops(value.operating, DEFAULT_APPEARANCE.operating),
    savings: stops(value.savings, DEFAULT_APPEARANCE.savings),
    chartColors:
      Array.isArray(value.chartColors) &&
      value.chartColors.length === 6 &&
      value.chartColors.every(isColor)
        ? [...value.chartColors]
        : [...DEFAULT_APPEARANCE.chartColors],
  });
  const preset = PALETTES.find((p) => p.id === raw.palette);
  // Earlier palettes become Custom so existing personal colors survive the update.
  const legacy = ['jml', 'halo', 'prism', 'flare', 'pixel'].includes(
    raw.palette ?? '',
  );
  const palette =
    preset?.id ??
    (raw.palette === 'custom' || legacy
      ? 'custom'
      : DEFAULT_APPEARANCE.palette);
  const selected = preset ?? (palette === 'custom' ? raw : PALETTES[0]);
  const currentColors = colors(selected);
  const storedCustom =
    raw.customPalette && typeof raw.customPalette === 'object'
      ? colors(raw.customPalette)
      : null;
  return {
    version: 1,
    theme: raw.theme === 'light' || raw.theme === 'system' ? raw.theme : 'dark',
    effect: EFFECTS.some((e) => e.id === raw.effect) ? raw.effect! : 'halo',
    palette,
    ...currentColors,
    customPalette:
      palette === 'custom' ? structuredClone(currentColors) : storedCustom,
    glow: bound(raw.glow, 0, 100, 70),
    speed: bound(raw.speed, 25, 200, 100),
    motion: typeof raw.motion === 'boolean' ? raw.motion : true,
  };
}
export function selectPalette(preferences: Appearance, id: string): Appearance {
  const preset = PALETTES.find((p) => p.id === id);
  if (!preset && id !== 'custom') return preferences;
  const customPalette =
    preferences.palette === 'custom'
      ? {
          accent: preferences.accent,
          operating: [...preferences.operating] as ColorStops,
          savings: [...preferences.savings] as ColorStops,
          chartColors: [...preferences.chartColors],
        }
      : preferences.customPalette;
  const colors = preset ?? customPalette ?? preferences;
  return decodeAppearance({
    ...preferences,
    palette: id,
    customPalette,
    accent: colors.accent,
    operating: colors.operating,
    savings: colors.savings,
    chartColors: colors.chartColors,
  });
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
      const surfaces = (PALETTES.find((p) => p.id === preferences.palette) ??
        PALETTES[0])[theme];
      for (const [name, color] of Object.entries(surfaces)) {
        root.style.setProperty(`--${name}`, color);
      }
      root.dataset.theme = theme;
      root.dataset.palette = preferences.palette;
      root.style.setProperty('--operating-color', preferences.operating[1]);
      root.style.setProperty('--savings-color', preferences.savings[1]);
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
        ?.setAttribute('content', surfaces.page);
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
