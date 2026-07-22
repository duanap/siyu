import type { OpenApiComponents } from '@siyu/shared-types';

import { sessionApiRequest, type ApiSession } from './api';
import { MAX_SAFE_CENT } from './entry-money';

export type SavingGoal = OpenApiComponents['schemas']['SavingGoal'];
export type SavingGoalDetail = OpenApiComponents['schemas']['SavingGoalDetail'];
export type SavingContribution = OpenApiComponents['schemas']['SavingContribution'];
export type CreateSavingGoalRequest = OpenApiComponents['schemas']['CreateSavingGoalRequest'];
export type UpdateSavingGoalRequest = OpenApiComponents['schemas']['UpdateSavingGoalRequest'];
export type CreateSavingContributionRequest =
  OpenApiComponents['schemas']['CreateSavingContributionRequest'];
export type UpdateSavingContributionRequest =
  OpenApiComponents['schemas']['UpdateSavingContributionRequest'];
export type SavingGoalListResult = OpenApiComponents['schemas']['SavingGoalListResponse']['data'];
export type SavingDeleteResult = OpenApiComponents['schemas']['SavingDeleteResponse']['data'];

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

export type SavingAmountParseResult =
  { ok: true; amountCent: number; normalized: string } | { ok: false; message: string };

export function parseSavingAmount(value: string, allowZero = false): SavingAmountParseResult {
  let normalized = value.trim();
  if (!normalized) return { ok: false, message: '请输入金额' };
  if (/[-+eE,]/.test(normalized) || !/^\d+(?:\.\d{0,2})?$/.test(normalized)) {
    return { ok: false, message: '金额只能包含数字和最多两位小数' };
  }
  if (normalized.endsWith('.')) normalized = normalized.slice(0, -1);
  const [wholeRaw = '0', fractionRaw = ''] = normalized.split('.');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || '0';
  const fraction = fractionRaw.padEnd(2, '0');
  const amount = BigInt(whole) * 100n + BigInt(fraction || '0');
  if (!allowZero && amount === 0n) return { ok: false, message: '金额必须大于 0' };
  if (amount > MAX_SAFE_CENT) return { ok: false, message: '金额超过可保存上限' };
  return {
    ok: true,
    amountCent: Number(amount),
    normalized: fractionRaw ? `${whole}.${fraction}` : whole,
  };
}

export function formatSavingCent(amountCent: number | bigint): string {
  const value = typeof amountCent === 'bigint' ? amountCent : BigInt(amountCent);
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = String(absolute / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = String(absolute % 100n).padStart(2, '0');
  return `${sign}¥ ${whole}.${fraction}`;
}

export function formatSavingProgress(progressBasisPoints: number): string {
  if (!Number.isInteger(progressBasisPoints) || progressBasisPoints < 0) return '进度异常';
  const whole = Math.floor(progressBasisPoints / 100);
  const fraction = String(progressBasisPoints % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}%`;
}

export function savingGoalStatusLabel(status: SavingGoal['status']): string {
  return { ACTIVE: '进行中', COMPLETED: '已完成', CANCELLED: '已取消' }[status];
}

export function createSavingGoalsApi(session: ApiSession) {
  const api = {
    list(
      ledgerId: string,
      page = 1,
      pageSize = PAGE_SIZE,
      signal?: AbortSignal,
    ): Promise<SavingGoalListResult> {
      const query = new URLSearchParams({
        ledgerId,
        page: String(page),
        pageSize: String(pageSize),
      });
      return sessionApiRequest(`/saving-goals?${query}`, session, signal ? { signal } : {});
    },
    async listAll(ledgerId: string, signal?: AbortSignal): Promise<SavingGoal[]> {
      const items: SavingGoal[] = [];
      const seen = new Set<string>();
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const result = await api.list(ledgerId, page, PAGE_SIZE, signal);
        for (const item of result.items) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          items.push(item);
        }
        if (!result.hasNext) return items;
      }
      throw new Error('攒钱目标过多，无法完整加载');
    },
    create(input: CreateSavingGoalRequest): Promise<SavingGoal> {
      return sessionApiRequest('/saving-goals', session, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    get(id: string, signal?: AbortSignal): Promise<SavingGoalDetail> {
      return sessionApiRequest(
        `/saving-goals/${encodeURIComponent(id)}`,
        session,
        signal ? { signal } : {},
      );
    },
    update(id: string, input: UpdateSavingGoalRequest): Promise<SavingGoalDetail> {
      return sessionApiRequest(`/saving-goals/${encodeURIComponent(id)}`, session, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    delete(id: string): Promise<SavingDeleteResult> {
      return sessionApiRequest(`/saving-goals/${encodeURIComponent(id)}`, session, {
        method: 'DELETE',
      });
    },
    addContribution(
      goalId: string,
      input: CreateSavingContributionRequest,
    ): Promise<SavingContribution> {
      return sessionApiRequest(
        `/saving-goals/${encodeURIComponent(goalId)}/contributions`,
        session,
        { method: 'POST', body: JSON.stringify(input) },
      );
    },
    updateContribution(
      goalId: string,
      id: string,
      input: UpdateSavingContributionRequest,
    ): Promise<SavingContribution> {
      return sessionApiRequest(
        `/saving-goals/${encodeURIComponent(goalId)}/contributions/${encodeURIComponent(id)}`,
        session,
        { method: 'PATCH', body: JSON.stringify(input) },
      );
    },
    deleteContribution(goalId: string, id: string): Promise<SavingDeleteResult> {
      return sessionApiRequest(
        `/saving-goals/${encodeURIComponent(goalId)}/contributions/${encodeURIComponent(id)}`,
        session,
        { method: 'DELETE' },
      );
    },
  };
  return api;
}
