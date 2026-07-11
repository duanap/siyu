export interface AppConfig {
  port: number;
  corsOrigins: string[];
  redisUrl: string;
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
  return {
    port: readPort(environment.SIYU_API_PORT),
    corsOrigins: readOrigins(environment.SIYU_CORS_ORIGINS),
    redisUrl: environment.REDIS_URL ?? 'redis://localhost:6379',
  };
}
