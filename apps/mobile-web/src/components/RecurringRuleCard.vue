<script setup lang="ts">
import { categoryGlyph } from '../category';
import { formatAmount } from '../entry-money';
import {
  generationModeLabel,
  recurringFrequencyLabel,
  recurringProgressLabel,
  recurringStatusLabel,
  type RecurringRule,
} from '../recurring';

defineProps<{ rule: RecurringRule }>();
defineEmits<{ open: [] }>();
</script>

<template>
  <button class="rule-card" type="button" @click="$emit('open')">
    <span class="category" :style="{ '--category-color': rule.category.color }" aria-hidden="true">
      {{ categoryGlyph(rule.category.icon) }}
    </span>
    <span class="content">
      <span class="title-row">
        <strong>{{ rule.name }}</strong
        ><small :data-status="rule.status">{{ recurringStatusLabel(rule.status) }}</small>
      </span>
      <span class="schedule">
        {{ recurringFrequencyLabel(rule.frequency, rule.intervalValue) }} ·
        {{ generationModeLabel(rule.generationMode) }}
      </span>
      <span class="progress">
        {{ recurringProgressLabel(rule) }} ·
        {{ rule.nextRunDate ? `下次 ${rule.nextRunDate}` : '没有下一期' }}
      </span>
    </span>
    <span class="amount" :data-type="rule.entryType">
      {{ formatAmount(rule.amountCent, rule.entryType) }}
    </span>
  </button>
</template>

<style scoped>
.rule-card {
  display: grid;
  width: 100%;
  min-height: 96px;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  padding: 14px;
  border: 1px solid var(--siyu-border);
  border-radius: 16px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
  text-align: left;
}
.rule-card:focus-visible {
  outline: 3px solid var(--siyu-primary-soft);
  outline-offset: 2px;
}
.category {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--category-color) 17%, var(--siyu-surface));
  color: var(--category-color);
  font-weight: 700;
}
.content {
  display: grid;
  min-width: 0;
  gap: 5px;
}
.title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}
.title-row strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.title-row small {
  flex: 0 0 auto;
  padding: 3px 6px;
  border-radius: 999px;
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-size: 11px;
}
.title-row small[data-status='PAUSED'] {
  background: var(--siyu-warning-soft);
  color: var(--siyu-warning);
}
.title-row small[data-status='COMPLETED'],
.title-row small[data-status='CANCELLED'] {
  background: var(--siyu-secondary-bg);
  color: var(--siyu-text-secondary);
}
.schedule,
.progress {
  color: var(--siyu-text-secondary);
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.amount {
  align-self: center;
  color: var(--siyu-expense);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.amount[data-type='INCOME'] {
  color: var(--siyu-income);
}
@media (max-width: 360px) {
  .rule-card {
    grid-template-columns: 40px minmax(0, 1fr);
    padding: 12px;
  }
  .category {
    width: 40px;
    height: 40px;
  }
  .amount {
    grid-column: 2;
    justify-self: start;
  }
}
</style>
