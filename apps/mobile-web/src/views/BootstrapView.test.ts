import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import BootstrapView from './BootstrapView.vue';

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe('BootstrapView', () => {
  it('renders the approved brand and toggles theme', async () => {
    const wrapper = mount(BootstrapView);

    expect(wrapper.text()).toContain('朝暮同笺 · 四时有余');
    expect(document.documentElement.dataset.theme).toBe('light');

    await wrapper.get('button').trigger('click');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(wrapper.get('button').text()).toContain('日间');
  });
});
