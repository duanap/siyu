import { UnrecoverableError, type Job, type Queue } from 'bullmq';

import { parseBusinessDate } from './recurring.dates';
import {
  isUnrecoverableRecurringError,
  recurringErrorCode,
  recurringMaterializeJobId,
  RECURRING_MATERIALIZE_JOB,
  RECURRING_SCAN_JOB,
  type RecurringMaterializeJobData,
  type RecurringScanJobData,
  type RecurringWorkerConfig,
} from './recurring.jobs';
import { RecurringService } from './recurring.service';

type RecurringJobData = RecurringScanJobData | RecurringMaterializeJobData;
type RecurringJob = Job<RecurringJobData, unknown, string>;

export interface RecurringWorkerLog {
  level: 'info' | 'warn' | 'error';
  event: string;
  [key: string]: unknown;
}

interface ProcessorDependencies {
  recurring: RecurringService;
  queue: Queue;
  config: RecurringWorkerConfig;
  now?: () => Date;
  log: (record: RecurringWorkerLog) => void;
}

function materializeData(job: RecurringJob): RecurringMaterializeJobData {
  const data = job.data as Partial<RecurringMaterializeJobData>;
  if (typeof data.ruleId !== 'string' || data.ruleId.length === 0) {
    throw new UnrecoverableError('INVALID_RECURRING_JOB_DATA');
  }
  if (typeof data.scheduledDate !== 'string') {
    throw new UnrecoverableError('INVALID_RECURRING_JOB_DATA');
  }
  try {
    parseBusinessDate(data.scheduledDate);
  } catch {
    throw new UnrecoverableError('INVALID_RECURRING_JOB_DATA');
  }
  return { ruleId: data.ruleId, scheduledDate: data.scheduledDate };
}

export function createRecurringProcessor({
  recurring,
  queue,
  config,
  now = () => new Date(),
  log,
}: ProcessorDependencies): (job: RecurringJob) => Promise<unknown> {
  return async (job) => {
    const startedAt = Date.now();
    if (job.name === RECURRING_SCAN_JOB) {
      try {
        const asOf = now();
        let afterId: string | undefined;
        let scanned = 0;
        let materializeRequested = 0;
        do {
          const page = await recurring.scanDueRules(asOf, {
            ...(afterId ? { afterId } : {}),
            limit: config.scanBatchSize,
          });
          scanned += page.candidateCount;
          if (page.jobs.length > 0) {
            await queue.addBulk(
              page.jobs.map((due) => ({
                name: RECURRING_MATERIALIZE_JOB,
                data: due,
                opts: {
                  jobId: recurringMaterializeJobId(due.ruleId, due.scheduledDate),
                  attempts: config.attempts,
                  backoff: { type: 'exponential', delay: config.backoffDelayMs },
                  removeOnComplete: { age: 86_400, count: 10_000 },
                  removeOnFail: false,
                },
              })),
            );
            materializeRequested += page.jobs.length;
          }
          afterId = page.nextCursor ?? undefined;
          if (!page.hasMore) break;
        } while (afterId);
        const counts = await queue.getJobCounts('wait', 'active', 'delayed', 'failed');
        const result = {
          asOf: asOf.toISOString(),
          scanned,
          materializeRequested,
          counts,
          durationMs: Date.now() - startedAt,
        };
        log({ level: 'info', event: 'recurring.scan.completed', ...result });
        return result;
      } catch {
        log({
          level: 'error',
          event: 'recurring.scan.failed',
          code: 'RECURRING_SCAN_FAILED',
          attempt: job.attemptsMade + 1,
          durationMs: Date.now() - startedAt,
        });
        throw new Error('RECURRING_SCAN_FAILED');
      }
    }

    if (job.name !== RECURRING_MATERIALIZE_JOB) {
      throw new UnrecoverableError('UNKNOWN_RECURRING_JOB');
    }

    const data = materializeData(job);
    try {
      const result = await recurring.materializeScheduledRule(
        data.ruleId,
        data.scheduledDate,
        now(),
      );
      log({
        level: 'info',
        event: result ? 'recurring.materialize.completed' : 'recurring.materialize.skipped',
        jobId: job.id,
        ruleId: data.ruleId,
        scheduledDate: data.scheduledDate,
        durationMs: Date.now() - startedAt,
      });
      return { materialized: Boolean(result) };
    } catch (error) {
      const code = recurringErrorCode(error);
      log({
        level: isUnrecoverableRecurringError(error) ? 'warn' : 'error',
        event: 'recurring.materialize.failed',
        jobId: job.id,
        ruleId: data.ruleId,
        scheduledDate: data.scheduledDate,
        code,
        attempt: job.attemptsMade + 1,
        durationMs: Date.now() - startedAt,
      });
      if (isUnrecoverableRecurringError(error)) throw new UnrecoverableError(code);
      throw new Error('RECURRING_EXECUTION_FAILED');
    }
  };
}
