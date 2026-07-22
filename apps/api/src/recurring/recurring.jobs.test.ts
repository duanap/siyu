import { describe, expect, it } from 'vitest';

import {
  isUnrecoverableRecurringError,
  readRecurringWorkerConfig,
  recurringErrorCode,
  recurringMaterializeJobId,
} from './recurring.jobs';

describe('recurring worker job contract (BR-RECUR-004, BR-RECUR-009)', () => {
  it('builds a stable BullMQ-safe ID for one rule and scheduled date', () => {
    const id = recurringMaterializeJobId('01234567-89ab-4def-8123-456789abcdef', '2026-07-22');
    expect(id).toBe('recurring-v1-01234567-89ab-4def-8123-456789abcdef-20260722');
    expect(id).not.toContain(':');
  });

  it('validates bounded worker configuration', () => {
    expect(readRecurringWorkerConfig({})).toEqual({
      scanIntervalMs: 60_000,
      scanBatchSize: 200,
      concurrency: 8,
      attempts: 5,
      backoffDelayMs: 1_000,
    });
    expect(() => readRecurringWorkerConfig({ SIYU_RECURRING_WORKER_CONCURRENCY: '0' })).toThrow(
      'SIYU_RECURRING_WORKER_CONCURRENCY',
    );
    expect(() => readRecurringWorkerConfig({ SIYU_RECURRING_SCAN_INTERVAL_MS: '9999' })).toThrow(
      'SIYU_RECURRING_SCAN_INTERVAL_MS',
    );
  });

  it('only marks known business-state failures as unrecoverable', () => {
    expect(isUnrecoverableRecurringError(new Error('RECURRING_CATEGORY_DISABLED'))).toBe(true);
    expect(recurringErrorCode(new Error('database connection details'))).toBe(
      'RECURRING_EXECUTION_FAILED',
    );
    expect(isUnrecoverableRecurringError(new Error('database connection details'))).toBe(false);
  });
});
