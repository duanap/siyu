import type { RecurringFrequency } from '@prisma/client';

export function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseBusinessDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || dateOnly(date) !== value) {
    throw new Error('INVALID_BUSINESS_DATE');
  }
  return date;
}

export function businessToday(timezone: string, now = new Date()): Date {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  const parts = formatter.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string | undefined =>
    parts.find((candidate) => candidate.type === type)?.value;
  return parseBusinessDate(`${part('year')}-${part('month')}-${part('day')}`);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function occurrenceAt(
  startDate: Date,
  frequency: RecurringFrequency,
  intervalValue: number,
  occurrenceIndex: number,
): Date {
  if (!Number.isInteger(intervalValue) || intervalValue < 1) throw new Error('INVALID_INTERVAL');
  if (!Number.isInteger(occurrenceIndex) || occurrenceIndex < 0) {
    throw new Error('INVALID_OCCURRENCE_INDEX');
  }
  const anchorYear = startDate.getUTCFullYear();
  const anchorMonth = startDate.getUTCMonth();
  const anchorDay = startDate.getUTCDate();
  const monthOffset =
    frequency === 'MONTHLY'
      ? occurrenceIndex * intervalValue
      : occurrenceIndex * intervalValue * 12;
  const absoluteMonth = anchorYear * 12 + anchorMonth + monthOffset;
  const year = Math.floor(absoluteMonth / 12);
  const month = absoluteMonth % 12;
  return new Date(Date.UTC(year, month, Math.min(anchorDay, daysInMonth(year, month))));
}

export function nextOccurrenceOnOrAfter(
  startDate: Date,
  frequency: RecurringFrequency,
  intervalValue: number,
  threshold: Date,
  minimumIndex = 0,
): { date: Date; index: number } {
  const startMonth = startDate.getUTCFullYear() * 12 + startDate.getUTCMonth();
  const thresholdMonth = threshold.getUTCFullYear() * 12 + threshold.getUTCMonth();
  const intervalMonths = frequency === 'MONTHLY' ? intervalValue : intervalValue * 12;
  let index = Math.max(minimumIndex, Math.floor((thresholdMonth - startMonth) / intervalMonths));
  if (index < 0) index = 0;
  let candidate = occurrenceAt(startDate, frequency, intervalValue, index);
  while (candidate.getTime() < threshold.getTime()) {
    index += 1;
    candidate = occurrenceAt(startDate, frequency, intervalValue, index);
  }
  while (index > minimumIndex) {
    const previous = occurrenceAt(startDate, frequency, intervalValue, index - 1);
    if (previous.getTime() < threshold.getTime()) break;
    index -= 1;
    candidate = previous;
  }
  return { date: candidate, index };
}

export function nextOccurrenceAfter(
  startDate: Date,
  frequency: RecurringFrequency,
  intervalValue: number,
  scheduledDate: Date,
): Date {
  const nextDay = new Date(scheduledDate.getTime() + 86_400_000);
  return nextOccurrenceOnOrAfter(startDate, frequency, intervalValue, nextDay).date;
}
