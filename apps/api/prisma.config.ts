import 'dotenv/config';

import { defineConfig } from 'prisma/config';

const localDatabaseUrl = 'postgresql://siyu:siyu_local_only@localhost:5432/siyu?schema=public';
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl,
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
});
