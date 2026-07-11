import { describe, expect, it } from 'vitest';

import { MAX_SAFE_CENT } from './index';

describe('financial contract constants', () => {
  it('uses the JavaScript safe integer boundary for API cents', () => {
    expect(MAX_SAFE_CENT).toBe(Number.MAX_SAFE_INTEGER);
    expect(Number.isSafeInteger(MAX_SAFE_CENT)).toBe(true);
  });
});
