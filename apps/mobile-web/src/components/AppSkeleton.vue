<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string;
    rows?: number;
    variant?: 'dashboard' | 'list' | 'statistics';
  }>(),
  {
    label: '正在加载',
    rows: 3,
    variant: 'list',
  },
);
</script>

<template>
  <section
    class="app-skeleton"
    :class="`app-skeleton--${variant}`"
    role="status"
    aria-live="polite"
  >
    <span class="visually-hidden">{{ label }}</span>
    <div class="app-skeleton__brand" aria-hidden="true">
      <img src="/icons/brand-mark.png" alt="" />
      <span class="app-skeleton__line app-skeleton__line--title" />
    </div>
    <div class="app-skeleton__hero" aria-hidden="true">
      <span class="app-skeleton__line app-skeleton__line--short" />
      <span class="app-skeleton__line app-skeleton__line--amount" />
      <span class="app-skeleton__line app-skeleton__line--medium" />
    </div>
    <div class="app-skeleton__rows" aria-hidden="true">
      <div v-for="index in rows" :key="index" class="app-skeleton__row">
        <span class="app-skeleton__avatar" />
        <span class="app-skeleton__copy">
          <span class="app-skeleton__line" />
          <span class="app-skeleton__line app-skeleton__line--short" />
        </span>
        <span class="app-skeleton__line app-skeleton__line--value" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.app-skeleton {
  display: grid;
  gap: 14px;
  color: var(--siyu-text-secondary);
}
.app-skeleton__brand,
.app-skeleton__row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.app-skeleton__brand img {
  width: 44px;
  height: 44px;
  border-radius: 14px;
}
.app-skeleton__hero,
.app-skeleton__rows {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--siyu-border);
  border-radius: 18px;
  background: var(--siyu-surface);
}
.app-skeleton__hero {
  min-height: 152px;
  align-content: center;
}
.app-skeleton__rows {
  gap: 0;
}
.app-skeleton__row {
  min-height: 72px;
  border-bottom: 1px solid var(--siyu-border);
}
.app-skeleton__row:last-child {
  border-bottom: 0;
}
.app-skeleton__copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 8px;
}
.app-skeleton__line,
.app-skeleton__avatar {
  display: block;
  overflow: hidden;
  border-radius: 999px;
  background: var(--siyu-secondary-bg);
}
.app-skeleton__line {
  width: 72%;
  height: 12px;
}
.app-skeleton__line::after,
.app-skeleton__avatar::after {
  display: block;
  width: 70%;
  height: 100%;
  animation: siyu-skeleton-shimmer 1.45s ease-in-out infinite;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, #fff 52%, transparent),
    transparent
  );
  content: '';
  transform: translateX(-120%);
}
.app-skeleton__line--title {
  width: 116px;
  height: 18px;
}
.app-skeleton__line--short {
  width: 42%;
}
.app-skeleton__line--medium {
  width: 62%;
}
.app-skeleton__line--amount {
  width: 58%;
  height: 34px;
}
.app-skeleton__line--value {
  width: 58px;
}
.app-skeleton__avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
}
.app-skeleton--statistics .app-skeleton__hero {
  min-height: 210px;
}
@keyframes siyu-skeleton-shimmer {
  to {
    transform: translateX(220%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .app-skeleton__line::after,
  .app-skeleton__avatar::after {
    animation: none;
  }
}
</style>
