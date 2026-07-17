import type { EntryType } from './entry';

export const MAX_SAFE_CENT = BigInt(Number.MAX_SAFE_INTEGER);

export type AmountParseResult =
  { ok: true; amountCent: number; normalized: string } | { ok: false; message: string };

export function normalizeAmountInput(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (!/^\d*(?:\.\d{0,2})?$/.test(trimmed)) return undefined;
  if (trimmed.startsWith('.')) return `0${trimmed}`;
  return trimmed;
}

export function parseAmountToCent(value: string): AmountParseResult {
  let normalized = value.trim();
  if (!normalized) return { ok: false, message: '请输入金额' };
  if (/[-+eE,]/.test(normalized) || !/^\d+(?:\.\d{0,2})?$/.test(normalized)) {
    return { ok: false, message: '金额只能包含数字和最多两位小数' };
  }
  if (normalized.endsWith('.')) normalized = normalized.slice(0, -1);
  const [wholeRaw = '0', fractionRaw = ''] = normalized.split('.');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || '0';
  const fraction = fractionRaw.padEnd(2, '0');
  const cents = BigInt(whole) * 100n + BigInt(fraction || '0');
  if (cents === 0n) return { ok: false, message: '金额必须大于 0' };
  if (cents > MAX_SAFE_CENT) return { ok: false, message: '金额超过可保存上限' };
  return {
    ok: true,
    amountCent: Number(cents),
    normalized: fractionRaw ? `${whole}.${fraction}` : whole,
  };
}

export function amountInputFromCent(amountCent: number): string {
  if (!Number.isSafeInteger(amountCent) || amountCent <= 0) return '';
  const value = BigInt(amountCent);
  const whole = value / 100n;
  const fraction = String(value % 100n).padStart(2, '0');
  return fraction === '00' ? String(whole) : `${whole}.${fraction}`;
}

export function formatAmount(amountCent: number, type: EntryType): string {
  if (!Number.isSafeInteger(amountCent) || amountCent <= 0) return '金额异常';
  const value = BigInt(amountCent);
  const whole = String(value / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = String(value % 100n).padStart(2, '0');
  return `${type === 'INCOME' ? '+' : '-'}¥ ${whole}.${fraction}`;
}
