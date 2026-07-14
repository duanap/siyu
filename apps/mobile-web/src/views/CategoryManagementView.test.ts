import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../auth';
import CategoryManagementView from './CategoryManagementView.vue';

const routerState = vi.hoisted(() => ({ replace: vi.fn(), query: {} as Record<string, string> }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routerState.query }),
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
  name: '我们的超长情侣账本名称用于布局验证',
  ownerUserId: 'user-owner',
  status: 'ACTIVE',
  members: [],
};

function category(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000010',
    ledgerId: ledger.id,
    creatorUserId: null,
    type: 'EXPENSE',
    name: '这是一个非常长但仍在五十字符以内的分类名称用于检查移动端换行',
    icon: 'food',
    color: '#E85D5D',
    sortOrder: 100,
    isSystem: true,
    isEnabled: true,
    canEdit: false,
    canToggle: true,
    createdAt: '2026-07-14T00:00:00Z',
    updatedAt: '2026-07-14T00:00:00Z',
    ...overrides,
  };
}

describe('CategoryManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'access-token';
    auth.user = {
      id: 'user-owner',
      nickname: '朝暮',
      avatarUrl: null,
      timezone: 'Asia/Shanghai',
      status: 'ACTIVE',
      email: 'owner@example.com',
      roles: ['USER'],
      permissions: [],
    };
    routerState.query = {};
    routerState.replace.mockReset();
    vi.restoreAllMocks();
  });

  it('renders owner capabilities, long text, and persists ledger/type in the URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response({ items: [ledger] }))
        .mockResolvedValueOnce(
          response({
            items: [
              category(),
              category({
                id: '00000000-0000-4000-8000-000000000011',
                name: '停用项',
                isEnabled: false,
              }),
            ],
            permissions: { canCreate: true, canReorder: true },
          }),
        ),
    );

    const wrapper = mount(CategoryManagementView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('这是一个非常长');
    expect(wrapper.text()).toContain('已停用');
    expect(wrapper.text()).toContain('新增分类');
    expect(wrapper.find('[aria-label="上移分类"]').exists()).toBe(true);
    expect(routerState.replace).toHaveBeenCalledWith({
      query: { ledgerId: ledger.id, type: 'EXPENSE' },
    });
  });

  it('uses server capabilities for a MEMBER without duplicating owner permissions', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response({ items: [ledger] }))
        .mockResolvedValueOnce(
          response({
            items: [category({ canToggle: false })],
            permissions: { canCreate: true, canReorder: false },
          }),
        ),
    );

    const wrapper = mount(CategoryManagementView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('你可以管理自己创建的分类');
    expect(wrapper.find('[aria-label="上移分类"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('停用');
    expect(wrapper.text()).toContain('新增分类');
  });

  it('creates a category once while the form is submitting and reloads the list', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'request-id' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [ledger] }))
      .mockResolvedValueOnce(
        response({ items: [category()], permissions: { canCreate: true, canReorder: true } }),
      )
      .mockResolvedValueOnce(response(category({ id: 'new-category', name: '周末出游' }), 201))
      .mockResolvedValueOnce(
        response({ items: [category()], permissions: { canCreate: true, canReorder: true } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = mount(CategoryManagementView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新增分类')!
      .trigger('click');
    await wrapper.find('.drawer input').setValue('周末出游');
    await wrapper.find('.drawer form').trigger('submit');
    await wrapper.find('.drawer form').trigger('submit');
    await flushPromises();

    const createCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/v1/categories');
    expect(createCalls).toHaveLength(1);
    expect(JSON.parse(String(createCalls[0]?.[1]?.body))).toEqual(
      expect.objectContaining({ name: '周末出游', idempotencyKey: 'category-request-id' }),
    );
    expect(wrapper.text()).toContain('分类已创建');
  });

  it('clears an editor error when the drawer closes so it cannot cover the list', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response({ items: [ledger] }))
        .mockResolvedValueOnce(
          response({ items: [category()], permissions: { canCreate: true, canReorder: true } }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: false,
              code: 'CATEGORY_NAME_CONFLICT',
              message: '同类型下已存在同名启用分类',
            }),
            { status: 409 },
          ),
        ),
    );
    const wrapper = mount(CategoryManagementView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '新增分类')!
      .trigger('click');
    await wrapper.find('.drawer input').setValue('餐饮');
    await wrapper.find('.drawer form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.drawer-error').text()).toContain('同名');
    await wrapper.find('.drawer button[aria-label="关闭"]').trigger('click');
    expect(wrapper.find('.drawer').exists()).toBe(false);
    expect(wrapper.find('.message.error').exists()).toBe(false);
  });

  it('renders empty and request failure states without losing retry controls', async () => {
    const emptyFetch = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [ledger] }))
      .mockResolvedValueOnce(
        response({ items: [], permissions: { canCreate: true, canReorder: true } }),
      );
    vi.stubGlobal('fetch', emptyFetch);
    const empty = mount(CategoryManagementView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();
    expect(empty.text()).toContain('还没有启用的分类');
    empty.unmount();

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response({ items: [ledger] }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ success: false, code: 'UPSTREAM_FAILED', message: '网络暂时不可用' }),
            { status: 503 },
          ),
        ),
    );
    const failed = mount(CategoryManagementView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();
    expect(failed.text()).toContain('分类加载失败');
    expect(failed.text()).toContain('网络暂时不可用');
    expect(failed.text()).toContain('重试');
  });
});
