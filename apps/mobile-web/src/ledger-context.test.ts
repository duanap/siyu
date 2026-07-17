import { beforeEach, describe, expect, it } from 'vitest';
import {
  CURRENT_LEDGER_STORAGE_KEY,
  localBusinessDate,
  persistLedgerId,
  resolveLedger,
} from './ledger-context';
import type { Ledger } from './entry';

const personal: Ledger = {
  id: 'personal',
  type: 'PERSONAL',
  name: '个人账本',
  ownerUserId: 'user',
  status: 'ACTIVE',
  members: [],
};
const couple: Ledger = {
  id: 'couple',
  type: 'COUPLE',
  name: '朝暮同笺',
  ownerUserId: 'user',
  status: 'ACTIVE',
  members: [],
};

describe('ledger context', () => {
  beforeEach(() => localStorage.clear());
  it('uses URL before stored ledger and persists current selection', () => {
    persistLedgerId('couple');
    expect(localStorage.getItem(CURRENT_LEDGER_STORAGE_KEY)).toBe('couple');
    expect(resolveLedger([personal, couple], 'personal')).toEqual({
      ledger: personal,
      fellBack: false,
    });
  });
  it('falls back from invalid URL to stored or personal ledger', () => {
    persistLedgerId('couple');
    expect(resolveLedger([personal, couple], 'missing')).toEqual({
      ledger: couple,
      fellBack: true,
    });
    localStorage.clear();
    expect(resolveLedger([personal], 'missing')).toEqual({ ledger: personal, fellBack: true });
  });
  it('formats business date in the user timezone and safely falls back', () => {
    const now = new Date('2026-07-14T17:00:00.000Z');
    expect(localBusinessDate('Asia/Shanghai', now)).toBe('2026-07-15');
    expect(localBusinessDate('invalid-zone', now)).toBe('2026-07-15');
  });
});
