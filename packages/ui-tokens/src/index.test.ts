import { describe, expect, it } from 'vitest';

import { antTheme, breakpoints } from './index';

describe('SIYU UI tokens', () => {
  it('keeps the minimum touch target and mobile widths in one source', () => {
    expect(antTheme.token.controlHeight).toBe(44);
    expect(breakpoints).toEqual({
      minimumMobile: 320,
      designMobile: 375,
      maximumMobileContent: 480,
    });
  });
});
