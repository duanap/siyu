import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { OpenApiComponents } from '@siyu/shared-types';

export type AuthUser = OpenApiComponents['schemas']['User'];

interface AuthPayload {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

interface ApiResponse<T> {
  success: true;
  data: T;
  requestId: string;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  const body = (await response.json()) as ApiResponse<T> & { message?: string };
  if (!response.ok) throw new Error(body.message || '请求失败，请稍后重试');
  return body.data;
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string>();
  const user = ref<AuthUser>();
  const initialized = ref(false);
  const authenticated = computed(() => Boolean(accessToken.value && user.value));

  function accept(payload: AuthPayload): void {
    accessToken.value = payload.accessToken;
    user.value = payload.user;
  }

  async function initialize(): Promise<void> {
    if (initialized.value) return;
    try {
      accept(await api<AuthPayload>('/auth/refresh', { method: 'POST' }));
    } catch {
      accessToken.value = undefined;
      user.value = undefined;
    } finally {
      initialized.value = true;
    }
  }

  async function refresh(): Promise<void> {
    accept(await api<AuthPayload>('/auth/refresh', { method: 'POST' }));
  }

  function clear(): void {
    accessToken.value = undefined;
    user.value = undefined;
  }

  async function login(email: string, password: string): Promise<void> {
    accept(
      await api<AuthPayload>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    );
  }

  async function register(email: string, password: string, nickname: string): Promise<void> {
    accept(
      await api<AuthPayload>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, nickname }),
      }),
    );
  }

  async function forgot(email: string): Promise<void> {
    await api('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) });
  }

  async function reset(token: string, newPassword: string): Promise<void> {
    await api('/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  async function logout(): Promise<void> {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      clear();
    }
  }

  return {
    accessToken,
    user,
    initialized,
    authenticated,
    initialize,
    refresh,
    clear,
    login,
    register,
    forgot,
    reset,
    logout,
  };
});
