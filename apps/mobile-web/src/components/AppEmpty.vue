<script setup lang="ts">
defineProps<{ title: string; description: string }>();
</script>
<template>
  <section class="app-state">
    <div aria-hidden="true" class="state-mark">○</div>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <slot />
  </section>
</template>
<style scoped>
.app-state {
  padding: 36px 20px;
  border: 1px solid var(--siyu-border);
  border-radius: 18px;
  background: var(--siyu-surface);
  text-align: center;
}
.state-mark {
  color: var(--siyu-primary);
  font-size: 32px;
}
h2 {
  margin: 8px 0;
  font-size: 18px;
}
p {
  margin: 0 0 16px;
  color: var(--siyu-text-secondary);
  line-height: 1.6;
}
</style>
