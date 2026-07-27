import { describe, expect, it } from 'vitest';

import { validatePasswordResetMailProvider } from './worker';

describe('password reset mail provider release guard (BR-SECURITY-001)', () => {
  it('allows the isolated test transport outside production', () => {
    expect(() => validatePasswordResetMailProvider(false, true, 'test')).not.toThrow();
    expect(() => validatePasswordResetMailProvider(false, false, undefined)).not.toThrow();
  });

  it('allows production without mail only when password reset is explicitly disabled', () => {
    expect(() => validatePasswordResetMailProvider(true, false, undefined)).not.toThrow();
    expect(() => validatePasswordResetMailProvider(true, false, 'smtp')).toThrow(
      'MAIL_PROVIDER_DISABLED_WITH_PROVIDER',
    );
  });

  it('fails production startup before accepting missing, test or unsupported enabled providers', () => {
    expect(() => validatePasswordResetMailProvider(true, true, undefined)).toThrow(
      'MAIL_PROVIDER_UNCONFIGURED',
    );
    expect(() => validatePasswordResetMailProvider(true, true, 'test')).toThrow(
      '生产环境禁止使用 test 邮件提供方',
    );
    expect(() => validatePasswordResetMailProvider(true, true, 'smtp')).toThrow(
      'MAIL_PROVIDER_UNSUPPORTED',
    );
  });
});
