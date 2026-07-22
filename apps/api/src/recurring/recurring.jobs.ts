export const RECURRING_QUEUE = 'siyu-recurring-due';
export const RECURRING_SCAN_JOB = 'scan';
export const RECURRING_MATERIALIZE_JOB = 'materialize';
export const RECURRING_SCAN_SCHEDULER = 'siyu-recurring-due-scan-v1';

export interface RecurringScanJobData {
  trigger: 'scheduler' | 'manual' | 'test';
}

export interface RecurringMaterializeJobData {
  ruleId: string;
  scheduledDate: string;
}

export interface RecurringWorkerConfig {
  scanIntervalMs: number;
  scanBatchSize: number;
  concurrency: number;
  attempts: number;
  backoffDelayMs: number;
}

function integerSetting(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(environment[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} 必须是 ${minimum} 到 ${maximum} 之间的整数。`);
  }
  return value;
}

export function readRecurringWorkerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): RecurringWorkerConfig {
  return {
    scanIntervalMs: integerSetting(
      environment,
      'SIYU_RECURRING_SCAN_INTERVAL_MS',
      60_000,
      10_000,
      86_400_000,
    ),
    scanBatchSize: integerSetting(environment, 'SIYU_RECURRING_SCAN_BATCH_SIZE', 200, 1, 1_000),
    concurrency: integerSetting(environment, 'SIYU_RECURRING_WORKER_CONCURRENCY', 8, 1, 100),
    attempts: integerSetting(environment, 'SIYU_RECURRING_JOB_ATTEMPTS', 5, 1, 20),
    backoffDelayMs: integerSetting(
      environment,
      'SIYU_RECURRING_BACKOFF_DELAY_MS',
      1_000,
      100,
      600_000,
    ),
  };
}

export function recurringMaterializeJobId(ruleId: string, scheduledDate: string): string {
  return `recurring-v1-${ruleId}-${scheduledDate.replaceAll('-', '')}`;
}

export function recurringErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return 'RECURRING_EXECUTION_FAILED';
  const code = error.message.trim();
  return [
    'INVALID_BUSINESS_DATE',
    'RECURRING_CATEGORY_DISABLED',
    'RECURRING_OWNER_INACTIVE',
  ].includes(code)
    ? code
    : 'RECURRING_EXECUTION_FAILED';
}

export function isUnrecoverableRecurringError(error: unknown): boolean {
  return recurringErrorCode(error) !== 'RECURRING_EXECUTION_FAILED';
}
