import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  PALETTES,
  contrastInk,
  decodeAppearance,
  selectPalette,
} from './appearance';

describe('device appearance', () => {
  it('migrates previous palettes without losing personalized colors or effects', () => {
    for (const palette of [
      'jml',
      'halo',
      'prism',
      'flare',
      'pixel',
      'custom',
    ]) {
      const old = {
        ...DEFAULT_APPEARANCE,
        palette,
        accent: '#123456',
        savings: ['#112233', '#445566', '#778899'],
        effect: 'prism',
        theme: 'system',
        glow: 35,
        motion: false,
      };
      const migrated = decodeAppearance(old);
      expect(migrated).toMatchObject({
        palette: 'custom',
        accent: old.accent,
        savings: old.savings,
        effect: 'prism',
        theme: 'system',
        glow: 35,
        motion: false,
      });
      expect(migrated.customPalette?.accent).toBe(old.accent);
    }
  });

  it('restores a saved custom palette after multiple preset changes and a reload', () => {
    const custom = decodeAppearance({
      ...DEFAULT_APPEARANCE,
      palette: 'custom',
      accent: '#123456',
      chartColors: Array(6).fill('#abcdef'),
    });
    let appearance = custom;
    for (const preset of PALETTES) {
      appearance = selectPalette(appearance, preset.id);
      expect(appearance.accent).toBe(preset.accent);
      expect(appearance.operating).toEqual(preset.operating);
      expect(appearance.savings).toEqual(preset.savings);
      expect(appearance.chartColors).toEqual(preset.chartColors);
      appearance = decodeAppearance(JSON.parse(JSON.stringify(appearance)));
    }
    expect(selectPalette(appearance, 'custom')).toEqual(custom);
  });

  it('seeds the first custom palette from the currently selected preset', () => {
    const selected = selectPalette(DEFAULT_APPEARANCE, 'replicant');
    const custom = selectPalette(selected, 'custom');
    expect(custom.palette).toBe('custom');
    expect(custom.savings).toEqual(selected.savings);
    expect(custom.accent).toBe(selected.accent);
    custom.savings[0] = '#112233';
    expect(selected.savings[0]).toBe(PALETTES[2].savings[0]);
  });

  it('keeps curated colors fixed even if saved preset colors were changed', () => {
    const appearance = decodeAppearance({
      ...DEFAULT_APPEARANCE,
      palette: 'synthwave',
      accent: '#000000',
    });
    expect(appearance.accent).toBe(PALETTES[1].accent);
  });

  it('recovers invalid preferences and bounds animation settings', () => {
    expect(decodeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    expect(decodeAppearance({ version: 99 })).toEqual(DEFAULT_APPEARANCE);
    const appearance = decodeAppearance({
      version: 1,
      palette: 'custom',
      accent: 'invalid',
      operating: ['#112233'],
      chartColors: ['bad'],
      customPalette: [],
      glow: 900,
      speed: -20,
    });
    expect(appearance.accent).toBe(DEFAULT_APPEARANCE.accent);
    expect(appearance.operating).toEqual(DEFAULT_APPEARANCE.operating);
    expect(appearance.chartColors).toEqual(DEFAULT_APPEARANCE.chartColors);
    expect(appearance.glow).toBe(100);
    expect(appearance.speed).toBe(25);
    expect(selectPalette(appearance, 'unknown')).toBe(appearance);
  });

  it('uses legible button ink for bright and dark custom accents', () => {
    expect(contrastInk('#000000')).toBe('#ffffff');
    expect(contrastInk('#ffffff')).toBe('#080914');
    for (const preset of PALETTES) {
      expect(contrastInk(preset.accent)).toBe('#080914');
    }
  });
});
