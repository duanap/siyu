import { UnrecoverableError, type Job, type Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import {
  RECURRING_MATERIALIZE_JOB,
  RECURRING_SCAN_JOB,
  type RecurringWorkerConfig,
} from './recurring.jobs';
import { RecurringService } from './recurring.service';
import { createRecurringProcessor, type RecurringWorkerLog } from './recurring.worker';

const config: RecurringWorkerConfig = {
  scanIntervalMs: 60_000,
  scanBatchSize: 2,
  concurrency: 4,
  attempts: 5,
  backoffDelayMs: 250,
};
const now = new Date('2026-07-22T04:05:06.000Z');

function job(name: string, data: object, attemptsMade = 0): Job {
  return { id: `${name}-id`, name, data, attemptsMade } as Job;
}

describe('recurring BullMQ processor (AC-RECUR-004, AC-RECUR-007)', () => {
  it('pages a timezone-aware scan and enqueues stable materialization jobs', async () => {
    const scanDueRules = vi
      .fn()
      .mockResolvedValueOnce({
        jobs: [{ ruleId: 'rule-a', scheduledDate: '2026-07-22' }],
        candidateCount: 2,
        nextCursor: 'rule-b',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        jobs: [{ ruleId: 'rule-c', scheduledDate: '2026-07-21' }],
        candidateCount: 1,
        nextCursor: 'rule-c',
        hasMore: false,
      });
    const addBulk = vi.fn().mockResolvedValue([]);
    const getJobCounts = vi.fn().mockResolvedValue({
      wait: 2,
      active: 1,
      delayed: 0,
      failed: 0,
    });
    const logs: RecurringWorkerLog[] = [];
    const processor = createRecurringProcessor({
      recurring: { scanDueRules } as unknown as RecurringService,
      queue: { addBulk, getJobCounts } as unknown as Queue,
      config,
      now: () => now,
      log: (record) => logs.push(record),
    });

    await processor(job(RECURRING_SCAN_JOB, { trigger: 'test' }));

    expect(scanDueRules).toHaveBeenNthCalledWith(1, now, { limit: 2 });
    expect(scanDueRules).toHaveBeenNthCalledWith(2, now, { afterId: 'rule-b', limit: 2 });
    expect(addBulk).toHaveBeenCalledTimes(2);
    expect(addBulk.mock.calls[0]?.[0]?.[0]?.opts).toMatchObject({
      jobId: 'recurring-v1-rule-a-20260722',
      attempts: 5,
      backoff: { type: 'exponential', delay: 250 },
      removeOnFail: false,
    });
    expect(logs.at(-1)).toMatchObject({
      event: 'recurring.scan.completed',
      scanned: 3,
      materializeRequested: 2,
    });
  });

  it('passes the stable scheduled date to the shared domain service', async () => {
    const materializeScheduledRule = vi.fn().mockResolvedValue({ id: 'run-a' });
    const logs: RecurringWorkerLog[] = [];
    const processor = createRecurringProcessor({
      recurring: { materializeScheduledRule } as unknown as RecurringService,
      queue: {} as Queue,
      config,
      now: () => now,
      log: (record) => logs.push(record),
    });

    await expect(
      processor(
        job(RECURRING_MATERIALIZE_JOB, {
          ruleId: 'rule-a',
          scheduledDate: '2026-07-22',
        }),
      ),
    ).resolves.toMatchObject({ materialized: true });
    expect(materializeScheduledRule).toHaveBeenCalledWith('rule-a', '2026-07-22', now);
    expect(logs.at(-1)).toMatchObject({ event: 'recurring.materialize.completed' });
  });

  it('sanitizes scan infrastructure failures before BullMQ persists them', async () => {
    const logs: RecurringWorkerLog[] = [];
    const processor = createRecurringProcessor({
      recurring: {
        scanDueRules: vi.fn().mockRejectedValue(new Error('postgresql://user:secret@host/db')),
      } as unknown as RecurringService,
      queue: {} as Queue,
      config,
      now: () => now,
      log: (record) => logs.push(record),
    });
    await expect(processor(job(RECURRING_SCAN_JOB, { trigger: 'test' }))).rejects.toThrow(
      'RECURRING_SCAN_FAILED',
    );
    expect(JSON.stringify(logs)).not.toContain('secret');
    expect(logs.at(-1)).toMatchObject({
      event: 'recurring.scan.failed',
      code: 'RECURRING_SCAN_FAILED',
    });
  });

  it('stops retries for business-state failures but sanitizes transient failures', async () => {
    const businessProcessor = createRecurringProcessor({
      recurring: {
        materializeScheduledRule: vi
          .fn()
          .mockRejectedValue(new Error('RECURRING_CATEGORY_DISABLED')),
      } as unknown as RecurringService,
      queue: {} as Queue,
      config,
      now: () => now,
      log: () => undefined,
    });
    await expect(
      businessProcessor(
        job(RECURRING_MATERIALIZE_JOB, {
          ruleId: 'rule-a',
          scheduledDate: '2026-07-22',
        }),
      ),
    ).rejects.toBeInstanceOf(UnrecoverableError);

    const transientProcessor = createRecurringProcessor({
      recurring: {
        materializeScheduledRule: vi
          .fn()
          .mockRejectedValue(new Error('password=secret internal SQL')),
      } as unknown as RecurringService,
      queue: {} as Queue,
      config,
      now: () => now,
      log: () => undefined,
    });
    await expect(
      transientProcessor(
        job(RECURRING_MATERIALIZE_JOB, {
          ruleId: 'rule-a',
          scheduledDate: '2026-07-22',
        }),
      ),
    ).rejects.toThrow('RECURRING_EXECUTION_FAILED');
  });

  it('rejects malformed or unknown jobs without entering the domain service', async () => {
    const materializeScheduledRule = vi.fn();
    const processor = createRecurringProcessor({
      recurring: { materializeScheduledRule } as unknown as RecurringService,
      queue: {} as Queue,
      config,
      now: () => now,
      log: () => undefined,
    });
    await expect(
      processor(
        job(RECURRING_MATERIALIZE_JOB, {
          ruleId: 'rule-a',
          scheduledDate: '2026-02-30',
        }),
      ),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    await expect(processor(job('unknown', {}))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(materializeScheduledRule).not.toHaveBeenCalled();
  });
});
