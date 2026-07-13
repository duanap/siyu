<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../auth';
const auth = useAuthStore();
const router = useRouter();
async function logout(): Promise<void> {
  await auth.logout();
  await router.replace('/login');
}
</script>
<template>
  <main class="admin-shell">
    <header>
      <div>
        <strong>四时有余管理后台</strong>
        <button type="button" @click="logout">退出</button>
      </div>
    </header>
    <section aria-labelledby="status-title">
      <h1 id="status-title">管理后台工程基线已就绪</h1>
      <p>
        {{ auth.user?.nickname }}
        已通过管理员身份验证。用户、账本关系、任务与审计功能将在后续获批任务中实现。
      </p>
    </section>
  </main>
</template>

<style scoped>
.admin-shell {
  min-height: 100dvh;
}

header {
  min-height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid var(--siyu-border);
  background: var(--siyu-surface);
}

header > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
}

header span {
  color: var(--siyu-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
}
button {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--siyu-border);
  border-radius: 10px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}

section {
  padding: 64px 24px;
}

h1 {
  margin: 0;
  font-size: 26px;
}

p {
  margin-top: 14px;
  color: var(--siyu-text-secondary);
}
</style>
