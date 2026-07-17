import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../components/AppDrawer.vue', () => ({
  default: { template: '<section v-if="open"><slot /></section>', props: ['open'] },
}));
import { useAuthStore } from '../auth';
import EntriesView from './EntriesView.vue';
import { category, entry, ledger, ok, user } from './entry-view-test-utils';

describe('EntriesView', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  it('restores URL filters, stops deep pagination at hasNext=false and groups entries', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/ledgers'))
        return Promise.resolve(
          ok({ items: [ledger], page: 1, pageSize: 20, total: 1, hasNext: false }),
        );
      if (url.includes('/categories'))
        return Promise.resolve(
          ok({ items: [category], permissions: { canCreate: true, canReorder: true } }),
        );
      if (url.includes('/entries?'))
        return Promise.resolve(
          ok({ items: [entry], page: 1, pageSize: 20, total: 1, hasNext: false }),
        );
      throw new Error(url);
    });
    vi.stubGlobal('fetch', fetchMock);
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.accessToken = 'token';
    auth.user = user();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/entries', name: 'entries', component: EntriesView },
        { path: '/entries/new', name: 'entry-new', component: { template: '<div/>' } },
        { path: '/entries/:id', name: 'entry-detail', component: { template: '<div/>' } },
        { path: '/account', name: 'account', component: { template: '<div/>' } },
        { path: '/login', name: 'login', component: { template: '<div/>' } },
      ],
    });
    await router.push(`/entries?ledgerId=${ledger.id}&month=2026-07&page=99`);
    await router.isReady();
    const wrapper = mount(EntriesView, { global: { plugins: [pinia, router] } });
    await flushPromises();
    await flushPromises();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/entries?'))).toHaveLength(
      1,
    );
    expect(router.currentRoute.value.query.page).toBeUndefined();
    expect(wrapper.text()).toContain('2026-07-14');
    expect(wrapper.text()).toContain('早餐');
    expect(wrapper.findAll('button[aria-disabled="true"]')).toHaveLength(0);
  });
});
