import { MAX_SAFE_CENT, type BusinessDate, type Cent } from '@siyu/shared-types';

export function parsePositiveCent(value: unknown): Cent {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MAX_SAFE_CENT
  ) {
    throw new RangeError('金额必须是大于零且不超过 JavaScript 安全整数的整数分。');
  }

  return value as Cent;
}

export function parseBusinessDate(value: unknown): BusinessDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('业务日期必须使用 YYYY-MM-DD。');
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError('业务日期不是有效的日历日期。');
  }

  return value as BusinessDate;
}
