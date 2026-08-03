<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { primaryNavigationIcons, type PrimaryNavKey } from '../app-icons';

const props = defineProps<{ active?: PrimaryNavKey }>();
const route = useRoute();

const items = [
  { key: 'home', label: '首页', to: '/home', icon: primaryNavigationIcons.home },
  { key: 'entries', label: '明细', to: '/entries', icon: primaryNavigationIcons.entries },
  { key: 'create', label: '记一笔', to: '/entries/new', icon: primaryNavigationIcons.create },
  { key: 'statistics', label: '统计', to: '/statistics', icon: primaryNavigationIcons.statistics },
  { key: 'profile', label: '我的', to: '/account', icon: primaryNavigationIcons.profile },
] as const;

const routeKeys: Record<string, PrimaryNavKey> = {
  dashboard: 'home',
  entries: 'entries',
  'entry-new': 'create',
  'entry-detail': 'entries',
  statistics: 'statistics',
  account: 'profile',
  exports: 'profile',
};
const currentActive = computed(() => props.active ?? routeKeys[String(route.name)]);
</script>

<template>
  <nav class="bottom-nav" aria-label="主要导航">
    <RouterLink
      v-for="item in items"
      :key="item.key"
      :class="[
        'bottom-nav__item',
        { active: currentActive === item.key, create: item.key === 'create' },
      ]"
      :to="item.to"
      :aria-current="currentActive === item.key ? 'page' : undefined"
    >
      <span aria-hidden="true"><component :is="item.icon" /></span>
      <small>{{ item.label }}</small>
    </RouterLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  min-height: calc(60px + env(safe-area-inset-bottom));
  grid-template-columns: repeat(5, 1fr);
  padding: 4px max(8px, calc((100vw - 480px) / 2)) env(safe-area-inset-bottom);
  border-top: 1px solid var(--siyu-border);
  background: color-mix(in srgb, var(--siyu-surface) 94%, transparent);
  backdrop-filter: blur(16px);
}
.bottom-nav__item {
  display: grid;
  min-width: 0;
  min-height: 54px;
  place-items: center;
  align-content: center;
  gap: 2px;
  color: var(--siyu-text-secondary);
  text-decoration: none;
}
.bottom-nav__item span {
  display: grid;
  width: 28px;
  height: 26px;
  place-items: center;
  border-radius: 10px;
  font-size: 20px;
}
.bottom-nav__item small {
  font-size: 11px;
}
.bottom-nav__item.active {
  color: var(--siyu-primary);
}
.bottom-nav__item.create span {
  width: 42px;
  height: 42px;
  margin-top: -21px;
  border: 4px solid var(--siyu-page-bg);
  border-radius: 50%;
  background: var(--siyu-primary);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--siyu-primary) 28%, transparent);
  color: #fff;
  font-size: 22px;
}
</style>
