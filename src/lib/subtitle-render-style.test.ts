import { DEFAULT_GLOBAL_SETTINGS, TrackStyle } from '@/types/subtitle';
import {
  assFontName,
  getTrackMetrics,
  getTrackPreviewCss,
  isTrackShown,
  previewFontFamily,
  resolveProjectStyles,
  scaleTrackMetrics,
} from './subtitle-render-style';

const style = (overrides: Partial<TrackStyle> = {}): TrackStyle => ({
  ...DEFAULT_GLOBAL_SETTINGS.defaultPrimaryStyle,
  ...overrides,
});

describe('resolveProjectStyles', () => {
  test('layers built-in defaults, Global Settings and project overrides', () => {
    const styles = resolveProjectStyles(
      { primary: { fontSize: 3 } },
      { defaultPrimaryStyle: { ...DEFAULT_GLOBAL_SETTINGS.defaultPrimaryStyle, color: '#ff0000', fontSize: 6 } },
    );
    expect(styles.primary.color).toBe('#ff0000');  // from Global Settings
    expect(styles.primary.fontSize).toBe(3);         // project wins
    expect(styles.secondary).toEqual(DEFAULT_GLOBAL_SETTINGS.defaultSecondaryStyle);
  });

  test('a cleared ("Inherit") override keeps the inherited value', () => {
    const styles = resolveProjectStyles({ primary: { fontSize: undefined, color: undefined } }, null);
    expect(styles.primary.fontSize).toBe(DEFAULT_GLOBAL_SETTINGS.defaultPrimaryStyle.fontSize);
    expect(styles.primary.color).toBe(DEFAULT_GLOBAL_SETTINGS.defaultPrimaryStyle.color);
  });

  test('fills fields missing from older saved global styles', () => {
    const styles = resolveProjectStyles({}, { defaultSecondaryStyle: { color: '#00ff00' } });
    expect(styles.secondary.color).toBe('#00ff00');
    expect(styles.secondary.outlineColor).toBe('#000000');
  });
});

describe('isTrackShown', () => {
  test('shown unless switched off', () => {
    expect(isTrackShown({}, 'primary', style())).toBe(true);
    expect(isTrackShown({ showPrimary: true }, 'primary', style())).toBe(true);
    expect(isTrackShown({ showPrimary: false }, 'primary', style())).toBe(false);
    expect(isTrackShown({ showPrimary: false }, 'secondary', style())).toBe(true);
    expect(isTrackShown({ showSecondary: false }, 'secondary', style())).toBe(false);
  });

  test('font size 0 hides a track (how it was hidden before the switch existed)', () => {
    expect(isTrackShown({}, 'primary', style({ fontSize: 0 }))).toBe(false);
    expect(isTrackShown({}, 'primary', style({ fontSize: '0%' as unknown as number }))).toBe(false);
  });
});

describe('fonts', () => {
  test('libass gets one font name, with Arial swapped for Noto Sans', () => {
    expect(assFontName('Arial')).toBe('Noto Sans');
    expect(assFontName('')).toBe('Noto Sans');
    expect(assFontName('Georgia, serif')).toBe('Georgia');
    expect(assFontName('"Courier New", monospace')).toBe('Courier New');
  });

  test('the preview asks for the export font first', () => {
    expect(previewFontFamily('Arial')).toBe('"Noto Sans", "Arial", sans-serif');
    expect(previewFontFamily('Georgia, serif')).toBe('"Georgia", serif, sans-serif');
    // The server has no Georgia and draws Noto Sans instead
    expect(previewFontFamily('Georgia', 'Noto Sans')).toBe('"Noto Sans", "Georgia", sans-serif');
  });
});

