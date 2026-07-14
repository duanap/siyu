import type { OpenApiComponents } from '@siyu/shared-types';

import { sessionApiRequest, type ApiSession } from './api';

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
