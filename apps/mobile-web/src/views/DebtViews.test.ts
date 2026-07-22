import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/AppDrawer.vue', () => ({
  default: { template: '<section v-if="open"><slot /></section>', props: ['open'] },
}));
vi.mock('../components/AppDialog.vue', () => ({
  default: {
    template:
      '<section v-if="open"><slot /><button class="confirm" @click="$emit(\'confirm\')">confirm</button></section>',
    props: ['open'],
  },
}));

import { useAuthStore } from '../auth';
import type { Debt } from '../debt';
import DebtCreateView from './DebtCreateView.vue';
import DebtDetailView from './DebtDetailView.vue';
import DebtsView from './DebtsView.vue';

const debt: Debt = {
  id: '11111111-1111-4111-8111-111111111111',
  direction: 'BORROWED',
  counterpartyName: '很长的借贷对方名称用于移动端换行验证',
  principalCent: 10_000,
  processedCent: 2_000,
  remainingCent: 8_000,
  startDate: '2026-07-01',
  dueDate: '2026-07-25',
  status: 'ACTIVE',
  overdueDays: 0,
  note: null,
  reminderEnabled: false,
  canEdit: true,
  canDelete: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  transactions: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      debtId: '11111111-1111-4111-8111-111111111111',
      userId: '33333333-3333-4333-8333-333333333333',
      amountCent: 2_000,
      businessDate: '2026-07-10',
      syncEntry: false,
      entryId: null,
      note: null,
      createdAt: '2026-07-10T00:00:00.000Z',
    },
  ],
};

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'request-1' }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function prepareAuth() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.accessToken = 'token';
  auth.user = {
    id: '33333333-3333-4333-8333-333333333333',
    nickname: '测试用户',
    email: 'user@example.com',
    avatarUrl: null,
    timezone: 'Asia/Shanghai',
    status: 'ACTIVE',
    roles: ['USER'],
    permissions: [],
  };
  return pinia;
}

describe('debt views', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders a complete list summary and opens the selected debt', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.includes('/debts?')
          ? ok({
              items: [{ ...debt, transactions: undefined }],
              page: 1,
              pageSize: 100,
              total: 1,
              hasNext: false,
            })
          : ok(debt),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const pinia = prepareAuth();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/debts', name: 'debts', component: DebtsView },
        { path: '/debts/new', name: 'debt-new', component: { template: '<div />' } },
        { path: '/debts/:id', name: 'debt-detail', component: { template: '<div />' } },
        { path: '/home', name: 'dashboard', component: { template: '<div />' } },
        { path: '/login', name: 'login', component: { template: '<div />' } },
      ],
    });
    await router.push('/debts');
    await router.isReady();
    const wrapper = mount(DebtsView, { global: { plugins: [pinia, router] } });
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('当前总负债');
    expect(wrapper.text()).toContain('¥ 80.00');
    expect(wrapper.text()).toContain('本月已还');
    await wrapper.get('.debt-card').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('debt-detail');
  });

  it('creates only once on rapid submit and keeps a stable idempotency key', async () => {
    const bodies: string[] = [];
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return Promise.resolve(ok(debt, 201));
    });
    vi.stubGlobal('fetch', fetchMock);
    const pinia = prepareAuth();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/debts/new', name: 'debt-new', component: DebtCreateView },
        { path: '/debts', name: 'debts', component: { template: '<div />' } },
        { path: '/debts/:id', name: 'debt-detail', component: { template: '<div />' } },
        { path: '/login', name: 'login', component: { template: '<div />' } },
      ],
    });
    await router.push('/debts/new');
    await router.isReady();
    const wrapper = mount(DebtCreateView, { global: { plugins: [pinia, router] } });
    await wrapper.get('input[placeholder="姓名或备注名称"]').setValue('张三');
    await wrapper.get('input[inputmode="decimal"]').setValue('100.00');
    const first = wrapper.get('form').trigger('submit');
    const second = wrapper.get('form').trigger('submit');
    await Promise.all([first, second]);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(bodies[0]!).idempotencyKey).toMatch(/^debt-/);
    expect(router.currentRoute.value.name).toBe('debt-detail');
  });

  it('shows the server deletion boundary and blocks an excessive transaction', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(ok({ ...debt, canDelete: false }))),
    );
    const pinia = prepareAuth();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/debts', name: 'debts', component: { template: '<div />' } },
        { path: '/debts/:id', name: 'debt-detail', component: DebtDetailView },
        { path: '/login', name: 'login', component: { template: '<div />' } },
      ],
    });
    await router.push(`/debts/${debt.id}`);
    await router.isReady();
    const wrapper = mount(DebtDetailView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('不能删除这条借贷');
    expect(wrapper.find('.actions .danger').exists()).toBe(false);
    await wrapper.get('.actions .primary').trigger('click');
    await wrapper.get('input[inputmode="decimal"]').setValue('100.00');
    expect(wrapper.text()).toContain('不能超过剩余 ¥ 80.00');
    expect(wrapper.get('.transaction-form .submit').attributes('disabled')).toBeDefined();
  });
});
