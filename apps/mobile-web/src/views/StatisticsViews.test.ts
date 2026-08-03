import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../auth';
import DashboardView from './DashboardView.vue';
import StatisticsView from './StatisticsView.vue';

const routerState = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  replace: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routerState.query }),
  useRouter: () => ({ replace: routerState.replace }),
}));

function response(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify(
      status < 400
        ? { success: true, data, requestId: 'req_test' }
        : {
            success: false,
            code: 'RESOURCE_NOT_FOUND',
            message: '账本不存在',
            details: {},
            requestId: 'req_test',
          },
    ),
    { status },
  );
}

const ledger = {
  id: '00000000-0000-4000-8000-000000000010',
  type: 'COUPLE',
  name: '我们的超长朝暮同笺账本名称',
  ownerUserId: 'user-owner',
  status: 'ACTIVE',
  members: [
    {
      userId: 'user-owner',
      role: 'OWNER',
      joinedAt: '2026-07-01T00:00:00Z',
      nickname: '朝暮',
      avatarUrl: null,
    },
    {
      userId: 'user-partner',
      role: 'MEMBER',
      joinedAt: '2026-07-01T00:00:00Z',
      nickname: '这是一个用于验证长文本的成员昵称',
      avatarUrl: null,
    },
  ],
};

const overview = {
  ledgerId: ledger.id,
  ledgerType: 'COUPLE',
  month: '2026-07',
  incomeCent: 800_000,
  expenseCent: 473_200,
  balanceCent: 326_800,
  averageDailyExpenseCent: 31_546,
  largestExpenseCent: 220_000,
  entryCount: 2,
};

const members = {
  ledgerId: ledger.id,
  ledgerType: 'COUPLE',
  month: '2026-07',
  totalCent: 473_200,
  items: [
    {
      userId: 'user-owner',
      nickname: '朝暮',
      avatarUrl: null,
      memberStatus: 'ACTIVE',
      isCurrentUser: true,
      amountCent: 248_000,
      basisPoints: 5241,
      entryCount: 1,
    },
    {
      userId: 'user-partner',
      nickname: '这是一个用于验证长文本的成员昵称',
      avatarUrl: null,
      memberStatus: 'ACTIVE',
      isCurrentUser: false,
      amountCent: 225_200,
      basisPoints: 4758,
      entryCount: 1,
    },
  ],
};

const entry = {
  id: '00000000-0000-4000-8000-000000000020',
  ledgerId: ledger.id,
  type: 'EXPENSE',
  amountCent: 16_800,
  businessDate: '2026-07-15',
  note: '晚餐',
  paymentMethod: 'WECHAT',
  sourceType: 'MANUAL',
  creator: { id: 'user-partner', nickname: members.items[1]!.nickname, avatarUrl: null },
  category: { id: 'category', name: '餐饮', icon: 'food', color: '#E85D5D', isEnabled: true },
  createdAt: '2026-07-15T00:00:00Z',
  updatedAt: '2026-07-15T00:00:00Z',
  version: 1,
  canEdit: true,
  canDelete: true,
};

const mountOptions = {
  global: {
    stubs: {
      RouterLink: { props: ['to'], template: '<a><slot /></a>' },
      StatisticsTrendChart: { template: '<div data-test="trend-chart"></div>' },
    },
  },
};

