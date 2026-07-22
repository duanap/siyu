<script setup lang="ts">
import type { DebtSummary } from '../debt';
import { formatCent } from '../entry';

defineProps<{ summary: DebtSummary | undefined; loading?: boolean; error?: string }>();
</script>

<template>
  <section class="summary-card" aria-label="借贷汇总">
    <div class="summary-card__title">
      <div>
        <span>当前总负债</span
        ><strong>{{ summary ? formatCent(summary.totalDebtCent) : '—' }}</strong>
      </div>
      <div>
        <span>当前总待收款</span
        ><strong>{{ summary ? formatCent(summary.totalReceivableCent) : '—' }}</strong>
      </div>
    </div>
    <p v-if="loading" class="state" aria-live="polite">正在计算完整借贷汇总…</p>
    <p v-else-if="error" class="state error" role="alert">统计暂不可用：{{ error }}</p>
    <div v-else-if="summary" class="summary-card__grid">
      <div>
        <span>本月已还</span><b>{{ formatCent(summary.paidThisMonthCent) }}</b>
      </div>
      <div>
        <span>本月已收</span><b>{{ formatCent(summary.receivedThisMonthCent) }}</b>
      </div>
      <div>
        <span>7 日内到期</span><b>{{ summary.dueSoonCount }} 笔</b>
      </div>
      <div>
        <span>已逾期</span
        ><b :class="{ danger: summary.overdueCount > 0 }">{{ summary.overdueCount }} 笔</b>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-card {
  padding: 18px;
  border: 1px solid var(--siyu-border);
  border-radius: 18px;
  background: var(--siyu-surface);
}
.summary-card__title,
.summary-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.summary-card span {
  display: block;
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.summary-card strong {
  display: block;
  margin-top: 8px;
  overflow-wrap: anywhere;
  color: var(--siyu-primary);
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}
.summary-card__grid {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--siyu-border);
}
.summary-card b {
  display: block;
  margin-top: 5px;
  overflow-wrap: anywhere;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.state {
  margin: 16px 0 0;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.error,
.danger {
  color: var(--siyu-danger);
}
@media (max-width: 340px) {
  .summary-card {
    padding: 14px;
  }
  .summary-card__title {
    gap: 10px;
  }
  .summary-card strong {
    font-size: 18px;
  }
}
</style>
