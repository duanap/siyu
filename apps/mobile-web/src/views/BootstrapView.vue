<script setup lang="ts">
import { ref } from 'vue';

import { applyTheme, oppositeTheme, type ThemeMode } from '../theme';

const theme = ref<ThemeMode>('light');
applyTheme(theme.value);

function toggleTheme(): void {
  theme.value = oppositeTheme(theme.value);
  applyTheme(theme.value);
}
</script>

<template>
  <main class="bootstrap-shell">
    <section aria-labelledby="brand-title" class="brand-block">
      <p class="english-name">SIYU</p>
      <h1 id="brand-title">朝暮同笺 · 四时有余</h1>
      <p class="slogan">朝暮同笺，四时有余。</p>
      <p class="status" role="status">手机端工程基线已就绪，业务功能尚未开始实现。</p>
      <button class="theme-toggle" type="button" @click="toggleTheme">
        切换至{{ theme === 'light' ? '夜间' : '日间' }}模式
      </button>
    </section>
  </main>
</template>

<style scoped>
.bootstrap-shell {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: 24px 16px;
}

.brand-block {
  width: min(100%, 480px);
  text-align: center;
}

.english-name {
  margin: 0 0 16px;
  color: var(--siyu-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.24em;
}

h1 {
  margin: 0;
  font-size: clamp(24px, 7vw, 32px);
  line-height: 1.35;
}

.slogan {
  margin: 18px 0 0;
  color: var(--siyu-text-secondary);
  font-size: 16px;
}

.status {
  margin: 48px auto 0;
  max-width: 320px;
  color: var(--siyu-text-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.theme-toggle {
  min-width: 160px;
  min-height: 44px;
  margin-top: 20px;
  border: 1px solid var(--siyu-border);
  border-radius: 12px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
  cursor: pointer;
}

.theme-toggle:focus-visible {
  outline: 3px solid var(--siyu-primary-soft);
  outline-offset: 2px;
}
</style>
