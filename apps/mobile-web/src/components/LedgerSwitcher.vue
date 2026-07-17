<script setup lang="ts">
import type { Ledger } from '../couple-ledger';

defineProps<{ ledgers: Ledger[]; modelValue: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <label class="ledger-switcher">
    <span>当前账本</span>
    <select
      :value="modelValue"
      :disabled="disabled"
      aria-label="当前账本"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="ledger in ledgers" :key="ledger.id" :value="ledger.id">
        {{ ledger.type === 'COUPLE' ? '朝暮同笺 · ' : '' }}{{ ledger.name }}
      </option>
    </select>
  </label>
</template>

<style scoped>
.ledger-switcher {
  display: grid;
  gap: 6px;
}
.ledger-switcher span {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.ledger-switcher select {
  width: 100%;
  min-height: 44px;
  padding: 0 38px 0 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 10px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
</style>
