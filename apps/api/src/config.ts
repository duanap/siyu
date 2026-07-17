import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export interface AppConfig {
  port: number;
  corsOrigins: string[];
  redisUrl: string;
  databaseUrl: string;
  jwtSecret: string;
  publicUrl: string;
  adminUrl: string;
  isProduction: boolean;
  cookieSecure: boolean;
  qqClientId: string | undefined;
  qqClientSecret: string | undefined;
  qqCallbackUrl: string | undefined;
}

export function loadEnvironmentFile(explicitPath = process.env.SIYU_ENV_FILE): string | undefined {
  const candidates = explicitPath
    ? isAbsolute(explicitPath)
      ? [explicitPath]
      : [resolve(process.cwd(), explicitPath), resolve(__dirname, '../../..', explicitPath)]
    : [resolve(process.cwd(), '.env'), resolve(__dirname, '../../../.env')];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) {
    if (explicitPath) throw new Error(`SIYU_ENV_FILE 指向的文件不存在：${candidates[0]}`);
    return undefined;
  }
  process.loadEnvFile(file);
  return file;
}

function readPort(value: string | undefined): number {
  const port = Number(value ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new RangeError('SIYU_API_PORT 必须是 1 到 65535 之间的整数。');
  }
  return port;
}

function readOrigins(value: string | undefined): string[] {
  const origins = (value ?? 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.some((origin) => !URL.canParse(origin))) {
    throw new TypeError('SIYU_CORS_ORIGINS 必须是逗号分隔的有效 URL。');
  }

  return origins;
}

export function readConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = environment.NODE_ENV === 'production';
  const jwtSecret =
    environment.JWT_SECRET ?? (isProduction ? '' : 'siyu-test-only-jwt-secret-change-me');
  if (jwtSecret.length < 32) {
    throw new TypeError('JWT_SECRET 必须至少包含 32 个字符。');
  }

  return {
    port: readPort(environment.SIYU_API_PORT),
    corsOrigins: readOrigins(environment.SIYU_CORS_ORIGINS),
    redisUrl: environment.REDIS_URL ?? 'redis://localhost:6379',
    databaseUrl:
      environment.DATABASE_URL ??
      'postgresql://siyu:siyu_local_only@localhost:5432/siyu?schema=public',
    jwtSecret,
    publicUrl: environment.SIYU_PUBLIC_URL ?? 'http://localhost:5173',
    adminUrl: environment.SIYU_ADMIN_URL ?? 'http://localhost:5174/admin/',
    isProduction,
    cookieSecure:
      environment.SIYU_COOKIE_SECURE === undefined
        ? isProduction
        : environment.SIYU_COOKIE_SECURE === 'true',
    qqClientId: environment.SIYU_QQ_CLIENT_ID || undefined,
    qqClientSecret: environment.SIYU_QQ_CLIENT_SECRET || undefined,
    qqCallbackUrl: environment.SIYU_QQ_CALLBACK_URL || undefined,
  };
}
