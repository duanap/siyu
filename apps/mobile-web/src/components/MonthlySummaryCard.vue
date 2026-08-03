<script setup lang="ts">
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons-vue';
import summaryIllustration from '../assets/monthly-summary-illustration.png';
import { formatCent } from '../entry';
import type { StatisticsOverview } from '../statistics';

defineProps<{ overview: StatisticsOverview; prominent?: boolean; hidden?: boolean }>();
defineEmits<{ toggleVisibility: [] }>();
</script>

<template>
  <section :class="['monthly-summary', { prominent }]" aria-label="月度收支概览">
    <img
      v-if="prominent"
      class="summary-illustration"
      :src="summaryIllustration"
      alt=""
      aria-hidden="true"
    />
    <div class="summary-heading">
      <p>{{ overview.ledgerType === 'COUPLE' ? '本月共同结余' : '本月结余' }}</p>
      <button
        type="button"
        :aria-label="hidden ? '显示首页金额' : '隐藏首页金额'"
        @click="$emit('toggleVisibility')"
      >
        <EyeInvisibleOutlined v-if="hidden" aria-hidden="true" />
        <EyeOutlined v-else aria-hidden="true" />
      </button>
    </div>
    <strong>{{ hidden ? '••••••' : formatCent(overview.balanceCent) }}</strong>
    <dl>
      <div>
        <dt>本月收入</dt>
        <dd class="income">{{ hidden ? '••••••' : formatCent(overview.incomeCent) }}</dd>
      </div>
      <div>
        <dt>本月支出</dt>
        <dd class="expense">{{ hidden ? '••••••' : formatCent(overview.expenseCent) }}</dd>
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
  position: relative;
  min-height: 196px;
  padding: 24px;
  border-color: transparent;
  background: var(--siyu-primary);
  color: #fff;
}
.summary-illustration {
  position: absolute;
  top: 20px;
  right: 18px;
  width: 104px;
  height: 104px;
  object-fit: contain;
  opacity: 0.48;
  pointer-events: none;
}
.summary-heading {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
}
.summary-heading button {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 20px;
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
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 4px;
  overflow-wrap: anywhere;
  font-size: clamp(28px, 9vw, 34px);
  font-variant-numeric: tabular-nums;
}
dl {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0 0;
}
.prominent dl > div + div {
  padding-left: 18px;
  border-left: 1px solid rgb(255 255 255 / 28%);
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
.prominent .income,
.prominent .expense {
  color: #fff;
}
@media (max-width: 340px) {
  .monthly-summary.prominent {
    min-height: 184px;
    padding: 20px;
  }
  .summary-illustration {
    width: 88px;
    height: 88px;
  }
  .prominent dl > div + div {
    padding-left: 12px;
  }
}
</style>
