import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AuthenticationView from './AuthenticationView.vue';
import HomeView from './HomeView.vue';

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'request-1' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function routerFor(component: object, path: string, name: string) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, name, component },
      { path: '/login', name: 'login', component: AuthenticationView },
      { path: '/register', name: 'register', component: AuthenticationView },
      { path: '/forgot-password', name: 'forgot', component: AuthenticationView },
      { path: '/reset-password', name: 'reset', component: AuthenticationView },
      { path: '/privacy', name: 'privacy', component: { template: '<div />' } },
      { path: '/terms', name: 'terms', component: { template: '<div />' } },
    ],
  });
}

async function mountAt(component: object, path: string, name: string, capabilities: object) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(ok(capabilities))),
  );
  const router = routerFor(component, path, name);
  await router.push(path);
  await router.isReady();
  const wrapper = mount(component, { global: { plugins: [createPinia(), router] } });
  await flushPromises();
  return wrapper;
}

describe('authentication deployment capabilities (BR-AUTH-007)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('keeps email login usable and hides disabled QQ and password-reset entry points', async () => {
    const wrapper = await mountAt(AuthenticationView, '/login', 'login', {
      emailPassword: true,
      registration: false,
      qqOAuth: false,
      passwordReset: false,
    });
    expect(wrapper.text()).toContain('欢迎回来');
    expect(wrapper.text()).not.toContain('使用 QQ 登录');
    expect(wrapper.text()).not.toContain('忘记密码');
    expect(wrapper.text()).not.toContain('注册账号');
    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
  });

  it('shows a closed state instead of a reset form when mail reset is disabled', async () => {
    const wrapper = await mountAt(AuthenticationView, '/forgot-password', 'forgot', {
      emailPassword: true,
      registration: false,
      qqOAuth: false,
      passwordReset: false,
    });
    expect(wrapper.text()).toContain('此部署未启用邮件找回密码');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('shows a closed state instead of a registration form after controlled onboarding', async () => {
    const wrapper = await mountAt(AuthenticationView, '/register', 'register', {
      emailPassword: true,
      registration: false,
      qqOAuth: false,
      passwordReset: false,
    });
    expect(wrapper.text()).toContain('此部署已关闭新账号注册');
    expect(wrapper.find('form').exists()).toBe(false);
  });

  it('shows only server-enabled optional sign-in on the public home page', async () => {
    const wrapper = await mountAt(HomeView, '/', 'home', {
      emailPassword: true,
      registration: false,
      qqOAuth: false,
      passwordReset: false,
    });
    expect(wrapper.text()).toContain('使用邮箱登录');
    expect(wrapper.text()).toContain('私有账号模式');
    expect(wrapper.text()).not.toContain('使用 QQ 登录');
  });
});
