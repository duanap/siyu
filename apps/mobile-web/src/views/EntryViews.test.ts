import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../auth';
import EntryCreateView from './EntryCreateView.vue';
import EntryDetailView from './EntryDetailView.vue';
import EntryListView from './EntryListView.vue';

const routerState = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  params: {} as Record<string, string>,
  replace: vi.fn(),
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routerState.query, params: routerState.params }),
  useRouter: () => ({ replace: routerState.replace }),
}));

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: status < 400, data, requestId: 'req_test' }), {
    status,
  });
}

const ledger = {
  id: '00000000-0000-4000-8000-000000000001',
  type: 'COUPLE',
  name: '我们的朝暮同笺账本',
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
  ],
};

const category = {
  id: '00000000-0000-4000-8000-000000000010',
  ledgerId: ledger.id,
  creatorUserId: null,
  type: 'EXPENSE',
  name: '日常餐饮',
  icon: 'food',
  color: '#E85D5D',
  sortOrder: 100,
  isSystem: true,
  isEnabled: true,
  canEdit: false,
  canToggle: true,
  createdAt: '2026-07-14T00:00:00Z',
  updatedAt: '2026-07-14T00:00:00Z',
};

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000020',
    ledgerId: ledger.id,
    type: 'EXPENSE',
    amountCent: 8_650,
    businessDate: '2026-07-15',
    note: '这是一条很长的早餐备注，用于验证列表不会被长文本撑出横向滚动',
    paymentMethod: 'WECHAT',
    sourceType: 'MANUAL',
    creator: { id: 'user-owner', nickname: '朝暮', avatarUrl: null },
    category: {
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      isEnabled: true,
    },
    createdAt: '2026-07-15T01:00:00Z',
    updatedAt: '2026-07-15T01:00:00Z',
    version: 1,
    canEdit: true,
    canDelete: true,
    ...overrides,
  };
}

const mountOptions = {
  global: {
    stubs: {
      RouterLink: { props: ['to'], template: '<a><slot /></a>' },
    },
  },
};

describe('TASK-008 entry views', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'access-token';
    auth.user = {
      id: 'user-owner',
      nickname: '朝暮',
      email: 'owner@example.com',
      timezone: 'Asia/Shanghai',
      roles: ['USER'],
      permissions: [],
    };
    localStorage.clear();
    routerState.query = {};
    routerState.params = {};
    routerState.replace.mockReset();
    vi.restoreAllMocks();
  });

  it('creates exactly one entry while repeated submit events are pending', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-request' });
    let finishCreate: ((value: Response) => void) | undefined;
    const pendingCreate = new Promise<Response>((resolve) => {
      finishCreate = resolve;
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      void init;
      if (url.includes('/ledgers')) return Promise.resolve(response({ items: [ledger] }));
      if (url.includes('/categories')) {
        return Promise.resolve(response({ items: [category], permissions: {} }));
      }
      if (url.endsWith('/entries')) return pendingCreate;
      throw new Error(`unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(EntryCreateView, mountOptions);
    await flushPromises();
    await wrapper.find('input[aria-label="金额"]').setValue('28.50');
    await wrapper.find('form').trigger('submit');
    await wrapper.find('form').trigger('submit');

    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/entries'))).toHaveLength(
      1,
    );
    expect(wrapper.text()).toContain('正在保存');
    finishCreate?.(response(entry(), 201));
    await flushPromises();
    expect(routerState.replace).toHaveBeenLastCalledWith(`/entries/${entry().id}`);
    const createCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/entries'));
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual(
      expect.objectContaining({ amountCent: 2850, idempotencyKey: 'entry-fixed-request' }),
    );
  });

  it('groups list results, shows creator and preserves ledger/filter query state', async () => {
    routerState.query = { ledgerId: ledger.id, month: '2026-07' };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/ledgers')) return Promise.resolve(response({ items: [ledger] }));
        if (url.includes('/categories')) {
          return Promise.resolve(response({ items: [category], permissions: {} }));
        }
        if (url.includes('/entries?')) {
          return Promise.resolve(
            response({ items: [entry()], page: 1, pageSize: 20, total: 1, hasNext: false }),
          );
        }
        throw new Error(`unexpected URL ${url}`);
      }),
    );

    const wrapper = mount(EntryListView, mountOptions);
    await flushPromises();

    expect(wrapper.text()).toContain('账目明细');
    expect(wrapper.text()).toContain('日常餐饮');
    expect(wrapper.text()).toContain('朝暮');
    expect(wrapper.text()).toContain('共 1 笔');
    expect(localStorage.getItem('siyu-current-ledger-id')).toBe(ledger.id);
    expect(routerState.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ ledgerId: ledger.id, month: '2026-07' }),
      }),
    );
  });

  it('uses server capabilities for read-only entries', async () => {
    routerState.params = { id: entry().id };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/entries/')) {
          return Promise.resolve(response(entry({ canEdit: false, canDelete: false })));
        }
        if (url.includes('/categories')) {
          return Promise.resolve(response({ items: [category], permissions: {} }));
        }
        throw new Error(`unexpected URL ${url}`);
      }),
    );

    const wrapper = mount(EntryDetailView, mountOptions);
    await flushPromises();

    expect(wrapper.text()).toContain('-¥ 86.50');
    expect(wrapper.text()).toContain('没有修改权限');
    expect(wrapper.text()).not.toContain('删除账目');
    expect(wrapper.findAll('button').some((button) => button.text() === '编辑')).toBe(false);
  });

  it('requires confirmation and sends the server version when deleting', async () => {
    routerState.params = { id: entry().id };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/entries/') && init?.method === 'DELETE') {
        return Promise.resolve(response({ id: entry().id, deleted: true, version: 2 }));
      }
      if (url.includes('/entries/')) return Promise.resolve(response(entry()));
      if (url.includes('/categories')) {
        return Promise.resolve(response({ items: [category], permissions: {} }));
      }
      throw new Error(`unexpected URL ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(EntryDetailView, mountOptions);
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '删除账目')!
      .trigger('click');
    await flushPromises();

    expect(confirm).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/entries/${entry().id}?expectedVersion=1`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(routerState.replace).toHaveBeenCalledWith({
      path: '/entries',
      query: { ledgerId: ledger.id, month: '2026-07' },
    });
  });
});
