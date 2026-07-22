import type { OpenApiComponents } from '@siyu/shared-types';

import { sessionApiRequest, type ApiSession } from './api';

export type Debt = OpenApiComponents['schemas']['Debt'];
export type DebtTransaction = OpenApiComponents['schemas']['DebtTransaction'];
export type CreateDebtRequest = OpenApiComponents['schemas']['CreateDebtRequest'];
export type UpdateDebtRequest = OpenApiComponents['schemas']['UpdateDebtRequest'];
export type CreateDebtTransactionRequest =
  OpenApiComponents['schemas']['CreateDebtTransactionRequest'];
export type DebtDirection = Debt['direction'];

export interface DebtListResult {
  items: Debt[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface DebtDeleteResult {
  id: string;
  deleted: boolean;
}

export interface DebtTransactionResult {
  debt: Debt;
  transaction: DebtTransaction;
}

export interface DebtSummary {
  totalDebtCent: number;
  totalReceivableCent: number;
  paidThisMonthCent: number;
  receivedThisMonthCent: number;
  dueSoonCount: number;
  overdueCount: number;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

function safeCentSum(values: number[]): number {
  const sum = values.reduce((total, value) => total + BigInt(value), 0n);
  if (sum > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('借贷汇总金额超过可显示范围');
  return Number(sum);
}

function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function summarizeDebts(details: Debt[], month: string, today: string): DebtSummary {
  const open = details.filter((debt) => debt.status !== 'SETTLED' && debt.status !== 'CANCELLED');
  const transactions = details.flatMap((debt) =>
    (debt.transactions ?? []).map((transaction) => ({ direction: debt.direction, transaction })),
  );
  const dueSoonEnd = addCalendarDays(today, 6);
  return {
    totalDebtCent: safeCentSum(
      open.filter((debt) => debt.direction === 'BORROWED').map((debt) => debt.remainingCent),
    ),
    totalReceivableCent: safeCentSum(
      open.filter((debt) => debt.direction === 'LENT').map((debt) => debt.remainingCent),
    ),
    paidThisMonthCent: safeCentSum(
      transactions
        .filter(
          ({ direction, transaction }) =>
            direction === 'BORROWED' && transaction.businessDate.startsWith(month),
        )
        .map(({ transaction }) => transaction.amountCent),
    ),
    receivedThisMonthCent: safeCentSum(
      transactions
        .filter(
          ({ direction, transaction }) =>
            direction === 'LENT' && transaction.businessDate.startsWith(month),
        )
        .map(({ transaction }) => transaction.amountCent),
    ),
    dueSoonCount: open.filter(
      (debt) =>
        debt.overdueDays === 0 &&
        debt.dueDate !== null &&
        debt.dueDate >= today &&
        debt.dueDate <= dueSoonEnd,
    ).length,
    overdueCount: open.filter((debt) => debt.overdueDays > 0).length,
  };
}

export function createDebtApi(session: ApiSession) {
  return {
    list(page = 1, pageSize = PAGE_SIZE, signal?: AbortSignal): Promise<DebtListResult> {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      return sessionApiRequest(`/debts?${query}`, session, signal ? { signal } : {});
    },
    async listAll(signal?: AbortSignal): Promise<Debt[]> {
      const items: Debt[] = [];
      const seen = new Set<string>();
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const result = await this.list(page, PAGE_SIZE, signal);
        for (const debt of result.items) {
          if (!seen.has(debt.id)) {
            seen.add(debt.id);
            items.push(debt);
          }
        }
        if (!result.hasNext) return items;
      }
      throw new Error('借贷记录过多，无法完整加载统计');
    },
    create(input: CreateDebtRequest): Promise<Debt> {
      return sessionApiRequest('/debts', session, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    get(id: string, signal?: AbortSignal): Promise<Debt> {
      return sessionApiRequest(
        `/debts/${encodeURIComponent(id)}`,
        session,
        signal ? { signal } : {},
      );
    },
    update(id: string, input: UpdateDebtRequest): Promise<Debt> {
      return sessionApiRequest(`/debts/${encodeURIComponent(id)}`, session, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    delete(id: string): Promise<DebtDeleteResult> {
      return sessionApiRequest(`/debts/${encodeURIComponent(id)}`, session, { method: 'DELETE' });
    },
    createTransaction(
      id: string,
      input: CreateDebtTransactionRequest,
    ): Promise<DebtTransactionResult> {
      return sessionApiRequest(`/debts/${encodeURIComponent(id)}/transactions`, session, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
  };
}

export function debtDirectionLabel(direction: DebtDirection): string {
  return direction === 'BORROWED' ? '我欠别人的' : '别人欠我的';
}

export function debtActionLabel(direction: DebtDirection): string {
  return direction === 'BORROWED' ? '还款' : '收款';
}

export function debtStatusLabel(debt: Debt): string {
  if (debt.status === 'SETTLED') return '已结清';
  if (debt.overdueDays > 0) return `已逾期 ${debt.overdueDays} 天`;
  if (debt.dueDate) return `${debt.dueDate} 到期`;
  return '进行中';
}
