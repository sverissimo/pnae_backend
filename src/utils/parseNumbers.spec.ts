import { parseNumbers } from './parseNumbers';

describe('parseNumbers', () => {
  test('handles thousands separator (1.000)', () => {
    expect(parseNumbers('1.000')).toEqual(String(1000));
  });

  test('handles decimal comma (1000,00)', () => {
    expect(parseNumbers('1000,00')).toEqual(String(1000));
  });

  test('handles decimal comma (1000,51)', () => {
    expect(parseNumbers('1000,51')).toEqual(String(1001));
  });

  test('handles no separators (1000)', () => {
    expect(parseNumbers('1000')).toEqual(String(1000));
  });

  test('handles thousands separator and decimal comma (1.000,49)', () => {
    expect(parseNumbers('1.000,49')).toEqual(String(1000));
  });
});