describe('TASK-009 home and statistics views', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'access-token';
    auth.user = {
      id: 'user-owner',
      avatarUrl: null,
      nickname: '朝暮',
      email: 'owner@example.com',
      timezone: 'Asia/Shanghai',
      status: 'ACTIVE',
      roles: ['USER'],
      permissions: [],
    };
    localStorage.clear();
    routerState.query = { ledger: 'couple', month: '2026-07' };
    routerState.replace.mockReset();
    vi.restoreAllMocks();
  });

  it('renders the selected monthly narrative with real attention, member and recent data', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/ledgers')) return Promise.resolve(response({ items: [ledger] }));
      if (url.includes('/statistics/overview')) return Promise.resolve(response(overview));
      if (url.includes('/statistics/members')) return Promise.resolve(response(members));
      if (url.includes('/entries?')) {
        return Promise.resolve(
          response({ items: [entry], page: 1, pageSize: 5, total: 1, hasNext: false }),
        );
      }
      if (url.includes('/recurring-runs?')) {
        return Promise.resolve(
          response({
            items: [
              {
                id: 'run-1',
                status: 'PENDING',
                rule: { ledgerId: ledger.id },
              },
            ],
            page: 1,
            pageSize: 100,
            total: 1,
            hasNext: false,
          }),
        );
      }
      throw new Error(`unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(DashboardView, mountOptions);
    await flushPromises();

    expect(wrapper.text()).toContain('我们的账本');
    expect(wrapper.text()).toContain('¥ 3,268.00');
    expect(wrapper.text()).toContain('这是一个用于验证长文本的成员昵称');
    expect(wrapper.text()).toContain('晚餐');
    expect(wrapper.text()).toContain('待确认周期账目');
    expect(wrapper.text()).toContain('本月记录贡献');
    expect(wrapper.text()).not.toContain('工资、周期和攒钱模块上线后');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/debts?'))).toBe(false);
    expect(localStorage.getItem('siyu-current-ledger-id')).toBe(ledger.id);

    await wrapper.get('button[aria-label="隐藏首页金额"]').trigger('click');
    expect(wrapper.text()).toContain('••••••');
    expect(localStorage.getItem('siyu-amount-hidden')).toBe('true');
  });

  it('shows personal debt attention without leaking it into couple mode', async () => {
    const personalLedger = {
      ...ledger,
      id: '00000000-0000-4000-8000-000000000011',
      type: 'PERSONAL',
      name: '我的个人账本',
      members: [ledger.members[0]],
    };
    routerState.query = { ledger: 'personal', month: '2026-07' };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/ledgers')) return Promise.resolve(response({ items: [personalLedger] }));
        if (url.includes('/statistics/overview'))
          return Promise.resolve(
            response({ ...overview, ledgerId: personalLedger.id, ledgerType: 'PERSONAL' }),
          );
        if (url.includes('/entries?'))
          return Promise.resolve(
            response({ items: [], page: 1, pageSize: 5, total: 0, hasNext: false }),
          );
        if (url.includes('/recurring-runs?'))
          return Promise.resolve(
            response({ items: [], page: 1, pageSize: 100, total: 0, hasNext: false }),
          );
        if (url.includes('/debts?'))
          return Promise.resolve(
            response({
              items: [
                {
                  id: 'debt-1',
                  status: 'ACTIVE',
                  direction: 'BORROWED',
                  dueDate: '2026-08-08',
                  overdueDays: 0,
                  remainingCent: 100_00,
                },
              ],
              page: 1,
              pageSize: 100,
              total: 1,
              hasNext: false,
            }),
          );
        throw new Error(`unexpected URL ${url}`);
      }),
    );

    const wrapper = mount(DashboardView, mountOptions);
    await flushPromises();

    expect(wrapper.text()).toContain('个人借贷');
    expect(wrapper.text()).toContain('8月8日到期');
    expect(wrapper.text()).toContain('这个月还没有账目');
  });

  it('renders trend, category rankings and member comparison from one month', async () => {
    const trend = {
      ledgerId: ledger.id,
      ledgerType: 'COUPLE',
      month: '2026-07',
      items: Array.from({ length: 31 }, (_, index) => ({
        date: `2026-07-${String(index + 1).padStart(2, '0')}`,
        incomeCent: index === 0 ? 800_000 : 0,
        expenseCent: index === 14 ? 473_200 : 0,
      })),
    };
    const categories = {
      ledgerId: ledger.id,
      ledgerType: 'COUPLE',
      month: '2026-07',
      type: 'EXPENSE',
      totalCent: 473_200,
      items: [
        {
          categoryId: 'category',
          name: '非常长的住房与日常生活分类名称',
          icon: 'home',
          color: '#5B7CFA',
          isEnabled: true,
          amountCent: 473_200,
          basisPoints: 10_000,
          entryCount: 2,
        },
      ],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/ledgers')) return Promise.resolve(response({ items: [ledger] }));
        if (url.includes('/statistics/overview')) return Promise.resolve(response(overview));
        if (url.includes('/statistics/trend')) return Promise.resolve(response(trend));
        if (url.includes('/statistics/categories')) return Promise.resolve(response(categories));
        if (url.includes('/statistics/members')) return Promise.resolve(response(members));
        throw new Error(`unexpected URL ${url}`);
      }),
    );

    const wrapper = mount(StatisticsView, mountOptions);
    await flushPromises();

    expect(wrapper.find('[data-test="trend-chart"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('非常长的住房与日常生活分类名称');
    expect(wrapper.text()).toContain('成员支出');
    expect(wrapper.text()).toContain('¥ 4,732.00');
  });

  it('shows an honest empty state instead of an empty chart', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/ledgers')) return Promise.resolve(response({ items: [ledger] }));
        if (url.includes('/statistics/overview')) {
          return Promise.resolve(
            response({ ...overview, incomeCent: 0, expenseCent: 0, balanceCent: 0, entryCount: 0 }),
          );
        }
        if (url.includes('/statistics/trend')) return Promise.resolve(response({ items: [] }));
        if (url.includes('/statistics/categories'))
          return Promise.resolve(response({ items: [], totalCent: 0 }));
        if (url.includes('/statistics/members'))
          return Promise.resolve(response({ items: [], totalCent: 0 }));
        throw new Error(`unexpected URL ${url}`);
      }),
    );

    const wrapper = mount(StatisticsView, mountOptions);
    await flushPromises();

    expect(wrapper.text()).toContain('这个月还没有可统计的账目');
    expect(wrapper.find('[data-test="trend-chart"]').exists()).toBe(false);
  });

  it('maps invisible-ledger errors to the no-access state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/ledgers')) return Promise.resolve(response({ items: [ledger] }));
        return Promise.resolve(response({}, 404));
      }),
    );

    const wrapper = mount(StatisticsView, mountOptions);
    await flushPromises();

    expect(wrapper.text()).toContain('无法访问这个账本');
    expect(wrapper.text()).toContain('账本不存在');
  });
});
