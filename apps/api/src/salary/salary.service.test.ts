import { SalaryItemType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  calculateSalaryTotals,
  parseSalaryPaidDate,
  previousSalaryMonth,
  salaryPaymentRequestHash,
} from './salary.service';

describe('salary domain rules (BR-SALARY-015, BR-SALARY-017)', () => {
  it('derives gross, deductions, and net from item details', () => {
    expect(
      calculateSalaryTotals([
        { itemType: SalaryItemType.EARNING, amountCent: 1_200_000n },
        { itemType: SalaryItemType.EARNING, amountCent: 50_000n },
        { itemType: SalaryItemType.DEDUCTION, amountCent: 125_000n },
      ]),
    ).toEqual({ grossCent: 1_250_000n, deductionCent: 125_000n, netCent: 1_125_000n });
  });

  it('rejects a record without positive earnings', () => {
    expect(() =>
      calculateSalaryTotals([{ itemType: SalaryItemType.DEDUCTION, amountCent: 1n }]),
    ).toThrow('应发工资必须大于零');
  });

  it('rejects deductions greater than gross income', () => {
    expect(() =>
      calculateSalaryTotals([
        { itemType: SalaryItemType.EARNING, amountCent: 100n },
        { itemType: SalaryItemType.DEDUCTION, amountCent: 101n },
      ]),
    ).toThrow('个人扣除不能大于应发工资');
  });

  it('copies only from the exact adjacent calendar month across year boundaries', () => {
    expect(previousSalaryMonth(new Date('2026-01-01T00:00:00.000Z'))).toEqual(
      new Date('2025-12-01T00:00:00.000Z'),
    );
  });
});

describe('salary payment rules (BR-SALARY-019)', () => {
  it('accepts only real calendar business dates', () => {
    expect(parseSalaryPaidDate('2028-02-29')).toEqual(new Date('2028-02-29T00:00:00.000Z'));
    expect(() => parseSalaryPaidDate('2026-02-30')).toThrow('到账日期必须是有效业务日期');
  });

  it('binds the payment idempotency hash to record, date, and sync choice', () => {
    const base = {
      paidDate: '2026-07-12',
      syncEntry: true,
      idempotencyKey: 'salary-paid-key',
    };
    expect(salaryPaymentRequestHash('record-a', base)).toBe(
      salaryPaymentRequestHash('record-a', { ...base, idempotencyKey: 'another-key' }),
    );
    expect(salaryPaymentRequestHash('record-a', base)).not.toBe(
      salaryPaymentRequestHash('record-b', base),
    );
    expect(salaryPaymentRequestHash('record-a', base)).not.toBe(
      salaryPaymentRequestHash('record-a', { ...base, syncEntry: false }),
    );
  });
});
