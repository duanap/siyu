import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppSkeleton from './AppSkeleton.vue';

describe('AppSkeleton', () => {
  it('announces loading once and keeps decorative shapes hidden', () => {
    const wrapper = mount(AppSkeleton, {
      props: { label: '正在准备首页', rows: 4, variant: 'dashboard' },
    });
    expect(wrapper.get('[role="status"]').text()).toBe('正在准备首页');
    expect(wrapper.findAll('.app-skeleton__row')).toHaveLength(4);
    expect(wrapper.get('.app-skeleton__brand img').attributes('alt')).toBe('');
  });
});
