import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BootstrapView from './BootstrapView.vue';

describe('Admin BootstrapView', () => {
  beforeEach(() => setActivePinia(createPinia()));
  it('renders the approved minimal operations console without financial editing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        const data = url.includes('/overview')
          ? { activeUsers: 2, disabledUsers: 1, activeLedgers: 2, failedRuns: 1, activeSessions: 1 }
          : { items: [], page: 1, pageSize: 50, total: 0, hasNext: false };
        return { ok: true, json: async () => ({ success: true, data }) } as Response;
      }),
    );
    const wrapper = mount(BootstrapView);
    await vi.waitFor(() => expect(wrapper.text()).toContain('活跃用户'));

    expect(wrapper.text()).toContain('四时有余管理后台');
    expect(wrapper.text()).toContain('运行概览');
    expect(wrapper.text()).toContain('周期任务');
    expect(wrapper.text()).not.toContain('工资金额');
  });
});
