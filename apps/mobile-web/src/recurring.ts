import type { OpenApiComponents } from '@siyu/shared-types';

import { sessionApiRequest, type ApiSession } from './api';

export type RecurringRule = OpenApiComponents['schemas']['RecurringRule'];
export type RecurringRun = OpenApiComponents['schemas']['RecurringRun'];
export type CreateRecurringRuleRequest = OpenApiComponents['schemas']['CreateRecurringRuleRequest'];
export type UpdateRecurringRuleRequest = OpenApiComponents['schemas']['UpdateRecurringRuleRequest'];
export type ConfirmRecurringRunRequest = OpenApiComponents['schemas']['ConfirmRecurringRunRequest'];
export type RecurringRunStatus = OpenApiComponents['schemas']['RecurringRunStatus'];
export type RecurringRuleStatus = RecurringRule['status'];
export type RecurringFrequency = RecurringRule['frequency'];
export type GenerationMode = RecurringRule['generationMode'];

export interface RecurringListResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface RecurringDeleteResult {
  id: string;
  deleted: boolean;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

function listQuery(input: {
  page: number;
  pageSize: number;
  ledgerId?: string;
  status?: RecurringRunStatus;
}): string {
  const query = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize) });
  if (input.ledgerId) query.set('ledgerId', input.ledgerId);
  if (input.status) query.set('status', input.status);
  return query.toString();
}

async function collectPages<T>(
  load: (page: number, pageSize: number, signal?: AbortSignal) => Promise<RecurringListResult<T>>,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await load(page, PAGE_SIZE, signal);
    for (const item of result.items) {
      const id = (item as { id?: unknown }).id;
      if (typeof id !== 'string' || seen.has(id)) continue;
      seen.add(id);
      items.push(item);
    }
    if (!result.hasNext) return items;
  }
  throw new Error('周期记录过多，无法完整加载');
}

export function createRecurringApi(session: ApiSession) {
  const api = {
    listRules(
      ledgerId: string,
      page = 1,
      pageSize = PAGE_SIZE,
      signal?: AbortSignal,
    ): Promise<RecurringListResult<RecurringRule>> {
      const query = listQuery({ ledgerId, page, pageSize });
      return sessionApiRequest(`/recurring-rules?${query}`, session, signal ? { signal } : {});
    },
    listAllRules(ledgerId: string, signal?: AbortSignal): Promise<RecurringRule[]> {
      return collectPages(
        (page, pageSize, currentSignal) => api.listRules(ledgerId, page, pageSize, currentSignal),
        signal,
      );
    },
    createRule(input: CreateRecurringRuleRequest): Promise<RecurringRule> {
      return sessionApiRequest('/recurring-rules', session, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    getRule(id: string, signal?: AbortSignal): Promise<RecurringRule> {
      return sessionApiRequest(
        `/recurring-rules/${encodeURIComponent(id)}`,
        session,
        signal ? { signal } : {},
      );
    },
    updateRule(id: string, input: UpdateRecurringRuleRequest): Promise<RecurringRule> {
      return sessionApiRequest(`/recurring-rules/${encodeURIComponent(id)}`, session, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    pauseRule(id: string): Promise<RecurringRule> {
      return sessionApiRequest(`/recurring-rules/${encodeURIComponent(id)}/pause`, session, {
        method: 'POST',
      });
    },
    resumeRule(id: string): Promise<RecurringRule> {
      return sessionApiRequest(`/recurring-rules/${encodeURIComponent(id)}/resume`, session, {
        method: 'POST',
      });
    },
    deleteRule(id: string): Promise<RecurringDeleteResult> {
      return sessionApiRequest(`/recurring-rules/${encodeURIComponent(id)}`, session, {
        method: 'DELETE',
      });
    },
    listRuns(
      page = 1,
      pageSize = PAGE_SIZE,
      status?: RecurringRunStatus,
      signal?: AbortSignal,
    ): Promise<RecurringListResult<RecurringRun>> {
      const query = listQuery({ page, pageSize, ...(status ? { status } : {}) });
      return sessionApiRequest(`/recurring-runs?${query}`, session, signal ? { signal } : {});
    },
    listAllRuns(status?: RecurringRunStatus, signal?: AbortSignal): Promise<RecurringRun[]> {
      return collectPages(
        (page, pageSize, currentSignal) => api.listRuns(page, pageSize, status, currentSignal),
        signal,
      );
    },
    confirmRun(id: string, input: ConfirmRecurringRunRequest): Promise<RecurringRun> {
      return sessionApiRequest(`/recurring-runs/${encodeURIComponent(id)}/confirm`, session, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    skipRun(id: string): Promise<RecurringRun> {
      return sessionApiRequest(`/recurring-runs/${encodeURIComponent(id)}/skip`, session, {
        method: 'POST',
      });
    },
  };
  return api;
}

export function recurringStatusLabel(status: RecurringRuleStatus): string {
  return {
    ACTIVE: '进行中',
    PAUSED: '已暂停',
    COMPLETED: '已完成',
    CANCELLED: '已结束',
  }[status];
}

export function recurringRunStatusLabel(status: RecurringRunStatus): string {
  return {
    PENDING: '待确认',
    GENERATED: '已自动入账',
    CONFIRMED: '已确认入账',
    SKIPPED: '已跳过',
    FAILED: '生成失败',
  }[status];
}

export function recurringFrequencyLabel(frequency: RecurringFrequency, intervalValue: number) {
  const unit = frequency === 'MONTHLY' ? '月' : '年';
  return intervalValue === 1 ? `每${unit}` : `每 ${intervalValue} ${unit}`;
}

export function generationModeLabel(mode: GenerationMode): string {
  return mode === 'AUTO' ? '自动记账' : '到期确认';
}

export function recurringProgressLabel(rule: RecurringRule): string {
  if (rule.totalOccurrences === null) return `已执行 ${rule.completedOccurrences} 期`;
  return `第 ${Math.min(rule.completedOccurrences + 1, rule.totalOccurrences)}/${rule.totalOccurrences} 期 · 已执行 ${rule.completedOccurrences} 期`;
}
