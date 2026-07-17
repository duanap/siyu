import type { Ledger } from './couple-ledger';

export const LEDGER_STORAGE_KEY = 'siyu-current-ledger-id';

export function resolveLedgerId(
  ledgers: Ledger[],
  requested?: string,
  requestedType?: 'PERSONAL' | 'COUPLE',
): string {
  const stored = localStorage.getItem(LEDGER_STORAGE_KEY) ?? undefined;
  const requestedByType = ledgers.find((ledger) => ledger.type === requestedType)?.id;
  const selected = [requested, requestedByType, stored].find((id) =>
    ledgers.some((ledger) => ledger.id === id),
  );
  return (
    selected ?? ledgers.find((ledger) => ledger.type === 'PERSONAL')?.id ?? ledgers[0]?.id ?? ''
  );
}

export function persistLedgerId(ledgerId: string): void {
  if (ledgerId) localStorage.setItem(LEDGER_STORAGE_KEY, ledgerId);
}
