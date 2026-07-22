import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { RecurringRepository, type DueRuleCandidate } from './recurring.repository';
import { RecurringService } from './recurring.service';

function repositoryWith(candidates: DueRuleCandidate[]): RecurringRepository {
  return {
    transaction: vi.fn((work: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      work({} as Prisma.TransactionClient),
    ),
    listDueRuleCandidates: vi.fn().mockResolvedValue(candidates),
  } as unknown as RecurringRepository;
}

describe('recurring timezone scan (BR-DATE-002, BR-RECUR-004)', () => {
  it('uses each owner timezone instead of the server calendar date', async () => {
    const repository = repositoryWith([
      {
        id: 'due-kiritimati',
        nextRunDate: new Date('2026-07-22T00:00:00.000Z'),
        timezone: 'Pacific/Kiritimati',
      },
      {
        id: 'not-due-honolulu',
        nextRunDate: new Date('2026-07-22T00:00:00.000Z'),
        timezone: 'Pacific/Honolulu',
      },
    ]);
    const service = new RecurringService(repository);

    const result = await service.scanDueRules(new Date('2026-07-22T01:00:00.000Z'), {
      limit: 200,
    });

    expect(result.jobs).toEqual([{ ruleId: 'due-kiritimati', scheduledDate: '2026-07-22' }]);
    expect(result.candidateCount).toBe(2);
    expect(result.nextCursor).toBe('not-due-honolulu');
    expect(result.hasMore).toBe(false);
    expect(repository.listDueRuleCandidates).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ throughDate: new Date('2026-07-23T00:00:00.000Z') }),
    );
  });

  it('returns a cursor even when a full candidate page has no locally due rule', async () => {
    const repository = repositoryWith([
      {
        id: 'rule-a',
        nextRunDate: new Date('2026-07-22T00:00:00.000Z'),
        timezone: 'Pacific/Honolulu',
      },
    ]);
    const service = new RecurringService(repository);
    const result = await service.scanDueRules(new Date('2026-07-22T01:00:00.000Z'), {
      afterId: 'rule-before',
      limit: 1,
    });
    expect(result).toEqual({
      jobs: [],
      candidateCount: 1,
      nextCursor: 'rule-a',
      hasMore: true,
    });
  });
});
