import type { Entry, Ledger, User } from '../entry';

export const ledger: Ledger = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'PERSONAL',
  name: '个人账本',
  ownerUserId: '22222222-2222-4222-8222-222222222222',
  status: 'ACTIVE',
  members: [
    {
      userId: '22222222-2222-4222-8222-222222222222',
      role: 'OWNER',
      joinedAt: '2026-07-01T00:00:00Z',
      nickname: '四时',
      avatarUrl: null,
    },
  ],
};
export const category = {
  id: '33333333-3333-4333-8333-333333333333',
  ledgerId: ledger.id,
  creatorUserId: null,
  type: 'EXPENSE' as const,
  name: '餐饮',
  icon: 'food' as const,
  color: '#E85D5D',
  sortOrder: 100,
  isSystem: true,
  isEnabled: true,
  canEdit: false,
  canToggle: true,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
};
export const entry: Entry = {
  id: '44444444-4444-4444-8444-444444444444',
  ledgerId: ledger.id,
  type: 'EXPENSE',
  amountCent: 1230,
  businessDate: '2026-07-14',
  note: '早餐',
  paymentMethod: 'WECHAT',
  sourceType: 'MANUAL',
  creator: { id: ledger.ownerUserId, nickname: '四时', avatarUrl: null },
  category: {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    isEnabled: true,
  },
  createdAt: '2026-07-14T01:00:00Z',
  updatedAt: '2026-07-14T01:00:00Z',
  version: 1,
  canEdit: true,
  canDelete: true,
};
export function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'req_test' }), { status });
}
export function user(): User {
  return {
    id: ledger.ownerUserId,
    nickname: '四时',
    avatarUrl: null,
    timezone: 'Asia/Shanghai',
    status: 'ACTIVE',
    email: 'user@example.com',
    roles: ['USER'],
    permissions: [],
  };
}
