<script setup lang="ts">
import { formatAmount } from '../entry-money';
import { recurringRunStatusLabel, type RecurringRun } from '../recurring';

withDefaults(defineProps<{ run: RecurringRun; busy?: boolean; actions?: boolean }>(), {
  busy: false,
  actions: false,
});
defineEmits<{ confirm: []; skip: [] }>();
</script>

<template>
  <article class="run-card" :data-status="run.status">
    <div class="run-head">
      <div>
        <strong>{{ run.rule.name }}</strong
        ><small>{{ run.scheduledDate }} · {{ recurringRunStatusLabel(run.status) }}</small>
      </div>
      <b :data-type="run.rule.entryType">{{ formatAmount(run.amountCent, run.rule.entryType) }}</b>
    </div>
    <p v-if="run.status === 'FAILED'">本次生成失败，可在任务管理上线后查看和重试。</p>
    <div v-if="actions && (run.canConfirm || run.canSkip)" class="run-actions">
      <button
        v-if="run.canConfirm"
        type="button"
        class="confirm"
        :disabled="busy"
        @click="$emit('confirm')"
      >
        确认金额并入账
      </button>
      <button v-if="run.canSkip" type="button" :disabled="busy" @click="$emit('skip')">
        跳过本期
      </button>
    </div>
  </article>
</template>

<style scoped>
.run-card {
  padding: 14px;
  border: 1px solid var(--siyu-border);
  border-left: 4px solid var(--siyu-primary);
  border-radius: 14px;
  background: var(--siyu-surface);
}
.run-card[data-status='FAILED'] {
  border-left-color: var(--siyu-danger);
}
.run-card[data-status='SKIPPED'] {
  border-left-color: var(--siyu-text-tertiary);
}
.run-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}
.run-head > div {
  display: grid;
  min-width: 0;
  gap: 5px;
}
.run-head strong {
  overflow-wrap: anywhere;
}
.run-head small,
p {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.run-head b {
  flex: 0 0 auto;
  color: var(--siyu-expense);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.run-head b[data-type='INCOME'] {
  color: var(--siyu-income);
}
p {
  margin: 10px 0 0;
  line-height: 1.6;
}
.run-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(96px, auto);
  gap: 8px;
  margin-top: 12px;
}
.run-actions button {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 12px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.run-actions .confirm {
  border-color: var(--siyu-primary);
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
}
.run-actions button:disabled {
  opacity: 0.55;
}
@media (max-width: 340px) {
  .run-head {
    display: grid;
  }
  .run-actions {
    grid-template-columns: 1fr;
  }
}
</style>
