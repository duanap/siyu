import { describe, expect, it } from 'vitest';

import { csvCell, currentYear, entryDateRange, formatCent } from './exports.service';

describe('CSV export helpers', () => {
  it('formats integer cents without floating point conversion', () => {
    expect(formatCent(1n)).toBe('0.01');
    expect(formatCent(9007199254740991n)).toBe('90071992547409.91');
    expect(formatCent(-123n)).toBe('-1.23');
  });

  it('escapes CSV syntax and neutralizes spreadsheet formulas', () => {
    expect(csvCell('普通,备注')).toBe('"普通,备注"');
    expect(csvCell('他说"好"')).toBe('"他说""好"""');
    expect(csvCell('  =HYPERLINK("x")')).toBe('"\'  =HYPERLINK(""x"")"');
    expect(csvCell('\r\n+SUM(1,1)')).toBe('"\'\r\n+SUM(1,1)"');
    expect(csvCell('-1.23', false)).toBe('"-1.23"');
  });

  it('defaults to the actor calendar year and enforces a 366 day inclusive range', () => {
    expect(currentYear('Asia/Shanghai', new Date('2025-12-31T16:30:00.000Z'))).toBe(2026);
    expect(entryDateRange('Asia/Shanghai', '2024-01-01', '2024-12-31')).toMatchObject({
      start: '2024-01-01',
      end: '2024-12-31',
    });
    expect(() => entryDateRange('Asia/Shanghai', '2024-01-01', '2025-01-01')).toThrow(
      '账目导出范围不能超过 366 天',
    );
    expect(() => entryDateRange('Asia/Shanghai', '2024-01-01')).toThrow('起止日期必须同时提供');
  });
});
