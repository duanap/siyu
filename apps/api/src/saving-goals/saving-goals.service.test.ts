import { describe, expect, it } from 'vitest';

import {
  savingContributionCreateRequestHash,
  savingGoalCreateRequestHash,
  savingGoalStatus,
  savingProgressBasisPoints,
} from './saving-goals.service';

describe('saving goal domain helpers', () => {
  it('implements BR-SAVING-004 and BR-SAVING-008 reversible completion', () => {
    expect(savingGoalStatus(9_999n, 10_000n)).toBe('ACTIVE');
    expect(savingGoalStatus(10_000n, 10_000n)).toBe('COMPLETED');
    expect(savingGoalStatus(12_000n, 10_000n)).toBe('COMPLETED');
    expect(savingGoalStatus(8_000n, 10_000n)).toBe('ACTIVE');
  });

  it('returns capped integer basis points without floating point arithmetic', () => {
    expect(savingProgressBasisPoints(0n, 3n)).toBe(0);
    expect(savingProgressBasisPoints(1n, 3n)).toBe(3_333);
    expect(savingProgressBasisPoints(3n, 3n)).toBe(10_000);
    expect(savingProgressBasisPoints(5n, 3n)).toBe(10_000);
  });

  it('hashes the complete canonical goal creation payload for BR-SAVING-010', () => {
    const input = {
      ledgerId: '40000000-0000-4000-8000-000000000001',
      name: '旅行基金',
      targetCent: 100_000,
      initialCent: 1_000,
      targetDate: '2026-12-31',
      coverUrl: null,
      note: '一起出发',
      idempotencyKey: 'saving-goal-test',
    };
    const first = savingGoalCreateRequestHash(input);
    expect(savingGoalCreateRequestHash({ ...input })).toBe(first);
    expect(savingGoalCreateRequestHash({ ...input, targetCent: 100_001 })).not.toBe(first);
    expect(savingGoalCreateRequestHash({ ...input, note: null })).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it('binds contribution idempotency to the goal and full creation payload', () => {
    const input = {
      amountCent: 5_000,
      businessDate: '2026-07-22',
      note: null,
      idempotencyKey: 'saving-contribution-test',
    };
    const first = savingContributionCreateRequestHash(
      '40000000-0000-4000-8000-000000000001',
      input,
    );
    expect(savingContributionCreateRequestHash('40000000-0000-4000-8000-000000000001', input)).toBe(
      first,
    );
    expect(
      savingContributionCreateRequestHash('40000000-0000-4000-8000-000000000002', input),
    ).not.toBe(first);
    expect(
      savingContributionCreateRequestHash('40000000-0000-4000-8000-000000000001', {
        ...input,
        amountCent: 5_001,
      }),
    ).not.toBe(first);
  });
});
