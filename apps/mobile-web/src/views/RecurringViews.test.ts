import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/AppDrawer.vue', () => ({
  default: {
    template: '<section v-if="open" class="mock-drawer"><slot /></section>',
    props: ['open'],
  },
}));
vi.mock('../components/AppDialog.vue', () => ({
  default: {
    template:
      '<section v-if="open" class="mock-dialog"><slot /><button class="dialog-confirm" @click="$emit(\'confirm\')">confirm</button></section>',
    props: ['open'],
  },
}));

import { useAuthStore } from '../auth';
import type { Ledger } from '../entry';
import type { RecurringRule, RecurringRun } from '../recurring';
import RecurringCreateView from './RecurringCreateView.vue';
import RecurringDetailView from './RecurringDetailView.vue';
import RecurringListView from './RecurringListView.vue';

const ledger: Ledger = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'PERSONAL',
  name: '个人账本',
  ownerUserId: '22222222-2222-4222-8222-222222222222',
  status: 'ACTIVE',
  members: [
    {
      userId: '22222222-2222-4222-8222-222222222222',
      role: 'OWNER',
      joinedAt: '2026-07-01T00:00:00.000Z',
      nickname: '测试用户',
      avatarUrl: null,
    },
  ],
};

const category = {
  id: '33333333-3333-4333-8333-333333333333',
  ledgerId: ledger.id,
  creatorUserId: null,
  type: 'EXPENSE' as const,
  name: '住房',
  icon: 'housing' as const,
  color: '#5B7CFA',
  sortOrder: 100,
  isSystem: true,
  isEnabled: true,
  canEdit: false,
  canToggle: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const rule: RecurringRule = {
  id: '44444444-4444-4444-8444-444444444444',
  ownerUserId: ledger.ownerUserId,
  ledgerId: ledger.id,
  name: '很长的房租周期规则名称用于验证移动端换行和省略',
  entryType: 'EXPENSE',
  amountCent: 220_000,
  categoryId: category.id,
  category: {
    id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    isEnabled: true,
  },
  frequency: 'MONTHLY',
  intervalValue: 1,
  startDate: '2026-07-15',
  endDate: null,
  totalOccurrences: 12,
  completedOccurrences: 4,
  nextRunDate: '2026-08-15',
  generationMode: 'CONFIRM',
  status: 'ACTIVE',
  reminderDaysBefore: 1,
  canEdit: true,
  canPause: true,
  canResume: false,
  canDelete: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const run: RecurringRun = {
  id: '55555555-5555-4555-8555-555555555555',
  ruleId: rule.id,
  scheduledDate: '2026-07-15',
  amountCent: 220_000,
  status: 'PENDING',
  entryId: null,
  attempts: 1,
  lastError: null,
  lastAttemptAt: '2026-07-15T00:00:00.000Z',
  confirmedAt: null,
  canConfirm: true,
  canSkip: true,
  rule: {
    id: rule.id,
    ledgerId: ledger.id,
    ownerUserId: ledger.ownerUserId,
    name: rule.name,
    entryType: rule.entryType,
    generationMode: rule.generationMode,
  },
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
};

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
    id: ledger.ownerUserId,
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

function testRouter(component: object, path: string) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path,
        name:
          path === '/recurring'
            ? 'recurring'
            : path.includes('/new')
              ? 'recurring-new'
              : 'recurring-detail',
        component,
      },
      {
        path: '/recurring',
        name: 'recurring',
        component: path === '/recurring' ? component : { template: '<div />' },
      },
      {
        path: '/recurring/new',
        name: 'recurring-new',
        component: path.includes('/new') ? component : { template: '<div />' },
      },
      {
        path: '/recurring/:id',
        name: 'recurring-detail',
        component: path.includes('/:id') ? component : { template: '<div />' },
      },
      { path: '/account', name: 'account', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ].filter(
      (item, index, items) => items.findIndex((other) => other.name === item.name) === index,
    ),
  });
}

