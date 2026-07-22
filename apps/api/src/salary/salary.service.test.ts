import { SalaryItemType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { SalaryRepository } from './salary.repository';
import {
  calculateSalaryTotals,
  nextExpectedSalaryDate,
  parseSalaryPaidDate,
  previousSalaryMonth,
  salaryBalancePeriod,
  salaryPaymentRequestHash,
  SalaryService,
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

describe('salary statistics rules (BR-SALARY-021 to BR-SALARY-023)', () => {
  it('clamps the next payday for short months and crosses years', () => {
    expect(nextExpectedSalaryDate(new Date('2026-01-31T00:00:00Z'), 31)).toEqual(
      new Date('2026-02-28T00:00:00Z'),
    );
    expect(nextExpectedSalaryDate(new Date('2028-01-31T00:00:00Z'), 31)).toEqual(
      new Date('2028-02-29T00:00:00Z'),
    );
    expect(nextExpectedSalaryDate(new Date('2026-12-12T00:00:00Z'), 10)).toEqual(
      new Date('2027-01-10T00:00:00Z'),
    );
  });

  it('never returns negative remaining days for an expired salary period', () => {
    expect(
      salaryBalancePeriod(new Date('2026-07-12T00:00:00Z'), 12, new Date('2026-08-13T00:00:00Z')),
    ).toMatchObject({
      nextPayDate: new Date('2026-08-12T00:00:00Z'),
      periodEndDate: new Date('2026-08-11T00:00:00Z'),
      remainingDays: 0,
    });
  });

  it('returns complete annual totals and uses recorded months for the net average', async () => {
    const records = [
      {
        id: 'record-1',
        profileId: 'profile-1',
        salaryMonth: new Date('2026-01-01T00:00:00Z'),
        grossCent: 1_200_000n,
        deductionCent: 200_000n,
        netCent: 1_000_000n,
        items: [
          { itemType: 'EARNING', itemCode: 'bonus', amountCent: 100_000n },
          { itemType: 'DEDUCTION', itemCode: 'income_tax', amountCent: 80_000n },
        ],
      },
      {
        id: 'record-2',
        profileId: 'profile-1',
        salaryMonth: new Date('2026-03-01T00:00:00Z'),
        grossCent: 1_400_000n,
        deductionCent: 250_000n,
        netCent: 1_150_000n,
        items: [
          { itemType: 'DEDUCTION', itemCode: 'pension_insurance', amountCent: 90_000n },
          { itemType: 'DEDUCTION', itemCode: 'medical_insurance', amountCent: 20_000n },
        ],
      },
    ];
    const repository = {
      transaction: vi.fn(async (work: (tx: object) => Promise<unknown>) => work({})),
      findActor: vi.fn(async () => ({ id: 'user-1', status: 'ACTIVE', timezone: 'Asia/Shanghai' })),
      listAnnualRecords: vi.fn(async () => records),
    };
    const service = new SalaryService(repository as unknown as SalaryRepository);
    const result = (await service.getAnnualSummary('user-1', 2026)) as Record<string, unknown> & {
      items: Array<Record<string, unknown>>;
    };

    expect(result).toMatchObject({
      year: 2026,
      recordCount: 2,
      recordedMonthCount: 2,
      grossCent: 2_600_000,
      deductionCent: 450_000,
      netCent: 2_150_000,
      averageMonthlyNetCent: 1_075_000,
      bonusCent: 100_000,
      pensionInsuranceCent: 90_000,
      medicalInsuranceCent: 20_000,
      incomeTaxCent: 80_000,
      officialBalanceDisclaimer: true,
    });
    expect(result.items).toHaveLength(12);
    expect(result.items[0]).toMatchObject({ month: '2026-01', netCent: 1_000_000 });
    expect(result.items[1]).toMatchObject({ month: '2026-02', netCent: 0 });
    expect(result.items[2]).toMatchObject({ month: '2026-03', netCent: 1_150_000 });
  });

  it('splits recurring and daily personal expenses and suppresses division by zero', async () => {
    const repository = {
      transaction: vi.fn(async (work: (tx: object) => Promise<unknown>) => work({})),
      findActor: vi.fn(async () => ({ id: 'user-1', status: 'ACTIVE', timezone: 'Asia/Shanghai' })),
      findCurrentPaidRecord: vi.fn(async () => ({
        id: 'record-1',
        profileId: 'profile-1',
        salaryMonth: new Date('2026-07-01T00:00:00Z'),
        paidDate: new Date('2026-07-12T00:00:00Z'),
        netCent: 100_000n,
        profile: { payDay: 12 },
      })),
      findPersonalLedger: vi.fn(async () => ({ id: 'ledger-1' })),
      salaryCycleExpenses: vi.fn(async () => [
        { sourceType: 'RECURRING_RUN', _sum: { amountCent: 30_000n } },
        { sourceType: 'MANUAL', _sum: { amountCent: 80_000n } },
      ]),
    };
    const service = new SalaryService(repository as unknown as SalaryRepository);

    await expect(service.getBalance('user-1', new Date('2026-08-13T00:00:00Z'))).resolves.toEqual(
      expect.objectContaining({
        available: true,
        fixedExpenseCent: 30_000,
        dailyExpenseCent: 80_000,
        totalExpenseCent: 110_000,
        remainingCent: -10_000,
        remainingDays: 0,
        dailyAvailableCent: null,
      }),
    );
  });

  it('returns an explicit empty balance state when there is no eligible paid salary', async () => {
    const repository = {
      transaction: vi.fn(async (work: (tx: object) => Promise<unknown>) => work({})),
      findActor: vi.fn(async () => ({ id: 'user-1', status: 'ACTIVE', timezone: 'Asia/Shanghai' })),
      findCurrentPaidRecord: vi.fn(async () => null),
    };
    const service = new SalaryService(repository as unknown as SalaryRepository);
    await expect(service.getBalance('user-1', new Date('2026-07-22T00:00:00Z'))).resolves.toEqual(
      expect.objectContaining({ available: false, salaryRecordId: null, dailyAvailableCent: null }),
    );
  });
});
