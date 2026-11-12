import { xirr } from './xirr';

describe('xirr', () => {
  it('approximates ten percent over one year', () => {
    const rate = xirr([
      { date: '2024-01-01', amountPaise: -1000000n },
      { date: '2025-01-01', amountPaise: 1100000n },
    ]);
    expect(rate).not.toBeNull();
    expect(rate as number).toBeGreaterThan(0.09);
    expect(rate as number).toBeLessThan(0.11);
  });
});
