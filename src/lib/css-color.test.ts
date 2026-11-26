import { parseCssColor, toAssColour, toCssColor, toHexColor } from './css-color';

describe('parseCssColor', () => {
  test('reads hex colours, short and long, with and without alpha', () => {
    expect(parseCssColor('#ff8000')).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    expect(parseCssColor('#F80')).toEqual({ r: 255, g: 136, b: 0, a: 1 });
    expect(parseCssColor('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 });
    expect(parseCssColor('#0008')).toEqual({ r: 0, g: 0, b: 0, a: 136 / 255 });
  });

  test('reads rgb() and rgba() with commas, spaces, slashes and percentages', () => {
    expect(parseCssColor('rgba(0,0,0,0.7)')).toEqual({ r: 0, g: 0, b: 0, a: 0.7 });
    expect(parseCssColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseCssColor('rgb(255 255 255 / 50%)')).toEqual({ r: 255, g: 255, b: 255, a: 0.5 });
    expect(parseCssColor('rgb(100%, 0%, 0%)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseCssColor(' RGBA(0,0,0,2) ')).toEqual({ r: 0, g: 0, b: 0, a: 1 }); // clamped
  });

  test('treats transparent and none as fully transparent', () => {
    expect(parseCssColor('transparent')?.a).toBe(0);
    expect(parseCssColor('none')?.a).toBe(0);
  });

  test('returns null for empty or unknown values', () => {
    expect(parseCssColor(undefined)).toBeNull();
    expect(parseCssColor('')).toBeNull();
    expect(parseCssColor('chartreuse')).toBeNull();
    expect(parseCssColor('#12345')).toBeNull();
    expect(parseCssColor('rgba(1,2)')).toBeNull();
    expect(parseCssColor('rgb(a,b,c)')).toBeNull();
  });
});

describe('colour output', () => {
  test('ASS colours are &HAABBGGRR with AA as transparency', () => {
    expect(toAssColour({ r: 255, g: 0, b: 0, a: 1 })).toBe('&H000000FF');
    expect(toAssColour({ r: 0x12, g: 0x34, b: 0x56, a: 1 })).toBe('&H00563412');
    expect(toAssColour({ r: 0, g: 0, b: 0, a: 0.7 })).toBe('&H4D000000');
    expect(toAssColour({ r: 0, g: 0, b: 0, a: 0 })).toBe('&HFF000000');
  });

  test('CSS and hex output', () => {
    expect(toCssColor({ r: 0, g: 0, b: 0, a: 0.7 })).toBe('rgba(0, 0, 0, 0.7)');
    expect(toHexColor({ r: 255, g: 128, b: 0, a: 0.3 })).toBe('#ff8000');
  });
});
