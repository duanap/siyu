import type { OpenApiComponents } from '@siyu/shared-types';

import { sessionApiRequest, type ApiSession } from './api';
import type { EntryType, Ledger } from './entry';

export type Category = OpenApiComponents['schemas']['Category'];
export type CategoryList = OpenApiComponents['schemas']['CategoryListResponse']['data'];
type ResourceList = OpenApiComponents['schemas']['ResourceListResponse']['data'];

function isLedger(resource: ResourceList['items'][number]): resource is Ledger {
  return 'ownerUserId' in resource && 'members' in resource && 'type' in resource;
}

export async function listLedgers(session: ApiSession, signal?: AbortSignal): Promise<Ledger[]> {
  const result = await sessionApiRequest<ResourceList>(
    '/ledgers',
    session,
    signal ? { signal } : {},
  );
  return result.items.filter(isLedger);
}

export function listCategories(
  session: ApiSession,
  ledgerId: string,
  type: EntryType,
  includeDisabled = false,
  signal?: AbortSignal,
): Promise<CategoryList> {
  const query = new URLSearchParams({
    ledgerId,
    type,
    includeDisabled: String(includeDisabled),
  });
  return sessionApiRequest(`/categories?${query}`, session, signal ? { signal } : {});
}
