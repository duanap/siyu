import { describe, expect, it } from 'vitest';

import {
  nextOccurrenceAfter,
  nextOccurrenceOnOrAfter,
  occurrenceAt,
  parseBusinessDate,
} from './recurring.dates';

describe('recurring anchored dates (BR-RECUR-007, BR-RECUR-010, BR-RECUR-011)', () => {
  it('uses month end without drifting the original day anchor', () => {
    const start = parseBusinessDate('2026-01-31');
    expect(occurrenceAt(start, 'MONTHLY', 1, 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(occurrenceAt(start, 'MONTHLY', 1, 2).toISOString()).toBe('2026-03-31T00:00:00.000Z');
    expect(nextOccurrenceAfter(start, 'MONTHLY', 1, parseBusinessDate('2026-02-28'))).toEqual(
      parseBusinessDate('2026-03-31'),
    );
  });

  it('uses February month end for leap-day yearly rules and restores leap day', () => {
    const start = parseBusinessDate('2024-02-29');
    expect(occurrenceAt(start, 'YEARLY', 1, 1)).toEqual(parseBusinessDate('2025-02-28'));
    expect(occurrenceAt(start, 'YEARLY', 1, 4)).toEqual(parseBusinessDate('2028-02-29'));
  });

  it('finds the first anchored occurrence on or after the resume date', () => {
    const result = nextOccurrenceOnOrAfter(
      parseBusinessDate('2026-01-31'),
      'MONTHLY',
      2,
      parseBusinessDate('2026-08-01'),
    );
    expect(result.date).toEqual(parseBusinessDate('2026-09-30'));
    expect(result.index).toBe(4);
  });

  it('rejects impossible business dates instead of normalizing them', () => {
    expect(() => parseBusinessDate('2026-02-30')).toThrow('INVALID_BUSINESS_DATE');
  });
});
