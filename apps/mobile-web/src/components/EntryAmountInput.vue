<script setup lang="ts">
import { computed } from 'vue';
import { normalizeAmountInput, parseAmountToCent } from '../entry-money';
const props = defineProps<{ modelValue: string; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const validation = computed(() =>
  props.modelValue ? parseAmountToCent(props.modelValue) : undefined,
);
function input(event: Event) {
  const target = event.target as HTMLInputElement;
  const next = normalizeAmountInput(target.value);
  if (next !== undefined) emit('update:modelValue', next);
  else target.value = props.modelValue;
}
</script>
<template>
  <label class="amount-field"
    ><span>金额</span
    ><span class="amount-control"
      ><b>¥</b
      ><input
        :value="modelValue"
        :disabled="disabled"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0.00"
        aria-describedby="amount-error"
        @input="input" /></span
    ><small v-if="validation && !validation.ok" id="amount-error" role="alert">{{
      validation.message
    }}</small></label
  >
</template>
<style scoped>
.amount-field > span:first-child {
  display: block;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.amount-control {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  border-bottom: 2px solid var(--siyu-primary);
}
b {
  font-size: 28px;
}
input {
  width: 100%;
  min-width: 0;
  height: 72px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--siyu-text);
  font-size: 42px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
input::placeholder {
  color: var(--siyu-text-tertiary);
}
small {
  display: block;
  margin-top: 6px;
  color: var(--siyu-danger);
}
@media (max-width: 340px) {
  input {
    font-size: 36px;
  }
}
</style>
