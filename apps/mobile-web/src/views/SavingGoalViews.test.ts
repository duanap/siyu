import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/AppDrawer.vue', () => ({
  default: {
    template: '<section v-if="open" class="mock-drawer"><slot /></section>',
    props: ['open', 'busy'],
  },
}));
vi.mock('../components/AppDialog.vue', () => ({
  default: {
    template:
      '<section v-if="open" class="mock-dialog"><slot /><button class="dialog-confirm" @click="$emit(\'confirm\')">confirm</button></section>',
    props: ['open', 'busy'],
  },
}));

import { useAuthStore } from '../auth';
import type { Ledger } from '../entry';
import type { SavingContribution, SavingGoal, SavingGoalDetail } from '../saving-goals';
import SavingGoalCreateView from './SavingGoalCreateView.vue';
import SavingGoalDetailView from './SavingGoalDetailView.vue';
import SavingGoalsView from './SavingGoalsView.vue';

const userId = '11111111-1111-4111-8111-111111111111';
const ledger: Ledger = {
  id: '22222222-2222-4222-8222-222222222222',
  type: 'PERSONAL',
  name: '很长的个人账本名称用于验证移动端换行',
  ownerUserId: userId,
  status: 'ACTIVE',
  members: [
    {
      userId,
      role: 'OWNER',
      joinedAt: '2026-07-01T00:00:00.000Z',
      nickname: '测试用户',
      avatarUrl: null,
    },
  ],
};

const goal: SavingGoal = {
  id: '33333333-3333-4333-8333-333333333333',
  ledgerId: ledger.id,
  ledgerName: ledger.name,
  ledgerType: ledger.type,
  creatorUserId: userId,
  creatorName: '测试用户',
  name: '很长的旅行基金目标名称用于验证移动端长文本展示',
  targetCent: 1_000_000,
  initialCent: 100_000,
  savedCent: 680_000,
  remainingCent: 320_000,
  progressBasisPoints: 6_800,
  targetDate: '2026-12-31',
  status: 'ACTIVE',
  coverUrl: null,
  note: '一起去看很远的风景，验证长备注能够自然换行而不横向溢出。',
  contributorSummaries: [{ userId, contributorName: '测试用户', amountCent: 680_000 }],
  canManage: true,
  canContribute: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
};

const contribution: SavingContribution = {
  id: '44444444-4444-4444-8444-444444444444',
  goalId: goal.id,
  userId,
  contributorName: '测试用户',
  amountCent: 580_000,
  businessDate: '2026-07-22',
  note: '本月结余',
  canEdit: true,
  canDelete: true,
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
};

const detail: SavingGoalDetail = { ...goal, contributions: [contribution] };

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'request-1' }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function list(items: unknown[]) {
  return { items, page: 1, pageSize: 100, total: items.length, hasNext: false };
}

function prepareAuth() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.accessToken = 'token';
  auth.user = {
    id: userId,
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

function savingRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/saving-goals', name: 'saving-goals', component: SavingGoalsView },
      { path: '/saving-goals/new', name: 'saving-goal-new', component: SavingGoalCreateView },
      { path: '/saving-goals/:id', name: 'saving-goal-detail', component: SavingGoalDetailView },
      { path: '/account', name: 'account', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  });
}

