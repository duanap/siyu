import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../auth';
import CoupleLedgerView from './CoupleLedgerView.vue';

vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }));

function response(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'req_test' }), {
    status: 200,
  });
}

describe('CoupleLedgerView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'access-token';
    auth.user = {
      id: 'user-owner',
      nickname: '朝暮',
      email: 'owner@example.com',
      roles: ['USER'],
      permissions: [],
    };
    vi.restoreAllMocks();
  });

  it('renders the empty create and accept state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ items: [], page: 1, pageSize: 1, total: 0 })),
    );
    const wrapper = mount(CoupleLedgerView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('尚未加入朝暮同笺');
    expect(wrapper.text()).toContain('创建情侣账本');
    expect(wrapper.text()).toContain('接受邀请');
  });

  it('renders members and owner-only controls for an active couple ledger', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          items: [
            {
              id: 'ledger-id',
              type: 'COUPLE',
              name: '我们的朝暮同笺',
              ownerUserId: 'user-owner',
              status: 'ACTIVE',
              members: [
                {
                  userId: 'user-owner',
                  nickname: '朝暮',
                  avatarUrl: null,
                  role: 'OWNER',
                  joinedAt: '2026-07-14T00:00:00Z',
                },
              ],
            },
          ],
          page: 1,
          pageSize: 1,
          total: 1,
        }),
      ),
    );
    const wrapper = mount(CoupleLedgerView, {
      global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('我们的朝暮同笺');
    expect(wrapper.text()).toContain('所有者');
    expect(wrapper.text()).toContain('生成邀请');
    expect(wrapper.text()).toContain('解散情侣账本');
  });
});
