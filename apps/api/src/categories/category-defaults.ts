import type { EntryType, Prisma } from '@prisma/client';

export const CATEGORY_ICON_KEYS = [
  'food',
  'shopping',
  'transport',
  'housing',
  'entertainment',
  'medical',
  'education',
  'gift',
  'salary',
  'bonus',
  'part_time',
  'investment',
  'red_packet',
  'refund',
  'other',
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

interface CategoryTemplate {
  type: EntryType;
  templateKey: string;
  name: string;
  icon: CategoryIconKey;
  color: string;
  sortOrder: number;
}

export const DEFAULT_CATEGORY_TEMPLATES: readonly CategoryTemplate[] = [
  {
    type: 'EXPENSE',
    templateKey: 'expense.food',
    name: '餐饮',
    icon: 'food',
    color: '#E85D5D',
    sortOrder: 100,
  },
  {
    type: 'EXPENSE',
    templateKey: 'expense.shopping',
    name: '购物',
    icon: 'shopping',
    color: '#EC4899',
    sortOrder: 200,
  },
  {
    type: 'EXPENSE',
    templateKey: 'expense.transport',
    name: '交通',
    icon: 'transport',
    color: '#3B82F6',
    sortOrder: 300,
  },
  {
    type: 'EXPENSE',
    templateKey: 'expense.housing',
    name: '居住',
    icon: 'housing',
    color: '#8B5CF6',
    sortOrder: 400,
  },
  {
    type: 'EXPENSE',
    templateKey: 'expense.entertainment',
    name: '娱乐',
    icon: 'entertainment',
    color: '#F5A623',
    sortOrder: 500,
  },
  {
    type: 'EXPENSE',
    templateKey: 'expense.medical',
    name: '医疗',
    icon: 'medical',
    color: '#22A06B',
    sortOrder: 600,
  },
  {
    type: 'EXPENSE',
    templateKey: 'expense.education',
    name: '教育',
    icon: 'education',
    color: '#5B7CFA',
    sortOrder: 700,
  },
  {
    type: 'EXPENSE',
    templateKey: 'expense.gift',
    name: '人情',
    icon: 'gift',
    color: '#E67E22',
    sortOrder: 800,
  },
  {
    type: 'EXPENSE',
    templateKey: 'expense.other',
    name: '其他支出',
    icon: 'other',
    color: '#64748B',
    sortOrder: 900,
  },
  {
    type: 'INCOME',
    templateKey: 'income.salary',
    name: '工资',
    icon: 'salary',
    color: '#22A06B',
    sortOrder: 100,
  },
  {
    type: 'INCOME',
    templateKey: 'income.bonus',
    name: '奖金',
    icon: 'bonus',
    color: '#F5A623',
    sortOrder: 200,
  },
  {
    type: 'INCOME',
    templateKey: 'income.part_time',
    name: '兼职',
    icon: 'part_time',
    color: '#3B82F6',
    sortOrder: 300,
  },
  {
    type: 'INCOME',
    templateKey: 'income.investment',
    name: '理财',
    icon: 'investment',
    color: '#8B5CF6',
    sortOrder: 400,
  },
  {
    type: 'INCOME',
    templateKey: 'income.red_packet',
    name: '红包',
    icon: 'red_packet',
    color: '#E85D5D',
    sortOrder: 500,
  },
  {
    type: 'INCOME',
    templateKey: 'income.refund',
    name: '退款',
    icon: 'refund',
    color: '#5B7CFA',
    sortOrder: 600,
  },
  {
    type: 'INCOME',
    templateKey: 'income.other',
    name: '其他收入',
    icon: 'other',
    color: '#64748B',
    sortOrder: 700,
  },
] as const;

export async function initializeDefaultCategories(
  tx: Prisma.TransactionClient,
  ledgerId: string,
): Promise<void> {
  for (const type of ['EXPENSE', 'INCOME'] as const) {
    const lockKey = `siyu:category-order:${ledgerId}:${type}`;
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const active = await tx.category.findMany({
      where: { ledgerId, type, isEnabled: true },
      select: { name: true },
    });
    const activeNames = new Set(active.map(({ name }) => name.toLocaleLowerCase()));
    await tx.category.createMany({
      data: DEFAULT_CATEGORY_TEMPLATES.filter((template) => template.type === type).map(
        (template) => ({
          ledgerId,
          type: template.type,
          name: template.name,
          icon: template.icon,
          color: template.color,
          sortOrder: template.sortOrder,
          isSystem: true,
          isEnabled: !activeNames.has(template.name.toLocaleLowerCase()),
          templateKey: template.templateKey,
          templateVersion: 1,
        }),
      ),
      skipDuplicates: true,
    });
  }
}
