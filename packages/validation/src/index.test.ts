import { describe, expect, it } from 'vitest';

import { parseBusinessDate, parsePositiveCent } from './index';

describe('parsePositiveCent', () => {
  it('accepts one cent and safe integer values', () => {
    expect(parsePositiveCent(1)).toBe(1);
    expect(parsePositiveCent(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, '100'])('rejects %j', (value) => {
    expect(() => parsePositiveCent(value)).toThrow();
  });
});

describe('parseBusinessDate', () => {
  it('accepts real calendar dates including leap day', () => {
    expect(parseBusinessDate('2028-02-29')).toBe('2028-02-29');
  });

  it.each(['2027-02-29', '2026-13-01', '2026-7-1', 'not-a-date'])('rejects %s', (value) => {
    expect(() => parseBusinessDate(value)).toThrow();
  });
});
