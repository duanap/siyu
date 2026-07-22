import { SalaryItemType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { calculateSalaryTotals, previousSalaryMonth } from './salary.service';

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
