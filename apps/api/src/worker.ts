import { Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

import { readConfig } from './config';

const bootstrapQueue = 'siyu-bootstrap';
const passwordResetQueue = 'siyu-password-reset';

export async function startWorker(): Promise<{
  worker: Worker;
  passwordResetWorker: Worker;
  connection: IORedis;
}> {
  const { redisUrl } = readConfig();
  const connection = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
  await connection.connect();

  const worker = new Worker(bootstrapQueue, async () => undefined, {
    connection,
  });

  const passwordResetWorker = new Worker(
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

  return { worker, passwordResetWorker, connection };
}

async function bootstrap(): Promise<void> {
  const { worker, passwordResetWorker, connection } = await startWorker();

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await passwordResetWorker.close();
    await connection.quit();
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

if (require.main === module) {
  void bootstrap();
}
