<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../auth';
const error = ref('');
const auth = useAuthStore();
const router = useRouter();
onMounted(async () => {
  try {
    await auth.initialize();
    if (!auth.authenticated) throw new Error('QQ 登录未完成');
    await router.replace('/account');
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'QQ 登录失败';
  }
});
</script>
<template>
  <main>
    <p v-if="!error" role="status">正在恢复 QQ 登录状态…</p>
    <p v-else role="alert">{{ error }} <RouterLink to="/login">返回登录</RouterLink></p>
  </main>
</template>
<style scoped>
main {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: 16px;
}
</style>
