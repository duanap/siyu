import 'reflect-metadata';

import { createApp } from './app';
import { readConfig } from './config';

async function bootstrap(): Promise<void> {
  const config = readConfig();
  const app = await createApp();
  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
