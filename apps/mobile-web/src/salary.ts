import type { OpenApiComponents } from '@siyu/shared-types';

import { sessionApiRequest, type ApiSession } from './api';

export type SalaryProfile = OpenApiComponents['schemas']['SalaryProfile'];
export type SalaryProfileItem = OpenApiComponents['schemas']['SalaryProfileItem'];
export type SalaryRecord = OpenApiComponents['schemas']['SalaryRecord'];
export type SalaryItem = OpenApiComponents['schemas']['SalaryItem'];
export type SalaryAnnualSummary = OpenApiComponents['schemas']['SalaryAnnualSummary'];
export type SalaryBalance = OpenApiComponents['schemas']['SalaryBalance'];
export type SalaryTemplateItemInput = OpenApiComponents['schemas']['SalaryTemplateItemInput'];
export type SalaryRecordItemInput = OpenApiComponents['schemas']['SalaryRecordItemInput'];
export type CreateSalaryProfileRequest = OpenApiComponents['schemas']['CreateSalaryProfileRequest'];
export type UpdateSalaryProfileRequest = OpenApiComponents['schemas']['UpdateSalaryProfileRequest'];
export type CreateSalaryRecordRequest = OpenApiComponents['schemas']['CreateSalaryRecordRequest'];
export type UpdateSalaryRecordRequest = OpenApiComponents['schemas']['UpdateSalaryRecordRequest'];
export type MarkSalaryPaidRequest = OpenApiComponents['schemas']['MarkSalaryPaidRequest'];

export interface EditableSalaryItem {
  itemType: 'EARNING' | 'DEDUCTION';
  itemCode: string;
  itemName: string;
  amount: string;
}

type SalaryRecordList = OpenApiComponents['schemas']['SalaryRecordListResponse']['data'];
type SalaryProfileList = OpenApiComponents['schemas']['SalaryProfileListResponse']['data'];

export interface SalaryRecordQuery {
  year?: number;
  profileId?: string;
}

function queryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

