import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../auth';
import type { Notification } from '../notifications';
import NotificationsView from './NotificationsView.vue';

const userId = '11111111-1111-4111-8111-111111111111';
const notification: Notification = {
  id: '22222222-2222-4222-8222-222222222222',
  type: 'RECURRING_CONFIRMATION_DUE',
  title: '周期账目待确认',
  content: '很长的周期通知内容用于验证在窄屏上能够自然换行并保持操作区域清晰。',
  relatedType: 'RECURRING_RUN',
  relatedId: '33333333-3333-4333-8333-333333333333',
  readAt: null,
  createdAt: '2026-07-22T08:00:00.000Z',
};

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'request-1' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function list(items: Notification[], unreadCount: number) {
  return {
    items,
    page: 1,
    pageSize: 100,
    total: items.length,
    hasNext: false,
    unreadCount,
  };
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

function notificationsRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/notifications', name: 'notifications', component: NotificationsView },
      { path: '/account', name: 'account', component: { template: '<div />' } },
      { path: '/recurring', name: 'recurring', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  });
}

async function mountView() {
  const pinia = prepareAuth();
  const router = notificationsRouter();
  await router.push('/notifications');
  await router.isReady();
  const wrapper = mount(NotificationsView, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return { wrapper, router };
}

describe('notifications view', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders server unread count, long content and unknown notification fallback', async () => {
    const unknown = {
      ...notification,
      id: '44444444-4444-4444-8444-444444444444',
      type: 'UNKNOWN_TYPE',
      relatedType: null,
      relatedId: null,
      title: '通用通知',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(ok(list([notification, unknown], 2)))),
    );

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain('2 条未读');
    expect(wrapper.text()).toContain(notification.content);
    expect(wrapper.text()).toContain('周期提醒 · 查看周期记账');
    expect(wrapper.text()).toContain('通用通知');
    expect(wrapper.findAll('.notification-content.actionable')).toHaveLength(1);
  });

  it('keeps loading visible until the first notification page settles', async () => {
    let resolveList: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveList = resolve;
          }),
      ),
    );
    const pinia = prepareAuth();
    const router = notificationsRouter();
    await router.push('/notifications');
    await router.isReady();
    const wrapper = mount(NotificationsView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('正在加载消息');
    expect(wrapper.text()).not.toContain('暂时没有消息');

    resolveList?.(ok(list([], 0)));
    await flushPromises();
    expect(wrapper.text()).toContain('暂时没有消息');
  });

  it('prevents rapid duplicate read requests and refreshes server state', async () => {
    let marked = false;
    let resolveMark: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/notifications?'))
        return Promise.resolve(
          ok(
            list(
              [{ ...notification, readAt: marked ? '2026-07-22T09:00:00.000Z' : null }],
              marked ? 0 : 1,
            ),
          ),
        );
      if (url.endsWith('/notifications/read') && init?.method === 'POST')
        return new Promise<Response>((resolve) => {
          resolveMark = (response) => {
            marked = true;
            resolve(response);
          };
        });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper } = await mountView();

    const action = wrapper.get('.read-action');
    action.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    action.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/notifications/read')),
    ).toHaveLength(1);

    resolveMark?.(ok({ markedCount: 1, unreadCount: 0 }));
    await flushPromises();
    expect(wrapper.text()).toContain('消息均已读');
  });

  it('shows a retryable error state when notification loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain('消息中心加载失败');
    expect(wrapper.text()).toContain('网络连接失败');
    expect(wrapper.text()).not.toContain('暂时没有消息');
  });
});