describe('getTrackMetrics', () => {
  test('sizes are percentages of the video, with the font doubled', () => {
    const m = getTrackMetrics(style({ fontSize: 5, marginV: 4, marginH: 4, outlineWidth: 0.2 }), 1920, 1080);
    expect(m.fontSize).toBeCloseTo(108);
    expect(m.marginV).toBeCloseTo(43.2);
    expect(m.marginH).toBeCloseTo(76.8);
    expect(m.outline).toBeCloseTo(2.16);
  });

  test('vertical video scales by height, horizontal margin by width', () => {
    const m = getTrackMetrics(style({ fontSize: 5, marginH: 4 }), 1080, 1920);
    expect(m.fontSize).toBeCloseTo(192);
    expect(m.marginH).toBeCloseTo(43.2);
  });

  test('caps the outline at 20 px', () => {
    expect(getTrackMetrics(style({ outlineWidth: 10 }), 1920, 1080).outline).toBe(20);
  });

  test('no box for empty, none, transparent or zero-alpha backgrounds', () => {
    for (const backgroundColor of ['', 'none', 'transparent', 'rgba(0,0,0,0)', 'nonsense']) {
      const m = getTrackMetrics(style({ backgroundColor }), 1920, 1080);
      expect(m.boxColor).toBeNull();
      expect(m.boxPadding).toBe(0);
    }
  });

  test('a box is padded by a tenth of the line height, and at least the outline', () => {
    const m = getTrackMetrics(style({ fontSize: 5, backgroundColor: 'rgba(0,0,0,0.7)' }), 1920, 1080);
    expect(m.boxColor).toEqual({ r: 0, g: 0, b: 0, a: 0.7 });
    expect(m.boxPadding).toBeCloseTo(10.8);
    const thick = getTrackMetrics(style({ fontSize: 1, outlineWidth: 1.5, backgroundColor: '#000' }), 1920, 1080);
    expect(thick.boxPadding).toBeCloseTo(thick.outline);
  });

  test('colours fall back to white text and a black outline', () => {
    const m = getTrackMetrics(style({ color: 'bogus', outlineColor: undefined }), 1920, 1080);
    expect(m.textColor).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(m.outlineColor).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});

describe('getTrackPreviewCss', () => {
  const metrics = (overrides: Partial<TrackStyle>) =>
    scaleTrackMetrics(getTrackMetrics(style(overrides), 1920, 1080), 0.5); // a 960×540 preview

  test('font em size comes from the line height and the export font ratio', () => {
    const { text } = getTrackPreviewCss(metrics({ fontSize: 5 }), { family: 'Liberation Sans', lineRatio: 1.35 });
    expect(text.lineHeight).toBe('54px');
    expect(parseFloat(String(text.fontSize))).toBeCloseTo(40);
    expect(text.fontFamily).toBe('"Liberation Sans", "Noto Sans", "Arial", sans-serif');
    // Defaults to Noto Sans, whose line is 1.519 em
    expect(parseFloat(String(getTrackPreviewCss(metrics({ fontSize: 5 })).text.fontSize))).toBeCloseTo(54 / 1.519);
  });

  test('positions by alignment and margins', () => {
    const top = getTrackPreviewCss(metrics({ alignment: 7, marginV: 4, marginH: 4 }));
    expect(top.wrapper.alignItems).toBe('flex-start');
    expect(top.wrapper.justifyContent).toBe('flex-start');
    expect(top.wrapper.padding).toBe('21.6px 38.4px');
    expect(top.text.textAlign).toBe('left');
    const bottomRight = getTrackPreviewCss(metrics({ alignment: 3 }));
    expect(bottomRight.wrapper.alignItems).toBe('flex-end');
    expect(bottomRight.wrapper.justifyContent).toBe('flex-end');
  });

  test('draws the box outward from the text, and the outline outside the glyphs', () => {
    const { text } = getTrackPreviewCss(metrics({ fontSize: 5, outlineWidth: 0.2, outlineColor: '#ff0000', backgroundColor: 'rgba(0,0,0,0.5)' }));
    expect(text.backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
    expect(text.padding).toBe('5.4px');
    expect(text.margin).toBe('-5.4px');
    expect(text.WebkitTextStroke).toBe('2.16px rgba(255, 0, 0, 1)');
    expect(text.paintOrder).toBe('stroke fill');
  });

  test('no box and no stroke when neither is set', () => {
    const { text } = getTrackPreviewCss(metrics({ outlineWidth: 0, backgroundColor: 'transparent' }));
    expect(text.backgroundColor).toBeUndefined();
    expect(text.WebkitTextStroke).toBeUndefined();
  });
});
