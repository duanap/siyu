import { Worker } from 'bullmq';
import IORedis from 'ioredis';

import { readConfig } from './config';

const bootstrapQueue = 'siyu-bootstrap';

export async function startWorker(): Promise<{
  worker: Worker;
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

  return { worker, connection };
}

async function bootstrap(): Promise<void> {
  const { worker, connection } = await startWorker();

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await connection.quit();
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

if (require.main === module) {
  void bootstrap();
}
