import 'reflect-metadata';

import { createApp } from './app';
import { loadEnvironmentFile, readConfig } from './config';

async function bootstrap(): Promise<void> {
  loadEnvironmentFile();
  const config = readConfig();
  const app = await createApp();
  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
