import { sessionRawRequest, type ApiSession } from './api';

export interface EntryExportInput {
  ledgerId: string;
  startDate: string;
  endDate: string;
}

export function exportFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const utf8 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8.replace(/^"|"$/g, ''));
    } catch {
      return fallback;
    }
  }
  return contentDisposition.match(/filename="([^"]+)"/i)?.[1] ?? fallback;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function download(path: string, session: ApiSession, fallback: string): Promise<string> {
  const response = await sessionRawRequest(path, session);
  const filename = exportFilename(response.headers.get('content-disposition'), fallback);
  saveBlob(await response.blob(), filename);
  return filename;
}

export function createExportsApi(session: ApiSession) {
  return {
    entries(input: EntryExportInput): Promise<string> {
      const query = new URLSearchParams({
        ledgerId: input.ledgerId,
        startDate: input.startDate,
        endDate: input.endDate,
      });
      return download(`/exports/entries.csv?${query}`, session, 'siyu-entries.csv');
    },
    salary(year: number): Promise<string> {
      return download(`/exports/salary.csv?year=${year}`, session, `siyu-salary-${year}.csv`);
    },
  };
}