describe('recurring views', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders pending items and confirms once with a stable idempotency key', async () => {
    const confirmBodies: string[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/ledgers')) return Promise.resolve(ok({ items: [ledger] }));
      if (url.includes('/recurring-rules?')) return Promise.resolve(ok(list([rule])));
      if (url.includes('/recurring-runs?')) return Promise.resolve(ok(list([run])));
      if (url.includes('/confirm')) {
        confirmBodies.push(String(init?.body));
        return Promise.resolve(
          ok({ ...run, status: 'CONFIRMED', canConfirm: false, canSkip: false }),
        );
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    const pinia = prepareAuth();
    const router = testRouter(RecurringListView, '/recurring');
    await router.push('/recurring');
    await router.isReady();
    const wrapper = mount(RecurringListView, { global: { plugins: [pinia, router] } });
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('待确认');
    expect(wrapper.text()).toContain(rule.name);
    await wrapper.get('.run-actions .confirm').trigger('click');
    const first = wrapper.get('.confirm-form').trigger('submit');
    const second = wrapper.get('.confirm-form').trigger('submit');
    await Promise.all([first, second]);
    await flushPromises();

    expect(confirmBodies).toHaveLength(1);
    expect(JSON.parse(confirmBodies[0]!).idempotencyKey).toMatch(/^recurring-confirm-/);
    expect(wrapper.text()).toContain('本期已确认并生成普通账目');
  });

  it('creates a complete rule once on rapid submit and preserves the selected ledger', async () => {
    const createBodies: string[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/ledgers')) return Promise.resolve(ok({ items: [ledger] }));
      if (url.includes('/categories?'))
        return Promise.resolve(
          ok({ items: [category], permissions: { canCreate: true, canReorder: true } }),
        );
      if (url.endsWith('/recurring-rules')) {
        createBodies.push(String(init?.body));
        return Promise.resolve(ok(rule, 201));
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    const pinia = prepareAuth();
    const router = testRouter(RecurringCreateView, '/recurring/new');
    await router.push(`/recurring/new?ledgerId=${ledger.id}`);
    await router.isReady();
    const wrapper = mount(RecurringCreateView, { global: { plugins: [pinia, router] } });
    await flushPromises();
    await flushPromises();

    await wrapper.get('input[placeholder="例如：房租"]').setValue('房租');
    await wrapper.get('input[inputmode="decimal"]').setValue('2200.00');
    await wrapper.get('.category-grid button').trigger('click');
    const first = wrapper.get('.recurring-form').trigger('submit');
    const second = wrapper.get('.recurring-form').trigger('submit');
    await Promise.all([first, second]);
    await flushPromises();

    expect(createBodies).toHaveLength(1);
    const body = JSON.parse(createBodies[0]!);
    expect(body.ledgerId).toBe(ledger.id);
    expect(body.amountCent).toBe(220_000);
    expect(body.idempotencyKey).toMatch(/^recurring-rule-/);
    expect(router.currentRoute.value.name).toBe('recurring-detail');
  });

  it('uses only server capabilities for detail actions', async () => {
    const readonlyRule = {
      ...rule,
      canEdit: false,
      canPause: false,
      canResume: false,
      canDelete: false,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes(`/recurring-rules/${rule.id}`)) return Promise.resolve(ok(readonlyRule));
        if (url.includes('/recurring-runs?')) return Promise.resolve(ok(list([])));
        if (url.includes('/ledgers')) return Promise.resolve(ok({ items: [ledger] }));
        return Promise.reject(new Error(`unexpected ${url}`));
      }),
    );
    const pinia = prepareAuth();
    const router = testRouter(RecurringDetailView, '/recurring/:id');
    await router.push(`/recurring/${rule.id}`);
    await router.isReady();
    const wrapper = mount(RecurringDetailView, { global: { plugins: [pinia, router] } });
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('当前没有管理权限');
    expect(wrapper.find('.actions button').exists()).toBe(false);
  });
});
