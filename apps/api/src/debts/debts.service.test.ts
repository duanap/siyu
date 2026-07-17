import { describe, expect, it } from 'vitest';

import {
  businessToday,
  debtOverdueDays,
  debtTransactionEntryType,
  deriveDebtStatus,
} from './debts.service';

describe('debt domain rules', () => {
  const today = new Date('2026-07-16T00:00:00.000Z');

  it('implements BR-DEBT-005 and BR-DEBT-006 status rules', () => {
    expect(deriveDebtStatus(0n, new Date('2026-07-01T00:00:00.000Z'), today)).toBe('SETTLED');
    expect(deriveDebtStatus(1n, new Date('2026-07-15T00:00:00.000Z'), today)).toBe('OVERDUE');
    expect(deriveDebtStatus(1n, new Date('2026-07-16T00:00:00.000Z'), today)).toBe('ACTIVE');
    expect(deriveDebtStatus(1n, null, today)).toBe('ACTIVE');
  });

  it('returns overdue days only for an unsettled past due debt', () => {
    expect(debtOverdueDays(100n, new Date('2026-07-13T00:00:00.000Z'), today)).toBe(3);
    expect(debtOverdueDays(0n, new Date('2026-07-13T00:00:00.000Z'), today)).toBe(0);
    expect(debtOverdueDays(100n, null, today)).toBe(0);
  });

  it('maps repayment and collection to the correct personal Entry type', () => {
    expect(debtTransactionEntryType('BORROWED')).toBe('EXPENSE');
    expect(debtTransactionEntryType('LENT')).toBe('INCOME');
  });

  it('uses the actor timezone for the current business date', () => {
    const instant = new Date('2026-07-15T16:30:00.000Z');
    expect(businessToday('Asia/Shanghai', instant).toISOString()).toBe('2026-07-16T00:00:00.000Z');
    expect(businessToday('UTC', instant).toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });
});
