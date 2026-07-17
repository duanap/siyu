import type { Ledger } from './entry';

export const CURRENT_LEDGER_STORAGE_KEY = 'siyu.currentLedgerId';

export function storedLedgerId(): string {
  try {
    return localStorage.getItem(CURRENT_LEDGER_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function persistLedgerId(ledgerId: string): void {
  try {
    localStorage.setItem(CURRENT_LEDGER_STORAGE_KEY, ledgerId);
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function resolveLedger(
  ledgers: Ledger[],
  urlLedgerId: string,
): { ledger?: Ledger; fellBack: boolean } {
  const fromUrl = ledgers.find((ledger) => ledger.id === urlLedgerId);
  if (fromUrl) return { ledger: fromUrl, fellBack: false };
  const fromStorage = ledgers.find((ledger) => ledger.id === storedLedgerId());
  if (fromStorage) return { ledger: fromStorage, fellBack: Boolean(urlLedgerId) };
  const personal = ledgers.find((ledger) => ledger.type === 'PERSONAL') ?? ledgers[0];
  return personal
    ? { ledger: personal, fellBack: Boolean(urlLedgerId) }
    : { fellBack: Boolean(urlLedgerId) };
}

export function localBusinessDate(timezone: string | undefined, now = new Date()): string {
  const format = (timeZone: string) => {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}-${value('month')}-${value('day')}`;
  };
  try {
    return format(timezone || 'Asia/Shanghai');
  } catch {
    return format('Asia/Shanghai');
  }
}
