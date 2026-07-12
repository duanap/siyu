<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../auth';
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const auth = useAuthStore();
const router = useRouter();
async function submit(): Promise<void> {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    await router.replace('/');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <main>
    <section>
      <p class="brand">SIYU ADMIN</p>
      <h1>四时有余管理后台</h1>
      <form @submit.prevent="submit">
        <label
          >邮箱<input v-model.trim="email" autocomplete="username" type="email" required /></label
        ><label
          >密码<input v-model="password" autocomplete="current-password" type="password" required
        /></label>
        <p v-if="error" role="alert">{{ error }}</p>
        <button :disabled="loading" type="submit">{{ loading ? '登录中…' : '登录' }}</button>
      </form>
    </section>
  </main>
</template>
<style scoped>
main {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: 24px;
}
section {
  width: min(100%, 420px);
  padding: 28px;
  border: 1px solid var(--siyu-border);
  border-radius: 14px;
  background: var(--siyu-surface);
}
.brand {
  color: var(--siyu-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
}
form,
label {
  display: grid;
  gap: 8px;
}
form {
  gap: 16px;
  margin-top: 24px;
}
input,
button {
  min-height: 44px;
  border-radius: 10px;
  font: inherit;
}
input {
  padding: 0 12px;
  border: 1px solid var(--siyu-border);
  background: var(--siyu-page-bg);
  color: var(--siyu-text);
}
button {
  border: 0;
  background: var(--siyu-primary);
  color: #fff;
}
form p {
  color: var(--siyu-danger);
}
</style>
