<script setup lang="ts">
import type { Entry } from '../entry';
import AppAmount from './AppAmount.vue';
defineProps<{ entry: Entry; ledgerName: string }>();
const paymentLabels = {
  CASH: '现金',
  WECHAT: '微信',
  ALIPAY: '支付宝',
  BANK_CARD: '银行卡',
  OTHER: '其他',
} as const;
const sourceLabels = {
  MANUAL: '手工记账',
  SALARY: '工资生成',
  DEBT_TRANSACTION: '借贷生成',
  RECURRING_RUN: '周期生成',
} as const;
function dateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
</script>
<template>
  <section class="detail-card">
    <div class="amount-block">
      <span>{{ entry.type === 'INCOME' ? '收入' : '支出' }}</span
      ><AppAmount large :amount-cent="entry.amountCent" :type="entry.type" />
    </div>
    <dl>
      <div>
        <dt>分类</dt>
        <dd>{{ entry.category.name }}<small v-if="!entry.category.isEnabled">已停用</small></dd>
      </div>
      <div>
        <dt>业务日期</dt>
        <dd>{{ entry.businessDate }}</dd>
      </div>
      <div>
        <dt>所属账本</dt>
        <dd>{{ ledgerName }}</dd>
      </div>
      <div>
        <dt>创建人</dt>
        <dd>{{ entry.creator.nickname }}</dd>
      </div>
      <div>
        <dt>支付方式</dt>
        <dd>{{ entry.paymentMethod ? paymentLabels[entry.paymentMethod] : '未填写' }}</dd>
      </div>
      <div>
        <dt>来源</dt>
        <dd>{{ sourceLabels[entry.sourceType] }}</dd>
      </div>
      <div class="wide">
        <dt>备注</dt>
        <dd>{{ entry.note || '未填写' }}</dd>
      </div>
      <div>
        <dt>创建时间</dt>
        <dd>{{ dateTime(entry.createdAt) }}</dd>
      </div>
      <div>
        <dt>修改时间</dt>
        <dd>{{ dateTime(entry.updatedAt) }}</dd>
      </div>
    </dl>
    <p v-if="entry.sourceType !== 'MANUAL'" class="source-note">
      该账目由关联业务生成，请在对应业务中管理。
    </p>
  </section>
</template>
<style scoped>
.detail-card {
  overflow: hidden;
  border: 1px solid var(--siyu-border);
  border-radius: 18px;
  background: var(--siyu-surface);
}
.amount-block {
  display: grid;
  gap: 8px;
  padding: 28px 18px;
  background: var(--siyu-primary-soft);
  text-align: center;
}
.amount-block > span {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 0;
}
dl > div {
  min-width: 0;
  padding: 14px 16px;
  border-top: 1px solid var(--siyu-border);
}
.wide {
  grid-column: 1/-1;
}
dt {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
dd {
  margin: 5px 0 0;
  overflow-wrap: anywhere;
}
dd small {
  margin-left: 6px;
  color: var(--siyu-warning);
}
.source-note {
  margin: 0;
  padding: 14px 16px;
  border-top: 1px solid var(--siyu-border);
  background: var(--siyu-secondary-bg);
  color: var(--siyu-text-secondary);
  line-height: 1.6;
}
@media (max-width: 340px) {
  dl {
    grid-template-columns: 1fr;
  }
  .wide {
    grid-column: auto;
  }
}
</style>