export function createSalaryApi(session: ApiSession) {
  return {
    async listProfiles(signal?: AbortSignal): Promise<SalaryProfile[]> {
      const result = await sessionApiRequest<SalaryProfileList>(
        '/salary/profiles',
        session,
        signal ? { signal } : {},
      );
      return result.items;
    },
    createProfile(input: CreateSalaryProfileRequest): Promise<SalaryProfile> {
      return sessionApiRequest('/salary/profiles', session, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    updateProfile(id: string, input: UpdateSalaryProfileRequest): Promise<SalaryProfile> {
      return sessionApiRequest(`/salary/profiles/${encodeURIComponent(id)}`, session, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    async listAllRecords(
      query: SalaryRecordQuery = {},
      signal?: AbortSignal,
    ): Promise<SalaryRecord[]> {
      const items: SalaryRecord[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext && page <= 100) {
        const search = queryString({ ...query, page, pageSize: 100 });
        const result = await sessionApiRequest<SalaryRecordList>(
          `/salary/records?${search}`,
          session,
          signal ? { signal } : {},
        );
        items.push(...result.items);
        hasNext = result.hasNext;
        page += 1;
      }
      return [...new Map(items.map((item) => [item.id, item])).values()];
    },
    getRecord(id: string, signal?: AbortSignal): Promise<SalaryRecord> {
      return sessionApiRequest(
        `/salary/records/${encodeURIComponent(id)}`,
        session,
        signal ? { signal } : {},
      );
    },
    createRecord(input: CreateSalaryRecordRequest): Promise<SalaryRecord> {
      return sessionApiRequest('/salary/records', session, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    updateRecord(id: string, input: UpdateSalaryRecordRequest): Promise<SalaryRecord> {
      return sessionApiRequest(`/salary/records/${encodeURIComponent(id)}`, session, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    markPaid(id: string, input: MarkSalaryPaidRequest): Promise<SalaryRecord> {
      return sessionApiRequest(`/salary/records/${encodeURIComponent(id)}/mark-paid`, session, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    summary(year: number, signal?: AbortSignal): Promise<SalaryAnnualSummary> {
      return sessionApiRequest(
        `/salary/summary/${encodeURIComponent(String(year))}`,
        session,
        signal ? { signal } : {},
      );
    },
    balance(signal?: AbortSignal): Promise<SalaryBalance> {
      return sessionApiRequest('/salary/balance', session, signal ? { signal } : {});
    },
  };
}

export const DEFAULT_SALARY_TEMPLATE: SalaryTemplateItemInput[] = [
  {
    itemType: 'EARNING',
    itemCode: 'base_salary',
    itemName: '基本工资',
    amountCent: 0,
    sortOrder: 0,
  },
  { itemType: 'EARNING', itemCode: 'bonus', itemName: '奖金', amountCent: 0, sortOrder: 1 },
  {
    itemType: 'DEDUCTION',
    itemCode: 'pension_insurance',
    itemName: '养老保险',
    amountCent: 0,
    sortOrder: 2,
  },
  {
    itemType: 'DEDUCTION',
    itemCode: 'medical_insurance',
    itemName: '医疗保险',
    amountCent: 0,
    sortOrder: 3,
  },
  {
    itemType: 'DEDUCTION',
    itemCode: 'unemployment_insurance',
    itemName: '失业保险',
    amountCent: 0,
    sortOrder: 4,
  },
  {
    itemType: 'DEDUCTION',
    itemCode: 'housing_provident_fund',
    itemName: '住房公积金',
    amountCent: 0,
    sortOrder: 5,
  },
  {
    itemType: 'DEDUCTION',
    itemCode: 'income_tax',
    itemName: '个人所得税',
    amountCent: 0,
    sortOrder: 6,
  },
];

export function formatSalaryCent(amountCent: number): string {
  if (!Number.isSafeInteger(amountCent)) return '金额异常';
  const sign = amountCent < 0 ? '-' : '';
  const absolute = Math.abs(amountCent);
  return `${sign}¥ ${Math.floor(absolute / 100).toLocaleString('zh-CN')}.${String(absolute % 100).padStart(2, '0')}`;
}

export function salaryAmountInput(amountCent: number): string {
  if (!Number.isSafeInteger(amountCent) || amountCent < 0) return '';
  return (amountCent / 100).toFixed(2);
}

export type SalaryAmountResult = { ok: true; amountCent: number } | { ok: false; message: string };

export function parseSalaryAmount(value: string, allowZero: boolean): SalaryAmountResult {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
    return { ok: false, message: '请输入最多两位小数的金额' };
  const [yuan, decimal = ''] = normalized.split('.');
  const amountCent = Number(yuan) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(amountCent)) return { ok: false, message: '金额超出可保存范围' };
  if (amountCent < 0 || (!allowZero && amountCent === 0))
    return { ok: false, message: allowZero ? '金额不能小于 0' : '金额必须大于 0' };
  return { ok: true, amountCent };
}

export function editableSalaryItems(
  items: Array<SalaryTemplateItemInput | SalaryProfileItem | SalaryItem>,
): EditableSalaryItem[] {
  return items.map((item) => ({
    itemType: item.itemType,
    itemCode: item.itemCode,
    itemName: item.itemName,
    amount: salaryAmountInput(item.amountCent),
  }));
}

export function salaryItemsInput(
  items: EditableSalaryItem[],
  allowZero: boolean,
): { ok: true; items: SalaryTemplateItemInput[] } | { ok: false; message: string } {
  if (!items.length) return { ok: false, message: '至少保留一个工资项目' };
  if (items.length > 50) return { ok: false, message: '工资项目最多 50 项' };
  const seen = new Set<string>();
  let earningCent = 0;
  let deductionCent = 0;
  const normalized: SalaryTemplateItemInput[] = [];
  for (const [sortOrder, item] of items.entries()) {
    const itemCode = item.itemCode.trim().toLowerCase();
    const itemName = item.itemName.trim();
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(itemCode))
      return {
        ok: false,
        message: `“${itemName || '未命名项目'}”的代码需使用小写字母、数字和下划线`,
      };
    if (!itemName || itemName.length > 100)
      return { ok: false, message: '项目名称应为 1 到 100 个字符' };
    if (seen.has(itemCode)) return { ok: false, message: `项目代码 ${itemCode} 不能重复` };
    seen.add(itemCode);
    const parsed = parseSalaryAmount(item.amount, true);
    if (!parsed.ok) return { ok: false, message: `“${itemName}”：${parsed.message}` };
    if (!allowZero && parsed.amountCent === 0) continue;
    if (item.itemType === 'EARNING') earningCent += parsed.amountCent;
    else deductionCent += parsed.amountCent;
    normalized.push({
      itemType: item.itemType,
      itemCode,
      itemName,
      amountCent: parsed.amountCent,
      sortOrder,
    });
  }
  if (!normalized.some((item) => item.itemType === 'EARNING'))
    return { ok: false, message: '至少需要一个收入项目' };
  if (!allowZero && earningCent <= 0) return { ok: false, message: '应发工资必须大于 0' };
  if (!allowZero && deductionCent > earningCent)
    return { ok: false, message: '扣除合计不能大于应发工资' };
  return { ok: true, items: normalized };
}

export function parseSalaryRoute(
  year: unknown,
  month?: unknown,
): { year: number; month?: number } | null {
  const yearText = String(year ?? '');
  if (!/^\d{4}$/.test(yearText)) return null;
  const parsedYear = Number(yearText);
  if (parsedYear < 2000 || parsedYear > 9999) return null;
  if (month === undefined) return { year: parsedYear };
  const monthText = String(month);
  if (!/^(0[1-9]|1[0-2])$/.test(monthText)) return null;
  return { year: parsedYear, month: Number(monthText) };
}

export function salaryMonthDate(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
}

export function salaryMonthLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${Number(match[1])} 年 ${Number(match[2])} 月` : value;
}
