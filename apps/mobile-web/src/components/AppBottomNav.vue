<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
</script>
<template>
  <nav class="bottom-nav" aria-label="主导航">
    <button type="button" disabled aria-disabled="true"><span>⌂</span>首页</button
    ><RouterLink
      :class="{ active: route.name === 'entries' }"
      :aria-current="route.name === 'entries' ? 'page' : undefined"
      to="/entries"
      ><span>≡</span>明细</RouterLink
    ><RouterLink class="create" to="/entries/new" aria-label="记一笔"
      ><span>＋</span>记账</RouterLink
    ><button type="button" disabled aria-disabled="true"><span>◇</span>统计</button
    ><RouterLink to="/account"><span>○</span>我的</RouterLink>
  </nav>
</template>
<style scoped>
.bottom-nav {
  position: fixed;
  z-index: 5;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  width: min(100%, 480px);
  min-height: calc(60px + env(safe-area-inset-bottom));
  margin: auto;
  padding: 4px 4px env(safe-area-inset-bottom);
  border-top: 1px solid var(--siyu-border);
  background: var(--siyu-surface);
}
a,
button {
  display: grid;
  min-width: 0;
  min-height: 52px;
  place-items: center;
  gap: 1px;
  padding: 2px;
  border: 0;
  background: transparent;
  color: var(--siyu-text-secondary);
  font-size: 11px;
  text-decoration: none;
}
span {
  font-size: 18px;
  line-height: 1;
}
.active {
  color: var(--siyu-primary);
  font-weight: 700;
}
.create span {
  display: grid;
  width: 42px;
  height: 42px;
  margin-top: -20px;
  place-items: center;
  border-radius: 50%;
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
  font-size: 27px;
  box-shadow: 0 5px 18px color-mix(in srgb, var(--siyu-primary) 35%, transparent);
}
button:disabled {
  color: var(--siyu-text-tertiary);
  opacity: 0.55;
}
</style>