describe('saving goal views', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders the complete server summary, progress and long target name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/ledgers')) return Promise.resolve(ok({ items: [ledger] }));
        if (url.includes('/saving-goals?')) return Promise.resolve(ok(list([goal])));
        return Promise.reject(new Error(`unexpected ${url}`));
      }),
    );
    const pinia = prepareAuth();
    const router = savingRouter();
    await router.push(`/saving-goals?ledgerId=${ledger.id}`);
    await router.isReady();
    const wrapper = mount(SavingGoalsView, { global: { plugins: [pinia, router] } });
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain(goal.name);
    expect(wrapper.text()).toContain('¥ 6,800.00 / ¥ 10,000.00');
    expect(wrapper.text()).toContain('68%');
    expect(wrapper.text()).toContain('个人目标仅本人可见');
  });

  it('keeps the initial loading state until the first goal request settles', async () => {
    let resolveGoals: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/ledgers')) return Promise.resolve(ok({ items: [ledger] }));
        if (url.includes('/saving-goals?'))
          return new Promise<Response>((resolve) => {
            resolveGoals = resolve;
          });
        return Promise.reject(new Error(`unexpected ${url}`));
      }),
    );
    const pinia = prepareAuth();
    const router = savingRouter();
    await router.push(`/saving-goals?ledgerId=${ledger.id}`);
    await router.isReady();
    const wrapper = mount(SavingGoalsView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('正在加载攒钱目标');
    expect(wrapper.text()).not.toContain('还没有攒钱目标');

    resolveGoals?.(ok(list([])));
    await flushPromises();
    expect(wrapper.text()).toContain('还没有攒钱目标');
  });

  it('creates a target once on rapid submit with exact cents and a stable key', async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/ledgers')) return Promise.resolve(ok({ items: [ledger] }));
        if (url.endsWith('/saving-goals')) {
          bodies.push(String(init?.body));
          return Promise.resolve(ok(goal, 201));
        }
        if (url.endsWith(`/saving-goals/${goal.id}`))
          return Promise.resolve(ok({ ...detail, contributions: [] }));
        return Promise.reject(new Error(`unexpected ${url}`));
      }),
    );
    const pinia = prepareAuth();
    const router = savingRouter();
    await router.push(`/saving-goals/new?ledgerId=${ledger.id}`);
    await router.isReady();
    const wrapper = mount(SavingGoalCreateView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    await wrapper.get('input[placeholder="例如：旅行基金"]').setValue('旅行基金');
    const amountInputs = wrapper.findAll('input[inputmode="decimal"]');
    await amountInputs[0]!.setValue('10000.00');
    await amountInputs[1]!.setValue('1000.00');
    const first = wrapper.get('.saving-goal-form').trigger('submit');
    const second = wrapper.get('.saving-goal-form').trigger('submit');
    await Promise.all([first, second]);
    await flushPromises();

    expect(bodies).toHaveLength(1);
    expect(JSON.parse(bodies[0]!)).toEqual(
      expect.objectContaining({
        ledgerId: ledger.id,
        targetCent: 1_000_000,
        initialCent: 100_000,
        idempotencyKey: expect.stringMatching(/^saving-goal-/),
      }),
    );
    expect(router.currentRoute.value.name).toBe('saving-goal-detail');
  });

  it('adds a contribution only once and refreshes the server-calculated detail', async () => {
    const bodies: string[] = [];
    let detailLoads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith(`/saving-goals/${goal.id}`)) {
          detailLoads += 1;
          return Promise.resolve(ok(detail));
        }
        if (url.endsWith(`/saving-goals/${goal.id}/contributions`)) {
          bodies.push(String(init?.body));
          return Promise.resolve(ok(contribution, 201));
        }
        return Promise.reject(new Error(`unexpected ${url}`));
      }),
    );
    const pinia = prepareAuth();
    const router = savingRouter();
    await router.push(`/saving-goals/${goal.id}`);
    await router.isReady();
    const wrapper = mount(SavingGoalDetailView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    await wrapper.get('.add-contribution').trigger('click');
    await wrapper.get('.contribution-form input[inputmode="decimal"]').setValue('88.88');
    const first = wrapper.get('.contribution-form').trigger('submit');
    const second = wrapper.get('.contribution-form').trigger('submit');
    await Promise.all([first, second]);
    await flushPromises();

    expect(bodies).toHaveLength(1);
    expect(JSON.parse(bodies[0]!)).toEqual(
      expect.objectContaining({
        amountCent: 8_888,
        idempotencyKey: expect.stringMatching(/^saving-contribution-/),
      }),
    );
    expect(detailLoads).toBe(2);
    expect(wrapper.text()).toContain('存入记录已添加');
  });

  it('uses only server capability fields for target and contribution actions', async () => {
    const readonly = {
      ...detail,
      canManage: false,
      canContribute: false,
      contributions: [{ ...contribution, canEdit: false, canDelete: false }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith(`/saving-goals/${goal.id}`)
          ? Promise.resolve(ok(readonly))
          : Promise.reject(new Error(`unexpected ${url}`)),
      ),
    );
    const pinia = prepareAuth();
    const router = savingRouter();
    await router.push(`/saving-goals/${goal.id}`);
    await router.isReady();
    const wrapper = mount(SavingGoalDetailView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('当前只能查看目标');
    expect(wrapper.find('.edit-goal-action').exists()).toBe(false);
    expect(wrapper.find('.management-zone').exists()).toBe(false);
    expect(wrapper.find('.contribution-actions').exists()).toBe(false);
  });

  it('requires confirmation before deleting a manageable goal', async () => {
    let deleteCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith(`/saving-goals/${goal.id}`) && init?.method === 'DELETE') {
          deleteCalls += 1;
          return Promise.resolve(ok({ id: goal.id, deleted: true }));
        }
        if (url.endsWith(`/saving-goals/${goal.id}`)) return Promise.resolve(ok(detail));
        if (url.endsWith('/ledgers')) return Promise.resolve(ok({ items: [ledger] }));
        if (url.includes('/saving-goals?')) return Promise.resolve(ok(list([])));
        return Promise.reject(new Error(`unexpected ${url}`));
      }),
    );
    const pinia = prepareAuth();
    const router = savingRouter();
    await router.push(`/saving-goals/${goal.id}`);
    await router.isReady();
    const wrapper = mount(SavingGoalDetailView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    await wrapper.get('.management-zone .danger-button').trigger('click');
    expect(deleteCalls).toBe(0);
    await wrapper.get('.dialog-confirm').trigger('click');
    await flushPromises();

    expect(deleteCalls).toBe(1);
    expect(router.currentRoute.value.name).toBe('saving-goals');
  });
});
