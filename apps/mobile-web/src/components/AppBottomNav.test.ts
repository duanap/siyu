import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';
import AppBottomNav from './AppBottomNav.vue';

describe('AppBottomNav', () => {
  it('selects entries and links every implemented destination', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/entries', name: 'entries', component: { template: '<div/>' } },
        { path: '/entries/new', name: 'entry-new', component: { template: '<div/>' } },
        { path: '/home', name: 'dashboard', component: { template: '<div/>' } },
        { path: '/statistics', name: 'statistics', component: { template: '<div/>' } },
        { path: '/account', name: 'account', component: { template: '<div/>' } },
      ],
    });
    await router.push('/entries');
    await router.isReady();
    const wrapper = mount(AppBottomNav, { global: { plugins: [router] } });
    expect(wrapper.get('[aria-current="page"]').text()).toContain('明细');
    expect(wrapper.findAll('button[aria-disabled="true"]')).toHaveLength(0);
    expect(wrapper.get('a[href="/home"]').attributes('href')).toBe('/home');
    expect(wrapper.get('a[href="/statistics"]').attributes('href')).toBe('/statistics');
    expect(wrapper.get('a.create').attributes('href')).toBe('/entries/new');
  });
});
