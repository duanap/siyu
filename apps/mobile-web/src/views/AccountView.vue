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
  <main class="page">
    <section>
      <p class="brand">SIYU</p>
      <h1>账号已就绪</h1>
      <p>{{ auth.user?.nickname }}</p>
      <p>{{ auth.user?.email || 'QQ 用户' }}</p>
      <p class="hint">记录日常收支，并在明细中查看和管理账目。</p>
      <RouterLink class="entry-link" to="/entries">查看账目明细</RouterLink>
      <RouterLink class="entry-link" to="/entries/new">记一笔</RouterLink>
      <RouterLink class="account-link" to="/categories">管理收支分类</RouterLink>
      <RouterLink class="couple-link" to="/couple/invite">管理朝暮同笺</RouterLink>
      <button type="button" @click="logout">退出登录</button>
    </section>
  </main>
</template>
<style scoped>
.page {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: 16px;
}
.page section {
  width: min(100%, 420px);
}
.brand {
  color: var(--siyu-primary);
  font-weight: 700;
  letter-spacing: 0.2em;
}
.hint {
  color: var(--siyu-text-secondary);
}
button {
  min-height: 44px;
  padding: 0 20px;
  border: 0;
  border-radius: 12px;
  background: var(--siyu-primary);
  color: #fff;
}
.couple-link,
.account-link,
.entry-link {
  display: grid;
  min-height: 44px;
  place-items: center;
  margin-bottom: 12px;
  border: 1px solid var(--siyu-primary);
  border-radius: 12px;
  color: var(--siyu-primary);
  text-decoration: none;
}
.account-link {
  margin-bottom: 12px;
}
</style>
