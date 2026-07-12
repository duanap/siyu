import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import BootstrapView from './BootstrapView.vue';

describe('Admin BootstrapView', () => {
  beforeEach(() => setActivePinia(createPinia()));
  it('uses the approved administration title without exposing financial data', () => {
    const wrapper = mount(BootstrapView);

    expect(wrapper.text()).toContain('四时有余管理后台');
    expect(wrapper.text()).toContain('管理后台工程基线已就绪');
    expect(wrapper.text()).not.toContain('工资金额');
  });
});
