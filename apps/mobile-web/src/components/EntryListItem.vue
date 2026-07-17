<script setup lang="ts">
import { categoryGlyph } from '../category';
import { formatCent, type Entry } from '../entry';

defineProps<{ entry: Entry; showCreator?: boolean }>();
</script>

<template>
  <RouterLink class="entry-row" :to="`/entries/${entry.id}`">
    <span class="entry-row__icon" :style="{ '--entry-color': entry.category.color }">
      {{ categoryGlyph(entry.category.icon) }}
    </span>
    <span class="entry-row__content">
      <strong>{{ entry.category.name }}</strong>
      <small>
        {{ entry.note || '无备注' }}
        <template v-if="showCreator"> · {{ entry.creator.nickname }}</template>
      </small>
    </span>
    <span :class="['entry-row__amount', entry.type.toLowerCase()]">
      {{ entry.type === 'INCOME' ? '+' : '-' }}{{ formatCent(entry.amountCent) }}
    </span>
  </RouterLink>
</template>

<style scoped>
.entry-row {
  display: grid;
  min-height: 68px;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--siyu-border);
  color: var(--siyu-text);
  text-decoration: none;
}
.entry-row__icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--entry-color) 14%, var(--siyu-surface));
  color: var(--entry-color);
  font-weight: 700;
}
.entry-row__content {
  display: grid;
  min-width: 0;
  gap: 4px;
}
.entry-row__content strong,
.entry-row__content small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry-row__content small {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.entry-row__amount {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  white-space: nowrap;
}
.entry-row__amount.income {
  color: var(--siyu-income);
}
.entry-row__amount.expense {
  color: var(--siyu-expense);
}
@media (max-width: 340px) {
  .entry-row {
    grid-template-columns: 38px minmax(0, 1fr) auto;
    gap: 8px;
  }
  .entry-row__icon {
    width: 38px;
    height: 38px;
  }
  .entry-row__amount {
    font-size: 13px;
  }
}
</style>
