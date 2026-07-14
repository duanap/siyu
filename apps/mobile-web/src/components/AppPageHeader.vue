<script setup lang="ts">
defineProps<{ title: string; backLabel?: string }>();
defineEmits<{ back: [] }>();
</script>

<template>
  <header class="app-page-header">
    <button v-if="backLabel" type="button" class="header-action" @click="$emit('back')">
      {{ backLabel }}
    </button>
    <span v-else class="header-spacer" aria-hidden="true" />
    <h1>{{ title }}</h1>
    <div class="header-end"><slot /></div>
  </header>
</template>

<style scoped>
.app-page-header {
  display: grid;
  grid-template-columns: minmax(44px, 1fr) auto minmax(44px, 1fr);
  align-items: center;
  min-height: 64px;
  gap: 8px;
}
h1 {
  margin: 0;
  font-size: 22px;
  text-align: center;
}
.header-action {
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--siyu-primary);
  text-align: left;
}
.header-end {
  display: flex;
  justify-content: flex-end;
  min-width: 44px;
}
button:focus-visible {
  outline: 3px solid var(--siyu-primary-soft);
  outline-offset: 2px;
}
</style>
