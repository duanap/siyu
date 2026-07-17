import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/AppDrawer.vue', () => ({
  default: { template: '<section v-if="open"><slot /></section>', props: ['open'] },
}));
vi.mock('../components/AppDialog.vue', () => ({
  default: {
    template:
      '<section v-if="open" class="dialog-stub"><slot /><button class="confirm" @click="$emit(\'confirm\')">confirm</button><button class="cancel" @click="$emit(\'cancel\')">cancel</button></section>',
    props: ['open'],
    emits: ['confirm', 'cancel'],
  },
}));

import { useAuthStore } from '../auth';
import EntriesView from './EntriesView.vue';
import EntryCreateView from './EntryCreateView.vue';
import EntryDetailView from './EntryDetailView.vue';
import { category, entry, ledger, ok, user } from './entry-view-test-utils';

async function setup(path: string, component: object, fetchMock: ReturnType<typeof vi.fn>) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.accessToken = 'token';
  auth.user = user();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/entries', name: 'entries', component: path === '/entries' ? component : {} },
      {
        path: '/entries/new',
        name: 'entry-new',
        component: path.startsWith('/entries/new') ? component : {},
      },
      {
        path: '/entries/:id',
        name: 'entry-detail',
        component: path.includes(entry.id) ? component : {},
      },
      { path: '/home', name: 'dashboard', component: {} },
      { path: '/statistics', name: 'statistics', component: {} },
      { path: '/account', name: 'account', component: {} },
      { path: '/login', name: 'login', component: {} },
    ],
  });
  await router.push(path);
  await router.isReady();
  vi.stubGlobal('fetch', fetchMock);
  const wrapper = mount(component, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return { wrapper, router };
}

function ledgersResponse(): Response {
  return ok({ items: [ledger], page: 1, pageSize: 20, total: 1, hasNext: false });
}

describe('TASK-008 integrated entry views', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('creates exactly one entry while repeated submits are pending', async () => {
    let finishCreate: ((value: Response) => void) | undefined;
    const pendingCreate = new Promise<Response>((resolve) => {
      finishCreate = resolve;
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      void init;
      if (url.includes('/ledgers')) return Promise.resolve(ledgersResponse());
      if (url.includes('/categories'))
        return Promise.resolve(
          ok({ items: [category], permissions: { canCreate: true, canReorder: true } }),
        );
      if (url.endsWith('/entries')) return pendingCreate;
      throw new Error(url);
    });
    const { wrapper } = await setup(
      `/entries/new?ledgerId=${ledger.id}`,
      EntryCreateView,
      fetchMock,
    );
    await wrapper.get('input[inputmode="decimal"]').setValue('28.50');
    await wrapper.findAll('.category-grid button')[0]!.trigger('click');
    const first = wrapper.get('form').trigger('submit');
    const second = wrapper.get('form').trigger('submit');
    await Promise.all([first, second]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/entries'))).toHaveLength(
      1,
    );
    finishCreate?.(ok(entry, 201));
    await flushPromises();
    const createCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/entries'));
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual(
      expect.objectContaining({ amountCent: 2850 }),
    );
  });

  it('groups list results and preserves the ledger query', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/ledgers')) return Promise.resolve(ledgersResponse());
      if (url.includes('/categories'))
        return Promise.resolve(ok({ items: [category], permissions: {} }));
      if (url.includes('/entries?'))
        return Promise.resolve(
          ok({ items: [entry], page: 1, pageSize: 20, total: 1, hasNext: false }),
        );
      throw new Error(url);
    });
    const { wrapper, router } = await setup(
      `/entries?ledgerId=${ledger.id}&month=2026-07`,
      EntriesView,
      fetchMock,
    );
    await flushPromises();
    expect(wrapper.findAll('.day-group')).toHaveLength(1);
    expect(wrapper.findAll('.entry-item')).toHaveLength(1);
    expect(router.currentRoute.value.query.ledgerId).toBe(ledger.id);
  });

  it('uses server capabilities for read-only entries', async () => {
    const readOnly = { ...entry, canEdit: false, canDelete: false };
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/ledgers')) return Promise.resolve(ledgersResponse());
      if (url.includes('/entries/')) return Promise.resolve(ok(readOnly));
      throw new Error(url);
    });
    const { wrapper } = await setup(`/entries/${entry.id}`, EntryDetailView, fetchMock);
    expect(wrapper.find('.app-amount').text()).toContain('12.30');
    expect(wrapper.find('.actions').exists()).toBe(false);
  });

  it('requires dialog confirmation and sends the server version when deleting', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/ledgers')) return Promise.resolve(ledgersResponse());
      if (url.includes('/entries/') && init?.method === 'DELETE')
        return Promise.resolve(ok({ id: entry.id, deleted: true, version: 2 }));
      if (url.includes('/entries/')) return Promise.resolve(ok(entry));
      throw new Error(url);
    });
    const { wrapper, router } = await setup(`/entries/${entry.id}`, EntryDetailView, fetchMock);
    await wrapper.get('.actions .danger').trigger('click');
    expect(wrapper.find('.dialog-stub').exists()).toBe(true);
    await wrapper.get('.dialog-stub .confirm').trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/entries/${entry.id}?expectedVersion=1`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(router.currentRoute.value.name).toBe('entries');
  });
});
