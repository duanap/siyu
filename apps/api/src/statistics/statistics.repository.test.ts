import { describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../database/prisma.service';
import { StatisticsRepository } from './statistics.repository';

describe('StatisticsRepository', () => {
  it('always scopes aggregates to one ledger, business-date range and non-deleted entries', async () => {
    const groupBy = vi.fn().mockResolvedValue([]);
    const repository = new StatisticsRepository({} as PrismaService);
    const startDate = new Date('2026-07-01T00:00:00.000Z');
    const endDate = new Date('2026-08-01T00:00:00.000Z');

    await repository.overview({ entry: { groupBy } } as never, 'ledger-id', startDate, endDate);

    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ledgerId: 'ledger-id',
          deletedAt: null,
          businessDate: { gte: startDate, lt: endDate },
        },
      }),
    );
  });

  it('requires an active membership on an active non-deleted ledger', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new StatisticsRepository({} as PrismaService);

    await repository.findLedgerContext({ ledger: { findFirst } } as never, 'user-id', 'ledger-id');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'ledger-id',
          status: 'ACTIVE',
          deletedAt: null,
          members: { some: { userId: 'user-id', status: 'ACTIVE' } },
        },
      }),
    );
  });
});
