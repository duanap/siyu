import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../auth';
import { ledger } from './entry-view-test-utils';
import ExportsView from './ExportsView.vue';

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'request-1' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
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

async function mountView() {
  const pinia = prepareAuth();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/exports', name: 'exports', component: ExportsView },
      { path: '/account', name: 'account', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  });
  await router.push('/exports');
  await router.isReady();
  const wrapper = mount(ExportsView, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return wrapper;
}

describe('exports view', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:csv'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('renders visible ledger and separate entry and salary scopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(ok({ items: [ledger] }))),
    );
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('个人账本 · 个人');
    expect(wrapper.text()).toContain('下载账目 CSV');
    expect(wrapper.text()).toContain('只导出本人指定年份');
    expect(wrapper.find('input[type="date"]').exists()).toBe(true);
  });

  it('prevents rapid duplicate downloads and reports the saved filename', async () => {
    let resolveDownload: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/ledgers')) return Promise.resolve(ok({ items: [ledger] }));
      if (url.includes('/exports/entries.csv'))
        return new Promise<Response>((resolve) => {
          resolveDownload = resolve;
        });
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    const wrapper = await mountView();
    const button = wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('下载账目 CSV'));
    expect(button).toBeDefined();

    button?.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button?.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes('entries.csv')),
    ).toHaveLength(1);

    resolveDownload?.(
      new Response('\uFEFFheader\r\n', {
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="entries-2026.csv"' },
      }),
    );
    await flushPromises();
    expect(wrapper.text()).toContain('已下载 entries-2026.csv');
  });

  it('shows a retryable load error without an empty-state false positive', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('导出功能加载失败');
    expect(wrapper.text()).toContain('网络连接失败');
    expect(wrapper.text()).not.toContain('暂无可导出的账本');
  });
});
