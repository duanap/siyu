import type { OpenApiComponents } from '@siyu/shared-types';

import { apiRequest, sessionApiRequest, type ApiSession } from './api';

export type Entry = OpenApiComponents['schemas']['Entry'];
export type User = OpenApiComponents['schemas']['User'];
export type Ledger = OpenApiComponents['schemas']['Ledger'];
export type EntryType = OpenApiComponents['schemas']['EntryType'];
export type EntryPaymentMethod = OpenApiComponents['schemas']['EntryPaymentMethod'];
export type EntrySourceType = OpenApiComponents['schemas']['EntrySourceType'];
export type CreateEntryRequest = OpenApiComponents['schemas']['CreateEntryRequest'];
export type UpdateEntryRequest = OpenApiComponents['schemas']['UpdateEntryRequest'];
export type EntryDeleteResult = OpenApiComponents['schemas']['EntryDeleteResponse']['data'];

export interface EntryListQuery {
  ledgerId: string;
  page?: number;
  pageSize?: number;
  month?: string;
  type?: EntryType;
  categoryId?: string;
  creatorUserId?: string;
  keyword?: string;
}

export type EntryListResult = OpenApiComponents['schemas']['EntryListResponse']['data'];
export type EntryList = EntryListResult;

function queryString(query: EntryListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

export function createEntryApi(session: ApiSession) {
  return {
    list(query: EntryListQuery, signal?: AbortSignal): Promise<EntryListResult> {
      return sessionApiRequest(`/entries?${queryString(query)}`, session, signal ? { signal } : {});
    },
    create(input: CreateEntryRequest): Promise<Entry> {
      return sessionApiRequest('/entries', session, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    get(id: string, signal?: AbortSignal): Promise<Entry> {
      return sessionApiRequest(
        `/entries/${encodeURIComponent(id)}`,
        session,
        signal ? { signal } : {},
      );
    },
    update(id: string, input: UpdateEntryRequest): Promise<Entry> {
      return sessionApiRequest(`/entries/${encodeURIComponent(id)}`, session, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    delete(id: string, expectedVersion: number): Promise<EntryDeleteResult> {
      const query = new URLSearchParams({ expectedVersion: String(expectedVersion) });
      return sessionApiRequest(`/entries/${encodeURIComponent(id)}?${query}`, session, {
        method: 'DELETE',
      });
    },
  };
}

export function formatCent(amountCent: number): string {
  const sign = amountCent < 0 ? '-' : '';
  const absolute = Math.abs(amountCent);
  const yuan = Math.floor(absolute / 100).toLocaleString('zh-CN');
  return `${sign}¥ ${yuan}.${String(absolute % 100).padStart(2, '0')}`;
}

export function currentBusinessDate(timezone = 'Asia/Shanghai', now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}-${value('month')}-${value('day')}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function currentBusinessMonth(timezone = 'Asia/Shanghai', now = new Date()): string {
  return currentBusinessDate(timezone, now).slice(0, 7);
}

// Compatibility for the dashboard and the superseded list view. New entry task flows
// use createEntryApi so 401 refresh and cancellation remain centralized.
export const entryApi = {
  list(query: EntryListQuery, accessToken?: string): Promise<EntryListResult> {
    return apiRequest(`/entries?${queryString(query)}`, accessToken);
  },
};
