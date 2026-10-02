import { centsToEuroInput, parseCoordinate, parseEuroToCents, parsePositiveInt } from './parse';

describe('standorte form parsers', () => {
  it('parses euro amounts to cents', () => {
    expect(parseEuroToCents('')).toBeNull();
    expect(parseEuroToCents('12,50')).toBe(1250);
    expect(parseEuroToCents('0.1')).toBe(10);
    expect(parseEuroToCents('19.99')).toBe(1999);
    expect(parseEuroToCents('1,234')).toBeNaN();
    expect(parseEuroToCents('-5')).toBeNaN();
    expect(centsToEuroInput(1999)).toBe('19,99');
    expect(centsToEuroInput(null)).toBe('');
  });

  it('parses positive integers', () => {
    expect(parsePositiveInt(' ')).toBeNull();
    expect(parsePositiveInt('30')).toBe(30);
    expect(parsePositiveInt('0')).toBeNaN();
    expect(parsePositiveInt('1.5')).toBeNaN();
  });

  it('parses coordinates within range', () => {
    expect(parseCoordinate('52,52', 90)).toBe(52.52);
    expect(parseCoordinate('-13.4', 180)).toBe(-13.4);
    expect(parseCoordinate('91', 90)).toBeNaN();
    expect(parseCoordinate('abc', 180)).toBeNaN();
  });
});
