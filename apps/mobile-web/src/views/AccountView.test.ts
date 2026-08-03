import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../auth';
import AccountView from './AccountView.vue';

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'req-account' }), {
    status: 200,
  });
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/account', name: 'account', component: AccountView },
      { path: '/login', name: 'login', component: { template: '<div>登录</div>' } },
      { path: '/home', name: 'dashboard', component: { template: '<div />' } },
      { path: '/entries', name: 'entries', component: { template: '<div />' } },
      { path: '/entries/new', name: 'entry-new', component: { template: '<div />' } },
      { path: '/statistics', name: 'statistics', component: { template: '<div />' } },
      { path: '/couple/invite', component: { template: '<div />' } },
      { path: '/categories', component: { template: '<div />' } },
      { path: '/debts', component: { template: '<div />' } },
      { path: '/recurring', component: { template: '<div />' } },
      { path: '/salary', component: { template: '<div />' } },
      { path: '/saving-goals', component: { template: '<div />' } },
      { path: '/notifications', component: { template: '<div />' } },
      { path: '/exports', component: { template: '<div />' } },
    ],
  });
}

describe('TASK-027 account view', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'access-token';
    auth.user = {
      id: 'user-owner',
      avatarUrl: null,
      nickname: '很长的用户昵称也应该安全显示',
      email: 'owner@example.com',
      timezone: 'Asia/Shanghai',
      status: 'ACTIVE',
      roles: ['USER'],
      permissions: [],
    };
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('groups real destinations, unread state and keeps profile navigation active', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/ledgers'))
          return Promise.resolve(
            response({
              items: [
                {
                  id: 'ledger-couple',
                  type: 'COUPLE',
                  name: '我们的账本',
                  status: 'ACTIVE',
                  ownerUserId: 'user-owner',
                  createdAt: '2026-08-01T00:00:00.000Z',
                  updatedAt: '2026-08-01T00:00:00.000Z',
                  members: [],
                },
              ],
            }),
          );
        if (url.includes('/notifications?'))
          return Promise.resolve(
            response({ items: [], page: 1, pageSize: 1, total: 0, hasNext: false, unreadCount: 3 }),
          );
        throw new Error(`unexpected URL ${url}`);
      }),
    );
    const router = createTestRouter();
    await router.push('/account');
    await router.isReady();

    const wrapper = mount(AccountView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('共同生活');
    expect(wrapper.text()).toContain('财务计划');
    expect(wrapper.text()).toContain('数据与安全');
    expect(wrapper.text()).toContain('朝暮同笺已连接');
    expect(wrapper.text()).toContain('3 条未读');
    expect(wrapper.get('[aria-current="page"]').text()).toContain('我的');
    expect(wrapper.text()).not.toContain('进入首页');
    expect(wrapper.text()).not.toContain('查看统计');

    await wrapper.get('button[aria-pressed="false"]').trigger('click');
    expect(localStorage.getItem('siyu-theme')).toBeTruthy();
  });

  it('persists amount privacy and prevents duplicate logout requests', async () => {
    let logoutRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/ledgers')) return Promise.resolve(response({ items: [] }));
        if (url.includes('/notifications?'))
          return Promise.resolve(
            response({ items: [], page: 1, pageSize: 1, total: 0, hasNext: false, unreadCount: 0 }),
          );
        if (url.includes('/auth/logout')) {
          logoutRequests += 1;
          return new Promise<Response>((resolve) =>
            setTimeout(() => resolve(response({ loggedOut: true })), 10),
          );
        }
        throw new Error(`unexpected URL ${url}`);
      }),
    );
    const router = createTestRouter();
    await router.push('/account');
    await router.isReady();
    const wrapper = mount(AccountView, { global: { plugins: [router] } });
    await flushPromises();

    await wrapper.get('[aria-label="默认隐藏首页金额"]').trigger('click');
    expect(localStorage.getItem('siyu-amount-hidden')).toBe('true');

    const logout = wrapper.get('.logout-button');
    await logout.trigger('click');
    await logout.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 20));
    await flushPromises();
    expect(logoutRequests).toBe(1);
    expect(router.currentRoute.value.path).toBe('/login');
  });
});
