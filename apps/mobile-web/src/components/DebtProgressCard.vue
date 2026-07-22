<script setup lang="ts">
import { computed } from 'vue';
import type { Debt } from '../debt';
import { debtDirectionLabel, debtStatusLabel } from '../debt';
import { formatCent } from '../entry';

const props = defineProps<{ debt: Debt }>();
defineEmits<{ open: [] }>();
const progress = computed(() =>
  props.debt.principalCent > 0
    ? Math.min(100, Math.floor((props.debt.processedCent / props.debt.principalCent) * 100))
    : 0,
);
</script>

<template>
  <button class="debt-card" type="button" @click="$emit('open')">
    <span class="avatar" aria-hidden="true">{{
      debt.counterpartyName.trim().slice(0, 1) || '借'
    }}</span>
    <span class="body">
      <span class="title"
        ><b :title="debt.counterpartyName">{{ debt.counterpartyName }}</b
        ><small>{{ debtDirectionLabel(debt.direction) }}</small></span
      >
      <span class="meta" :class="{ overdue: debt.overdueDays > 0 }"
        >{{ debtStatusLabel(debt) }} · 已处理 {{ progress }}%</span
      >
      <span class="track" aria-hidden="true"><i :style="{ width: `${progress}%` }" /></span>
    </span>
    <span class="amount"
      ><small>{{ debt.direction === 'BORROWED' ? '剩余' : '待收' }}</small
      ><b>{{ formatCent(debt.remainingCent) }}</b></span
    >
  </button>
</template>

<style scoped>
.debt-card {
  display: grid;
  width: 100%;
  min-height: 92px;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--siyu-border);
  border-radius: 15px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
  text-align: left;
}
.avatar {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 50%;
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-weight: 700;
}
.body,
.title,
.amount {
  min-width: 0;
}
.title b {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.title small,
.meta,
.amount small {
  color: var(--siyu-text-secondary);
  font-size: 11px;
}
.meta {
  display: block;
  margin-top: 5px;
}
.overdue {
  color: var(--siyu-danger);
}
.track {
  display: block;
  height: 5px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--siyu-secondary-bg);
}
.track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--siyu-primary);
}
.amount {
  max-width: 116px;
  text-align: right;
}
.amount small,
.amount b {
  display: block;
}
.amount b {
  margin-top: 5px;
  color: var(--siyu-warning);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
@media (max-width: 340px) {
  .debt-card {
    grid-template-columns: 40px minmax(0, 1fr);
    padding: 12px;
  }
  .avatar {
    width: 40px;
    height: 40px;
  }
  .amount {
    grid-column: 2;
    max-width: none;
    text-align: left;
  }
  .amount small,
  .amount b {
    display: inline;
  }
  .amount b {
    margin-left: 5px;
  }
}
</style>
