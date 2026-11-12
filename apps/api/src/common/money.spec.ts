import { formatPaise, parsePaise } from './money';

describe('money', () => {
  it('formats indian grouping', () => {
    expect(formatPaise(12500050n, 'INR')).toBe('₹1,25,000.50');
  });

  it('parses decimals to paise', () => {
    expect(parsePaise('1234.5')).toBe(123450n);
  });
});
