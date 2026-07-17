import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../components/AppDrawer.vue', () => ({
  default: { template: '<section v-if="open"><slot /></section>', props: ['open'] },
}));
vi.mock('../components/AppDialog.vue', () => ({
  default: { template: '<section v-if="open"><slot /></section>', props: ['open'] },
}));
import { useAuthStore } from '../auth';
import EntryDetailView from './EntryDetailView.vue';
import { entry, ledger, ok, user } from './entry-view-test-utils';

describe('EntryDetailView', () => {
  beforeEach(() => vi.restoreAllMocks());
  it('uses server capabilities, renders source read-only and rejects non-entries from targets', async () => {
    const managed = {
      ...entry,
      sourceType: 'RECURRING_RUN' as const,
      canEdit: false,
      canDelete: false,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('/ledgers')
          ? Promise.resolve(
              ok({ items: [ledger], page: 1, pageSize: 20, total: 1, hasNext: false }),
            )
          : Promise.resolve(ok(managed)),
      ),
    );
    const pinia = createPinia();
    setActivePinia(pinia);
    const auth = useAuthStore();
    auth.accessToken = 'token';
    auth.user = user();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/entries', name: 'entries', component: { template: '<div>safe-list</div>' } },
        { path: '/entries/:id', name: 'entry-detail', component: EntryDetailView },
        { path: '/account', name: 'account', component: { template: '<div>account</div>' } },
        { path: '/login', name: 'login', component: { template: '<div/>' } },
      ],
    });
    await router.push(`/entries/${entry.id}?from=/account`);
    await router.isReady();
    const wrapper = mount(EntryDetailView, { global: { plugins: [pinia, router] } });
    await flushPromises();
    expect(wrapper.text()).toContain('周期生成');
    expect(wrapper.text()).toContain('关联业务生成');
    expect(wrapper.text()).not.toContain('编辑账目');
    await wrapper.get('.header-action').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('entries');
  });
});
