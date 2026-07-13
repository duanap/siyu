import { apiRequest } from './api';

export type CategoryType = 'EXPENSE' | 'INCOME';

export const CATEGORY_ICONS = [
  ['food', '餐饮', '餐'],
  ['shopping', '购物', '购'],
  ['transport', '交通', '行'],
  ['housing', '居住', '居'],
  ['entertainment', '娱乐', '乐'],
  ['medical', '医疗', '医'],
  ['education', '教育', '学'],
  ['gift', '人情', '礼'],
  ['salary', '工资', '薪'],
  ['bonus', '奖金', '奖'],
  ['part_time', '兼职', '兼'],
  ['investment', '理财', '财'],
  ['red_packet', '红包', '包'],
  ['refund', '退款', '退'],
  ['other', '其他', '其'],
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number][0];

export const CATEGORY_COLORS = [
  '#E85D5D',
  '#EC4899',
  '#3B82F6',
  '#8B5CF6',
  '#F5A623',
  '#22A06B',
  '#5B7CFA',
  '#E67E22',
  '#64748B',
] as const;

export interface Category {
  id: string;
  ledgerId: string;
  creatorUserId: string | null;
  type: CategoryType;
  name: string;
  icon: CategoryIcon;
  color: string;
  sortOrder: number;
  isSystem: boolean;
  isEnabled: boolean;
  canEdit: boolean;
  canToggle: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryList {
  items: Category[];
  permissions: { canCreate: boolean; canReorder: boolean };
}

export function categoryGlyph(icon: CategoryIcon): string {
  return CATEGORY_ICONS.find(([key]) => key === icon)?.[2] ?? '其';
}

function idempotencyKey(): string {
  return `category-${crypto.randomUUID()}`;
}

export const categoryApi = {
  list(
    ledgerId: string,
    type: CategoryType,
    includeDisabled: boolean,
    accessToken?: string,
  ): Promise<CategoryList> {
    const query = new URLSearchParams({
      ledgerId,
      type,
      includeDisabled: String(includeDisabled),
    });
    return apiRequest(`/categories?${query}`, accessToken);
  },

  create(
    input: Pick<Category, 'ledgerId' | 'type' | 'name' | 'icon' | 'color'>,
    accessToken?: string,
  ): Promise<Category> {
    return apiRequest('/categories', accessToken, {
      method: 'POST',
      body: JSON.stringify({ ...input, idempotencyKey: idempotencyKey() }),
    });
  },

  update(
    id: string,
    input: Pick<Category, 'name' | 'icon' | 'color'>,
    accessToken?: string,
  ): Promise<Category> {
    return apiRequest(`/categories/${id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  reorder(
    ledgerId: string,
    type: CategoryType,
    categoryIds: string[],
    accessToken?: string,
  ): Promise<CategoryList> {
    return apiRequest('/categories/reorder', accessToken, {
      method: 'PUT',
      body: JSON.stringify({ ledgerId, type, categoryIds }),
    });
  },

  setEnabled(id: string, enabled: boolean, accessToken?: string): Promise<Category> {
    return apiRequest(`/categories/${id}/${enabled ? 'enable' : 'disable'}`, accessToken, {
      method: 'POST',
    });
  },
};
