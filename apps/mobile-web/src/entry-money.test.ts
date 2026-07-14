import { describe, expect, it } from 'vitest';
import {
  amountInputFromCent,
  formatAmount,
  normalizeAmountInput,
  parseAmountToCent,
} from './entry-money';

describe('entry money', () => {
  it.each([
    ['0.01', 1],
    ['0.10', 10],
    ['1', 100],
    ['1.2', 120],
    ['1.23', 123],
    ['90071992547409.91', Number.MAX_SAFE_INTEGER],
  ])('converts %s to exact integer cents', (value, expected) => {
    expect(parseAmountToCent(value)).toEqual(
      expect.objectContaining({ ok: true, amountCent: expected }),
    );
  });

  it.each(['', '0', '-1', '1e2', '1,000', '1.234', 'abc', '90071992547409.92'])(
    'rejects invalid amount %s',
    (value) => expect(parseAmountToCent(value).ok).toBe(false),
  );

  it('supports safe editing states and rejects pasted illegal characters', () => {
    expect(normalizeAmountInput('.5')).toBe('0.5');
    expect(normalizeAmountInput('1.')).toBe('1.');
    expect(normalizeAmountInput('1a')).toBeUndefined();
  });

  it('formats positive cents with semantic sign from entry type', () => {
    expect(formatAmount(12850, 'EXPENSE')).toBe('-¥ 128.50');
    expect(formatAmount(850000, 'INCOME')).toBe('+¥ 8,500.00');
    expect(amountInputFromCent(120)).toBe('1.20');
  });
});
