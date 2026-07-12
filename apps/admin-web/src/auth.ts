import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

interface User {
  id: string;
  nickname: string;
  email: string | null;
  permissions: string[];
}
interface AuthPayload {
  accessToken: string;
  expiresIn: number;
  user: User;
}
interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  const body = (await response.json()) as ApiResponse<T>;
  if (!response.ok) throw new Error(body.message || '请求失败');
  return body.data;
}

export const useAuthStore = defineStore('admin-auth', () => {
  const accessToken = ref<string>();
  const user = ref<User>();
  const initialized = ref(false);
  const authenticated = computed(() => Boolean(accessToken.value && user.value));
  const isAdmin = computed(() => user.value?.permissions.includes('admin:access') ?? false);
  function accept(value: AuthPayload): void {
    accessToken.value = value.accessToken;
    user.value = value.user;
  }
  async function initialize(): Promise<void> {
    if (initialized.value) return;
    try {
      accept(await request<AuthPayload>('/auth/refresh', { method: 'POST' }));
    } catch {
      accessToken.value = undefined;
      user.value = undefined;
    } finally {
      initialized.value = true;
    }
  }
  async function login(email: string, password: string): Promise<void> {
    accept(
      await request<AuthPayload>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    );
    if (!isAdmin.value) {
      await logout();
      throw new Error('当前账号没有管理端访问权限');
    }
    await request('/admin/auth/check', {
      headers: { authorization: `Bearer ${accessToken.value}` },
    });
  }
  async function logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      accessToken.value = undefined;
      user.value = undefined;
    }
  }
  return { accessToken, user, initialized, authenticated, isAdmin, initialize, login, logout };
});
