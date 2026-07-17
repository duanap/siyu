<script setup lang="ts">
import { computed } from 'vue';
import { formatAmount } from '../entry-money';
import type { EntryType } from '../entry';

const props = defineProps<{ amountCent: number; type: EntryType; large?: boolean }>();
const text = computed(() => formatAmount(props.amountCent, props.type));
</script>

<template>
  <span
    class="app-amount"
    :class="[type.toLowerCase(), { large }]"
    :aria-label="`${type === 'INCOME' ? '收入' : '支出'}${text}`"
    >{{ text }}</span
  >
</template>

<style scoped>
.app-amount {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  white-space: nowrap;
}
.income {
  color: var(--siyu-income);
}
.expense {
  color: var(--siyu-expense);
}
.large {
  font-size: 32px;
}
</style>
