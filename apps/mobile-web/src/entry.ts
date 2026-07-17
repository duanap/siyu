import { apiRequest } from './api';
import type { CategoryIcon, CategoryType } from './category';

export type EntryType = CategoryType;
export type EntryPaymentMethod = 'CASH' | 'WECHAT' | 'ALIPAY' | 'BANK_CARD' | 'OTHER';
export type EntrySourceType = 'MANUAL' | 'SALARY' | 'DEBT_TRANSACTION' | 'RECURRING_RUN';

export interface Entry {
  id: string;
  ledgerId: string;
  type: EntryType;
  amountCent: number;
  businessDate: string;
  note: string | null;
  paymentMethod: EntryPaymentMethod | null;
  sourceType: EntrySourceType;
  creator: { id: string; nickname: string; avatarUrl: string | null };
  category: {
    id: string;
    name: string;
    icon: CategoryIcon;
    color: string;
    isEnabled: boolean;
  };
  createdAt: string;
  updatedAt: string;
  version: number;
  canEdit: boolean;
  canDelete: boolean;
}

export interface EntryList {
  items: Entry[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

export interface EntryFilters {
  ledgerId: string;
  month?: string;
  type?: EntryType;
  categoryId?: string;
  creatorUserId?: string;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface EntryDraft {
  ledgerId: string;
  type: EntryType;
  amountCent: number;
  categoryId: string;
  businessDate: string;
  note: string | null;
  paymentMethod: EntryPaymentMethod | null;
}

export const PAYMENT_METHODS: ReadonlyArray<[EntryPaymentMethod, string]> = [
  ['CASH', '现金'],
  ['WECHAT', '微信'],
  ['ALIPAY', '支付宝'],
  ['BANK_CARD', '银行卡'],
  ['OTHER', '其他'],
];

export function paymentMethodLabel(value: EntryPaymentMethod | null): string {
  return PAYMENT_METHODS.find(([key]) => key === value)?.[1] ?? '未记录';
}

export function formatCent(amountCent: number): string {
  const sign = amountCent < 0 ? '-' : '';
  const absolute = Math.abs(amountCent);
  const yuan = Math.floor(absolute / 100).toLocaleString('zh-CN');
  return `${sign}¥ ${yuan}.${String(absolute % 100).padStart(2, '0')}`;
}

export function amountTextToCent(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [yuan = '0', decimal = ''] = normalized.split('.');
  const amount = Number(yuan) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function centToAmountText(amountCent: number): string {
  const yuan = Math.floor(amountCent / 100);
  const decimal = amountCent % 100;
  return decimal === 0 ? String(yuan) : `${yuan}.${String(decimal).padStart(2, '0')}`;
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

export function newEntryIdempotencyKey(): string {
  return `entry-${crypto.randomUUID()}`;
}

export const entryApi = {
  list(filters: EntryFilters, accessToken?: string): Promise<EntryList> {
    const query = new URLSearchParams({ ledgerId: filters.ledgerId });
    if (filters.month) query.set('month', filters.month);
    if (filters.type) query.set('type', filters.type);
    if (filters.categoryId) query.set('categoryId', filters.categoryId);
    if (filters.creatorUserId) query.set('creatorUserId', filters.creatorUserId);
    if (filters.keyword?.trim()) query.set('keyword', filters.keyword.trim());
    if (filters.page) query.set('page', String(filters.page));
    if (filters.pageSize) query.set('pageSize', String(filters.pageSize));
    return apiRequest(`/entries?${query}`, accessToken);
  },

  get(id: string, accessToken?: string): Promise<Entry> {
    return apiRequest(`/entries/${id}`, accessToken);
  },

  create(
    input: EntryDraft,
    accessToken?: string,
    idempotencyKey = newEntryIdempotencyKey(),
  ): Promise<Entry> {
    return apiRequest('/entries', accessToken, {
      method: 'POST',
      body: JSON.stringify({ ...input, idempotencyKey }),
    });
  },

  update(
    id: string,
    input: EntryDraft & { expectedVersion: number },
    accessToken?: string,
  ): Promise<Entry> {
    const body = {
      type: input.type,
      amountCent: input.amountCent,
      categoryId: input.categoryId,
      businessDate: input.businessDate,
      note: input.note,
      paymentMethod: input.paymentMethod,
      expectedVersion: input.expectedVersion,
    };
    return apiRequest(`/entries/${id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  delete(id: string, expectedVersion: number, accessToken?: string): Promise<void> {
    const query = new URLSearchParams({ expectedVersion: String(expectedVersion) });
    return apiRequest(`/entries/${id}?${query}`, accessToken, { method: 'DELETE' });
  },
};
