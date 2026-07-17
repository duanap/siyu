<script setup lang="ts">
defineProps<{ title: string; message: string; retryLabel?: string }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <section class="app-error" role="alert">
    <h2>{{ title }}</h2>
    <p>{{ message }}</p>
    <button v-if="retryLabel" type="button" @click="$emit('retry')">{{ retryLabel }}</button
    ><slot />
  </section>
</template>
<style scoped>
.app-error {
  padding: 28px 18px;
  border: 1px solid var(--siyu-border);
  border-radius: 18px;
  background: var(--siyu-surface);
  text-align: center;
}
h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
p {
  margin: 0;
  color: var(--siyu-text-secondary);
  overflow-wrap: anywhere;
}
button {
  min-height: 44px;
  margin-top: 16px;
  padding: 0 18px;
  border: 0;
  border-radius: 12px;
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
}
</style>
