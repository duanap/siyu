import 'reflect-metadata';

import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

import { AppModule } from './app.module';
import { loadEnvironmentFile, readConfig } from './config';
import {
  readRecurringWorkerConfig,
  RECURRING_QUEUE,
  RECURRING_SCAN_JOB,
  RECURRING_SCAN_SCHEDULER,
} from './recurring/recurring.jobs';
import { RecurringService } from './recurring/recurring.service';
import { createRecurringProcessor, type RecurringWorkerLog } from './recurring/recurring.worker';

const passwordResetQueue = 'siyu-password-reset';

type WorkerLogger = (record: RecurringWorkerLog) => void;

export interface WorkerRuntime {
  recurringWorker: Worker;
  passwordResetWorker: Worker;
  recurringQueue: Queue;
  connection: IORedis;
  app: INestApplicationContext;
  close: () => Promise<void>;
}

interface StartWorkerOptions {
  registerScheduler?: boolean;
  enqueueStartupScan?: boolean;
  now?: () => Date;
  log?: WorkerLogger;
}

function defaultLog(record: RecurringWorkerLog): void {
  const line = JSON.stringify({ service: 'siyu-worker', ...record });
  if (record.level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

function startupScanId(now: Date): string {
  return `recurring-scan-startup-${now.toISOString().slice(0, 16).replaceAll(/[-:T]/g, '')}`;
}

export async function startWorker(options: StartWorkerOptions = {}): Promise<WorkerRuntime> {
  const { redisUrl } = readConfig();
  const recurringConfig = readRecurringWorkerConfig();
  const now = options.now ?? (() => new Date());
  const log = options.log ?? defaultLog;
  const connection = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
  await connection.connect();

  let app: INestApplicationContext | undefined;
  let recurringQueue: Queue | undefined;
  let recurringWorker: Worker | undefined;
  let passwordResetWorker: Worker | undefined;
  try {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const recurring = app.get(RecurringService);
    recurringQueue = new Queue(RECURRING_QUEUE, { connection });

    const processor = createRecurringProcessor({
      recurring,
      queue: recurringQueue,
      config: recurringConfig,
      now,
      log,
    });
    recurringWorker = new Worker(RECURRING_QUEUE, processor, {
      connection,
      concurrency: recurringConfig.concurrency,
    });
    passwordResetWorker = new Worker(
      passwordResetQueue,
      async (job: Job<{ resetId: string; email: string; token: string }>) => {
        const provider = process.env.SIYU_MAIL_PROVIDER;
        if (!provider) throw new Error('MAIL_PROVIDER_UNCONFIGURED');
        if (provider === 'test') {
          await connection.lpush(
            'test:mailbox:password-reset',
            JSON.stringify({
              resetId: job.data.resetId,
              email: job.data.email,
              token: job.data.token,
            }),
          );
          return;
        }
        throw new Error('MAIL_PROVIDER_UNSUPPORTED');
      },
      { connection },
    );

    recurringWorker.on('stalled', (jobId) => {
      log({ level: 'warn', event: 'recurring.job.stalled', jobId });
    });
    recurringWorker.on('failed', (job, error) => {
      log({
        level: 'warn',
        event: 'recurring.job.failed',
        jobId: job?.id,
        jobName: job?.name,
        attempt: job ? job.attemptsMade : undefined,
        code:
          error.message === 'RECURRING_EXECUTION_FAILED' ? error.message : 'RECURRING_JOB_FAILED',
      });
    });
    recurringWorker.on('error', () => {
      log({ level: 'error', event: 'recurring.worker.error', code: 'RECURRING_WORKER_ERROR' });
    });

    if (options.registerScheduler !== false) {
      await recurringQueue.upsertJobScheduler(
        RECURRING_SCAN_SCHEDULER,
        { every: recurringConfig.scanIntervalMs },
        {
          name: RECURRING_SCAN_JOB,
          data: { trigger: 'scheduler' },
          opts: {
            attempts: 3,
            backoff: { type: 'exponential', delay: recurringConfig.backoffDelayMs },
            removeOnComplete: { age: 86_400, count: 1_000 },
            removeOnFail: false,
          },
        },
      );
    }
    if (options.enqueueStartupScan !== false) {
      await recurringQueue.add(
        RECURRING_SCAN_JOB,
        { trigger: 'manual' },
        {
          jobId: startupScanId(now()),
          attempts: 3,
          backoff: { type: 'exponential', delay: recurringConfig.backoffDelayMs },
          removeOnComplete: { age: 3_600, count: 100 },
          removeOnFail: false,
        },
      );
    }
    log({
      level: 'info',
      event: 'recurring.worker.started',
      queue: RECURRING_QUEUE,
      concurrency: recurringConfig.concurrency,
      scanIntervalMs: recurringConfig.scanIntervalMs,
    });

    let closing: Promise<void> | undefined;
    const close = (): Promise<void> => {
      closing ??= (async () => {
        await Promise.all([recurringWorker?.close(), passwordResetWorker?.close()]);
        await recurringQueue?.close();
        await app?.close();
        await connection.quit();
        log({ level: 'info', event: 'recurring.worker.stopped' });
      })();
      return closing;
    };

    return {
      recurringWorker,
      passwordResetWorker,
      recurringQueue,
      connection,
      app,
      close,
    };
  } catch (error) {
    await Promise.allSettled([
      recurringWorker?.close(),
      passwordResetWorker?.close(),
      recurringQueue?.close(),
      app?.close(),
    ]);
    if (connection.status !== 'end') await connection.quit();
    throw error;
  }
}

async function bootstrap(): Promise<void> {
  loadEnvironmentFile();
  const runtime = await startWorker();
  const shutdown = (): void => {
    void runtime.close().catch(() => {
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  void bootstrap().catch(() => {
    defaultLog({ level: 'error', event: 'worker.start.failed', code: 'WORKER_START_FAILED' });
    process.exitCode = 1;
  });
}
