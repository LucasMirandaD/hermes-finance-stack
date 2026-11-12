import { describe, it, expect } from 'vitest';
import { parseArgentineAmount } from './amount-parser.util';

describe('parseArgentineAmount', () => {
  it('handles numbers and Argentine shorthand suffixes cleanly', () => {
    expect(parseArgentineAmount(889000)).toBe(889000);
    expect(parseArgentineAmount('889 mil')).toBe(889000);
    expect(parseArgentineAmount('45k')).toBe(45000);
    expect(parseArgentineAmount('150 lucas')).toBe(150000);
    expect(parseArgentineAmount('1m')).toBe(1000000);
    expect(parseArgentineAmount('1.5m')).toBe(1500000);
    expect(parseArgentineAmount('1,5M')).toBe(1500000);
    expect(parseArgentineAmount('un millón')).toBe(1000000);
    expect(parseArgentineAmount('1 millon 500 mil')).toBe(1500000);
    expect(parseArgentineAmount('2 millones y medio')).toBe(2500000);
    expect(parseArgentineAmount('$ 89.000')).toBe(89000);
    expect(parseArgentineAmount('$147.060,50')).toBe(147060.5);
    expect(parseArgentineAmount(null)).toBe(0);
  });
});
