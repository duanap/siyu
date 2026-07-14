import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../components/AppDrawer.vue', () => ({
  default: { template: '<section v-if="open"><slot /></section>', props: ['open'] },
}));
import { useAuthStore } from '../auth';
import EntryCreateView from './EntryCreateView.vue';
import { category, entry, ledger, ok, user } from './entry-view-test-utils';

async function setup(fetchMock: ReturnType<typeof vi.fn>) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.accessToken = 'token';
  auth.user = user();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/entries/new', name: 'entry-new', component: EntryCreateView },
      { path: '/entries', name: 'entries', component: { template: '<div>entries</div>' } },
      { path: '/login', name: 'login', component: { template: '<div/>' } },
    ],
  });
  await router.push(`/entries/new?ledgerId=${ledger.id}`);
  await router.isReady();
  vi.stubGlobal('fetch', fetchMock);
  const wrapper = mount(EntryCreateView, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return { wrapper, router };
}

describe('EntryCreateView', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  it('restores ledger, defaults to expense and creates once on rapid submit', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      void init;
      if (url.includes('/ledgers'))
        return Promise.resolve(
          ok({ items: [ledger], page: 1, pageSize: 20, total: 1, hasNext: false }),
        );
      if (url.includes('/categories'))
        return Promise.resolve(
          ok({ items: [category], permissions: { canCreate: true, canReorder: true } }),
        );
      if (url.endsWith('/entries')) return Promise.resolve(ok(entry, 201));
      throw new Error(url);
    });
    const { wrapper, router } = await setup(fetchMock);
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('支出');
    await wrapper.get('input[inputmode="decimal"]').setValue('12.30');
    await wrapper.findAll('.category-grid button')[0]!.trigger('click');
    const first = wrapper.get('form').trigger('submit');
    const second = wrapper.get('form').trigger('submit');
    await Promise.all([first, second]);
    await flushPromises();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/entries'))).toHaveLength(
      1,
    );
    const createCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/entries'));
    const body = JSON.parse(String(createCall?.[1]?.body));
    expect(body.amountCent).toBe(1230);
    expect(body.idempotencyKey).toMatch(/^entry-/);
    expect(router.currentRoute.value.name).toBe('entries');
  });
  it('keeps form fields and idempotency key after a network failure', async () => {
    const posted: string[] = [];
    let attempts = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/ledgers'))
        return Promise.resolve(
          ok({ items: [ledger], page: 1, pageSize: 20, total: 1, hasNext: false }),
        );
      if (url.includes('/categories'))
        return Promise.resolve(
          ok({ items: [category], permissions: { canCreate: true, canReorder: true } }),
        );
      if (url.endsWith('/entries')) {
        posted.push(String(init?.body));
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new TypeError('offline'))
          : Promise.resolve(ok(entry, 201));
      }
      throw new Error(url);
    });
    const { wrapper } = await setup(fetchMock);
    await wrapper.get('input[inputmode="decimal"]').setValue('12.30');
    await wrapper.findAll('.category-grid button')[0]!.trigger('click');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('网络连接失败');
    expect((wrapper.get('input[inputmode="decimal"]').element as HTMLInputElement).value).toBe(
      '12.30',
    );
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(JSON.parse(posted[0]!).idempotencyKey).toBe(JSON.parse(posted[1]!).idempotencyKey);
  });
});
