import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';

import type { ExportEntriesDto, ExportSalaryDto } from './exports.dto';
import {
  ExportsRepository,
  type EntryExportRecord,
  type SalaryExportRecord,
} from './exports.repository';

const DAY_MS = 86_400_000;
const MAX_EXPORT_ROWS = 10_000;
const BOM = '\uFEFF';
const CRLF = '\r\n';

type CsvCell = { value: unknown; protectFormula?: boolean };

function invalid(message: string): BadRequestException {
  return new BadRequestException({ code: 'EXPORT_RANGE_INVALID', message });
}

function invisible(): NotFoundException {
  return new NotFoundException({ code: 'EXPORT_LEDGER_NOT_FOUND', message: '账本不存在' });
}

function tooLarge(): PayloadTooLargeException {
  return new PayloadTooLargeException({
    code: 'EXPORT_TOO_LARGE',
    message: `导出数据超过 ${MAX_EXPORT_ROWS} 行，请缩小范围后重试`,
  });
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || dateOnly(parsed) !== value) throw invalid('导出日期无效');
  return parsed;
}

export function currentYear(timezone: string, now = new Date()): number {
  const yearIn = (timeZone: string): number | undefined => {
    const value = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' })
      .formatToParts(now)
      .find((candidate) => candidate.type === 'year')?.value;
    const year = Number(value);
    return Number.isInteger(year) ? year : undefined;
  };
  try {
    const year = yearIn(timezone);
    if (year !== undefined) return year;
  } catch {
    // Fall through to the approved default timezone.
  }
  try {
    const year = yearIn('Asia/Shanghai');
    if (year !== undefined) return year;
  } catch {
    // Fall through to UTC if Intl is unavailable.
  }
  return now.getUTCFullYear();
}

export function entryDateRange(
  timezone: string,
  startDate?: string,
  endDate?: string,
): { startDate: Date; endDate: Date; start: string; end: string } {
  if (Boolean(startDate) !== Boolean(endDate)) throw invalid('起止日期必须同时提供');
  if (!startDate || !endDate) {
    const year = currentYear(timezone);
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    return { startDate: parseDate(start), endDate: parseDate(end), start, end };
  }
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const spanDays = (end.getTime() - start.getTime()) / DAY_MS;
  if (spanDays < 0) throw invalid('开始日期不能晚于结束日期');
  if (spanDays > 365) throw invalid('账目导出范围不能超过 366 天');
  return { startDate: start, endDate: end, start: startDate, end: endDate };
}

export function formatCent(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function csvCell(value: unknown, protectFormula = true): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (protectFormula && /^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvRow(cells: CsvCell[]): string {
  return cells.map((cell) => csvCell(cell.value, cell.protectFormula ?? true)).join(',');
}

const plain = (value: unknown): CsvCell => ({ value, protectFormula: false });
const text = (value: unknown): CsvCell => ({ value, protectFormula: true });

function entryCsv(records: EntryExportRecord[]): string {
  const rows = [
    csvRow(
      [
        '业务日期',
        '账本',
        '收支类型',
        '金额(元)',
        '分类',
        '支付方式',
        '来源',
        '创建人',
        '备注',
      ].map(plain),
    ),
    ...records.map((record) =>
      csvRow([
        plain(dateOnly(record.businessDate)),
        text(record.ledger.name),
        plain(record.type),
        plain(formatCent(record.amountCent)),
        text(record.category.name),
        plain(record.paymentMethod ?? ''),
        plain(record.sourceType),
        text(record.creator.nickname),
        text(record.note ?? ''),
      ]),
    ),
  ];
  return `${BOM}${rows.join(CRLF)}${CRLF}`;
}

function salaryDataRows(records: SalaryExportRecord[]): CsvCell[][] {
  return records.flatMap((record) => {
    const common: CsvCell[] = [
      plain(dateOnly(record.salaryMonth).slice(0, 7)),
      text(record.profile.name),
      text(record.profile.employerName ?? ''),
      plain(formatCent(record.grossCent)),
      plain(formatCent(record.deductionCent)),
      plain(formatCent(record.netCent)),
      plain(record.paymentStatus),
      plain(record.paidDate ? dateOnly(record.paidDate) : ''),
      plain(record.entryId ? 'YES' : 'NO'),
    ];
    if (record.items.length === 0) return [[...common, plain(''), text(''), text(''), plain('')]];
    return record.items.map((item) => [
      ...common,
      plain(item.itemType),
      text(item.itemCode),
      text(item.itemName),
      plain(formatCent(item.amountCent)),
    ]);
  });
}

function salaryCsv(rows: CsvCell[][]): string {
  const header = [
    '工资月份',
    '工资档案',
    '单位',
    '应发(元)',
    '扣除(元)',
    '实发(元)',
    '到账状态',
    '到账日期',
    '已同步收入',
    '项目类型',
    '项目编码',
    '项目名称',
    '项目金额(元)',
  ];
  return `${BOM}${[csvRow(header.map(plain)), ...rows.map(csvRow)].join(CRLF)}${CRLF}`;
}

function canReadLedger(
  userId: string,
  ledger: { type: string; ownerUserId: string; members: { role: string }[] },
): boolean {
  return (
    ledger.type === 'COUPLE' ||
    (ledger.ownerUserId === userId && ledger.members.some((member) => member.role === 'OWNER'))
  );
}

@Injectable()
export class ExportsService {
  constructor(@Inject(ExportsRepository) private readonly repository: ExportsRepository) {}

  async entries(
    userId: string,
    query: ExportEntriesDto,
    requestId: string,
  ): Promise<{ body: string; filename: string }> {
    return this.repository.transaction(async (tx) => {
      const [actor, ledger] = await Promise.all([
        this.repository.findActor(tx, userId),
        this.repository.findVisibleLedger(tx, userId, query.ledgerId),
      ]);
      if (!actor || !ledger || !canReadLedger(userId, ledger)) throw invisible();
      const range = entryDateRange(actor.timezone, query.startDate, query.endDate);
      const records = await this.repository.listEntries(
        tx,
        query.ledgerId,
        range.startDate,
        range.endDate,
        MAX_EXPORT_ROWS + 1,
      );
      if (records.length > MAX_EXPORT_ROWS) throw tooLarge();
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'ENTRY_CSV_EXPORTED',
        targetType: 'LEDGER',
        targetId: query.ledgerId,
        requestId,
        afterJson: {
          format: 'CSV',
          startDate: range.start,
          endDate: range.end,
          rowCount: records.length,
        },
      });
      return {
        body: entryCsv(records),
        filename: `siyu-entries-${range.start}-${range.end}.csv`,
      };
    });
  }

  async salary(
    userId: string,
    query: ExportSalaryDto,
    requestId: string,
  ): Promise<{ body: string; filename: string }> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      if (!actor)
        throw new NotFoundException({ code: 'EXPORT_USER_NOT_FOUND', message: '用户不存在' });
      const year = query.year ?? currentYear(actor.timezone);
      const records = await this.repository.listSalaryRecords(
        tx,
        userId,
        year,
        MAX_EXPORT_ROWS + 1,
      );
      const rows = salaryDataRows(records);
      if (rows.length > MAX_EXPORT_ROWS) throw tooLarge();
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'SALARY_CSV_EXPORTED',
        targetType: 'USER',
        targetId: userId,
        requestId,
        afterJson: { format: 'CSV', year, rowCount: rows.length },
      });
      return { body: salaryCsv(rows), filename: `siyu-salary-${year}.csv` };
    });
  }
}
