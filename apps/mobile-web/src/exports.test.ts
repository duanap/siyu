import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiSession } from './api';
import { createExportsApi, exportFilename } from './exports';

const session: ApiSession = {
  accessToken: () => 'access-token',
  refresh: vi.fn(),
  expire: vi.fn(),
};

describe('CSV export client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:csv'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('extracts safe response filenames', () => {
    expect(exportFilename('attachment; filename="siyu-entries.csv"', 'fallback.csv')).toBe(
      'siyu-entries.csv',
    );
    expect(
      exportFilename("attachment; filename*=UTF-8''%E5%B7%A5%E8%B5%84.csv", 'fallback.csv'),
    ).toBe('工资.csv');
  });

  it('downloads entry and salary files with encoded scopes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/exports/');
      return Promise.resolve(
        new Response('\uFEFFheader\r\n', {
          status: 200,
          headers: { 'content-disposition': 'attachment; filename="download.csv"' },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = createExportsApi(session);
    await expect(
      api.entries({
        ledgerId: '10000000-0000-4000-8000-000000000001',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      }),
    ).resolves.toBe('download.csv');
    await expect(api.salary(2026)).resolves.toBe('download.csv');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'ledgerId=10000000-0000-4000-8000-000000000001',
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/exports/salary.csv?year=2026');
  });
});
