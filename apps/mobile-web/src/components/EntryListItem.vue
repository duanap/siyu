<script setup lang="ts">
import { categoryGlyph } from '../category';
import type { Entry, Ledger } from '../entry';
import AppAmount from './AppAmount.vue';
defineProps<{ entry: Entry; ledgerType: Ledger['type']; highlighted?: boolean }>();
defineEmits<{ open: [] }>();
const paymentLabels = {
  CASH: '现金',
  WECHAT: '微信',
  ALIPAY: '支付宝',
  BANK_CARD: '银行卡',
  OTHER: '其他',
} as const;
const sourceLabels = {
  SALARY: '工资',
  DEBT_TRANSACTION: '借贷',
  RECURRING_RUN: '周期账目',
} as const;
</script>
<template>
  <button class="entry-item" :class="{ highlighted }" type="button" @click="$emit('open')">
    <span class="icon" :style="{ '--category-color': entry.category.color }" aria-hidden="true">{{
      categoryGlyph(entry.category.icon)
    }}</span
    ><span class="main"
      ><span class="title-row"
        ><strong>{{ entry.category.name }}</strong
        ><small v-if="!entry.category.isEnabled">已停用</small
        ><small v-if="entry.sourceType !== 'MANUAL'">{{
          sourceLabels[entry.sourceType]
        }}</small></span
      ><span v-if="entry.note" class="note">{{ entry.note }}</span
      ><span class="meta"
        ><span v-if="ledgerType === 'COUPLE'">{{ entry.creator.nickname }}</span
        ><span v-if="entry.paymentMethod">{{ paymentLabels[entry.paymentMethod] }}</span></span
      ></span
    ><AppAmount :amount-cent="entry.amountCent" :type="entry.type" />
  </button>
</template>
<style scoped>
.entry-item {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  width: 100%;
  min-height: 78px;
  align-items: center;
  gap: 11px;
  padding: 11px 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 15px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
  text-align: left;
  transition:
    border-color 0.2s,
    background 0.2s;
}
.highlighted {
  border-color: var(--siyu-primary);
  background: var(--siyu-primary-soft);
}
.icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--category-color) 17%, var(--siyu-surface));
  color: var(--category-color);
  font-weight: 700;
}
.main {
  min-width: 0;
}
.title-row,
.meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
strong,
.note {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.title-row small {
  padding: 2px 5px;
  border-radius: 5px;
  background: var(--siyu-secondary-bg);
  color: var(--siyu-text-secondary);
  font-size: 10px;
}
.note {
  margin-top: 4px;
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.meta {
  margin-top: 5px;
  color: var(--siyu-text-tertiary);
  font-size: 11px;
}
.meta span + span::before {
  margin-right: 6px;
  content: '·';
}
button:focus-visible {
  outline: 3px solid var(--siyu-primary-soft);
  outline-offset: 2px;
}
@media (max-width: 340px) {
  .entry-item {
    grid-template-columns: 40px minmax(0, 1fr) auto;
    gap: 7px;
    padding-inline: 8px;
  }
  .icon {
    width: 40px;
    height: 40px;
  }
  .app-amount {
    font-size: 13px;
  }
}
</style>
