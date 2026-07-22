<script setup lang="ts">
import { computed } from 'vue';

import { formatSalaryCent, type SalaryBalance } from '../salary';

const props = defineProps<{ balance: SalaryBalance }>();
const remainingClass = computed(() => (props.balance.remainingCent < 0 ? 'negative' : 'positive'));
</script>

<template>
  <section class="balance-card" aria-labelledby="salary-balance-title">
    <div class="balance-heading">
      <div>
        <p id="salary-balance-title">工资还剩多少</p>
        <strong v-if="props.balance.available" :class="remainingClass">
          {{ formatSalaryCent(props.balance.remainingCent) }}
        </strong>
        <strong v-else>暂无可计算工资</strong>
      </div>
      <span>截至 {{ props.balance.asOfDate }}</span>
    </div>
    <template v-if="props.balance.available">
      <div class="balance-grid">
        <div>
          <small>最近实发</small><b>{{ formatSalaryCent(props.balance.netSalaryCent) }}</b>
        </div>
        <div>
          <small>期间支出</small><b>{{ formatSalaryCent(props.balance.totalExpenseCent) }}</b>
        </div>
        <div>
          <small>固定支出</small><b>{{ formatSalaryCent(props.balance.fixedExpenseCent) }}</b>
        </div>
        <div>
          <small>日常支出</small><b>{{ formatSalaryCent(props.balance.dailyExpenseCent) }}</b>
        </div>
      </div>
      <p class="period-copy">
        统计期间 {{ props.balance.periodStartDate }} 至
        {{ props.balance.periodEndDate }}；距预计发薪日 {{ props.balance.remainingDays }} 天。
      </p>
      <p v-if="props.balance.dailyAvailableCent !== null" class="daily-copy">
        平均每天可用 {{ formatSalaryCent(props.balance.dailyAvailableCent) }}
      </p>
    </template>
    <p v-else class="period-copy">工资确认到账后，将按个人账本支出计算剩余金额。</p>
  </section>
</template>

<style scoped>
.balance-card {
  padding: 18px;
  border-radius: 18px;
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
  box-shadow: 0 12px 30px color-mix(in srgb, var(--siyu-primary) 22%, transparent);
}
.balance-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.balance-heading p,
.period-copy,
.daily-copy {
  margin: 0;
}
.balance-heading span,
.balance-heading p,
.period-copy {
  color: color-mix(in srgb, var(--siyu-on-primary) 76%, transparent);
  font-size: 12px;
}
.balance-heading strong {
  display: block;
  margin-top: 6px;
  font-size: clamp(22px, 7vw, 30px);
  overflow-wrap: anywhere;
}
.balance-heading strong.negative {
  color: var(--siyu-on-primary);
}
.balance-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}
.balance-grid div {
  display: grid;
  gap: 4px;
}
.balance-grid small {
  color: color-mix(in srgb, var(--siyu-on-primary) 70%, transparent);
}
.balance-grid b {
  overflow-wrap: anywhere;
}
.period-copy {
  margin-top: 16px;
  line-height: 1.6;
}
.daily-copy {
  margin-top: 8px;
  font-weight: 700;
}
</style>
