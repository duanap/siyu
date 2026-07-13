<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAuthStore } from '../auth';
import { applyTheme, oppositeTheme, type ThemeMode } from '../theme';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const email = ref('');
const nickname = ref('');
const password = ref('');
const confirmPassword = ref('');
const submitting = ref(false);
const error = ref('');
const success = ref('');
const theme = ref<ThemeMode>(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
const mode = computed(() => String(route.name));
const title = computed(
  () =>
    ({ login: '欢迎回来', register: '创建账号', forgot: '找回密码', reset: '重置密码' })[
      mode.value
    ] || '身份认证',
);

function toggleTheme(): void {
  theme.value = oppositeTheme(theme.value);
  applyTheme(theme.value);
  localStorage.setItem('siyu-theme', theme.value);
}

async function submit(): Promise<void> {
  error.value = '';
  success.value = '';
  if (
    (mode.value === 'register' || mode.value === 'reset') &&
    password.value !== confirmPassword.value
  ) {
    error.value = '两次输入的密码不一致';
    return;
  }
  submitting.value = true;
  try {
    if (mode.value === 'login') {
      await auth.login(email.value, password.value);
      await router.replace(String(route.query.redirect || '/account'));
    } else if (mode.value === 'register') {
      await auth.register(email.value, password.value, nickname.value);
      await router.replace('/account');
    } else if (mode.value === 'forgot') {
      await auth.forgot(email.value);
      success.value = '如果该邮箱已注册，重置邮件将很快送达。';
    } else {
      await auth.reset(String(route.query.token || ''), password.value);
      success.value = '密码已重置，请重新登录。';
      setTimeout(() => void router.replace('/login'), 800);
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '请求失败，请稍后重试';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="auth-shell">
    <section aria-labelledby="auth-title" class="auth-card">
      <p class="brand">SIYU</p>
      <h1 id="auth-title">{{ title }}</h1>
      <p class="subtitle">朝暮同笺，四时有余。</p>
      <form @submit.prevent="submit">
        <label v-if="mode === 'register'"
          >昵称<input v-model.trim="nickname" autocomplete="name" maxlength="100" required
        /></label>
        <label v-if="mode !== 'reset'"
          >邮箱<input
            v-model.trim="email"
            autocomplete="email"
            inputmode="email"
            type="email"
            required
        /></label>
        <label v-if="mode !== 'forgot'"
          >密码<input
            v-model="password"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            minlength="12"
            maxlength="128"
            type="password"
            required
        /></label>
        <label v-if="mode === 'register' || mode === 'reset'"
          >确认密码<input
            v-model="confirmPassword"
            autocomplete="new-password"
            minlength="12"
            maxlength="128"
            type="password"
            required
        /></label>
        <p v-if="error" class="message error" role="alert">{{ error }}</p>
        <p v-if="success" class="message success" role="status">{{ success }}</p>
        <button :disabled="submitting" type="submit">{{ submitting ? '提交中…' : title }}</button>
      </form>
      <a v-if="mode === 'login'" class="qq" href="/api/v1/auth/qq/authorize">使用 QQ 登录</a>
      <nav>
        <RouterLink v-if="mode !== 'login'" to="/login">返回登录</RouterLink>
        <RouterLink v-if="mode === 'login'" to="/register">注册账号</RouterLink>
        <RouterLink v-if="mode === 'login'" to="/forgot-password">忘记密码</RouterLink>
        <button class="theme-link" type="button" @click="toggleTheme">
          {{ theme === 'light' ? '夜间模式' : '日间模式' }}
        </button>
      </nav>
    </section>
  </main>
</template>

<style scoped>
.auth-shell {
  display: grid;
  width: 100%;
  min-height: 100dvh;
  place-items: center;
  padding: 24px 16px;
  overflow-x: clip;
  background: var(--siyu-page-bg);
}
.auth-card {
  width: min(420px, calc(100vw - 32px));
  min-width: 0;
  padding: 28px 22px;
  border: 1px solid var(--siyu-border);
  border-radius: 16px;
  background: var(--siyu-surface);
  box-shadow: 0 18px 50px rgb(30 50 90 / 8%);
}
.brand {
  margin: 0;
  color: var(--siyu-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.24em;
}
h1 {
  margin: 10px 0 0;
  font-size: 28px;
}
.subtitle {
  margin: 8px 0 24px;
  color: var(--siyu-text-secondary);
}
form {
  display: grid;
  gap: 16px;
}
label {
  display: grid;
  gap: 7px;
  font-weight: 600;
}
input {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 10px;
  background: var(--siyu-page-bg);
  color: var(--siyu-text);
  font: inherit;
}
input:focus-visible,
button:focus-visible,
a:focus-visible {
  outline: 3px solid var(--siyu-primary-soft);
  outline-offset: 2px;
}
button,
.qq {
  display: grid;
  min-height: 44px;
  place-items: center;
  border: 0;
  border-radius: 12px;
  background: var(--siyu-primary);
  color: #fff;
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
button:disabled {
  cursor: wait;
  opacity: 0.65;
}
.qq {
  margin-top: 14px;
  background: #12b7f5;
}
.message {
  margin: 0;
  font-size: 13px;
}
.error {
  color: var(--siyu-danger);
}
.success {
  color: var(--siyu-income);
}
nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
}
nav a {
  min-height: 44px;
  color: var(--siyu-primary);
  line-height: 44px;
}
.theme-link {
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--siyu-primary);
  font-weight: 400;
}
</style>
