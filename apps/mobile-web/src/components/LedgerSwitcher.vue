<script setup lang="ts">
import { ref } from 'vue';
import type { Ledger } from '../entry';
import AppDrawer from './AppDrawer.vue';
const props = defineProps<{ ledgers: Ledger[]; modelValue: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const open = ref(false);
function select(id: string) {
  emit('update:modelValue', id);
  open.value = false;
}
</script>
<template>
  <div class="ledger-switcher">
    <button type="button" :disabled="disabled" aria-haspopup="dialog" @click="open = true">
      <span>当前账本</span
      ><strong>{{ ledgers.find((item) => item.id === modelValue)?.name || '选择账本' }}</strong
      ><span aria-hidden="true">⌄</span></button
    ><AppDrawer :open="open" title="选择账本" @close="open = false"
      ><div class="ledger-options">
        <button
          v-for="ledger in props.ledgers"
          :key="ledger.id"
          type="button"
          :aria-pressed="ledger.id === modelValue"
          @click="select(ledger.id)"
        >
          <span
            ><strong>{{ ledger.name }}</strong
            ><small>{{ ledger.type === 'PERSONAL' ? '个人账本' : '朝暮同笺' }}</small></span
          ><span v-if="ledger.id === modelValue" aria-hidden="true">✓</span>
        </button>
      </div></AppDrawer
    >
  </div>
</template>
<style scoped>
.ledger-switcher > button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  width: 100%;
  min-height: 52px;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border: 1px solid var(--siyu-border);
  border-radius: 14px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
  text-align: left;
}
.ledger-switcher > button > span:first-child {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.ledger-switcher strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ledger-options {
  display: grid;
  gap: 8px;
}
.ledger-options button {
  display: flex;
  width: 100%;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border: 1px solid var(--siyu-border);
  border-radius: 14px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
  text-align: left;
}
.ledger-options button[aria-pressed='true'] {
  border-color: var(--siyu-primary);
  background: var(--siyu-primary-soft);
}
.ledger-options small {
  display: block;
  margin-top: 4px;
  color: var(--siyu-text-secondary);
}
</style>
