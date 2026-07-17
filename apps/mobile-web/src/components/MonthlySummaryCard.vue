<script setup lang="ts">
import { formatCent } from '../entry';
import type { StatisticsOverview } from '../statistics';

defineProps<{ overview: StatisticsOverview; prominent?: boolean }>();
</script>

<template>
  <section :class="['monthly-summary', { prominent }]" aria-label="月度收支概览">
    <p>{{ overview.ledgerType === 'COUPLE' ? '本月共同结余' : '本月结余' }}</p>
    <strong>{{ formatCent(overview.balanceCent) }}</strong>
    <dl>
      <div>
        <dt>收入</dt>
        <dd class="income">{{ formatCent(overview.incomeCent) }}</dd>
      </div>
      <div>
        <dt>支出</dt>
        <dd class="expense">{{ formatCent(overview.expenseCent) }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.monthly-summary {
  padding: 18px;
  border: 1px solid var(--siyu-border);
  border-radius: 16px;
  background: var(--siyu-surface);
}
.monthly-summary.prominent {
  border-color: transparent;
  background: var(--siyu-primary);
  color: #fff;
}
p {
  margin: 0;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.prominent p,
.prominent dt,
.prominent dd {
  color: rgb(255 255 255 / 82%);
}
strong {
  display: block;
  margin-top: 8px;
  overflow-wrap: anywhere;
  font-size: clamp(28px, 9vw, 34px);
  font-variant-numeric: tabular-nums;
}
dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0 0;
}
dl div {
  min-width: 0;
}
dt {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
dd {
  margin: 5px 0 0;
  overflow-wrap: anywhere;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.income {
  color: var(--siyu-income);
}
.expense {
  color: var(--siyu-expense);
}
</style>
