import { describe, expect, it } from 'vitest';

import { validatePasswordResetMailProvider } from './worker';

describe('password reset mail provider release guard (BR-SECURITY-001)', () => {
  it('allows the isolated test transport outside production', () => {
    expect(() => validatePasswordResetMailProvider(false, 'test')).not.toThrow();
    expect(() => validatePasswordResetMailProvider(false, undefined)).not.toThrow();
  });

  it('fails production startup before accepting missing, test or unsupported providers', () => {
    expect(() => validatePasswordResetMailProvider(true, undefined)).toThrow(
      'MAIL_PROVIDER_UNCONFIGURED',
    );
    expect(() => validatePasswordResetMailProvider(true, 'test')).toThrow(
      '生产环境禁止使用 test 邮件提供方',
    );
    expect(() => validatePasswordResetMailProvider(true, 'smtp')).toThrow(
      'MAIL_PROVIDER_UNSUPPORTED',
    );
  });
});
