<script setup lang="ts">
import type { EntryPaymentMethod, EntryType, Ledger } from '../entry';
import type { Category } from '../entry-resources';
import CategoryGrid from './CategoryGrid.vue';
import EntryAmountInput from './EntryAmountInput.vue';
import LedgerSwitcher from './LedgerSwitcher.vue';

export interface EntryEditorModel {
  ledgerId: string;
  type: EntryType;
  amount: string;
  categoryId: string;
  businessDate: string;
  note: string;
  paymentMethod: EntryPaymentMethod | '';
}
const props = withDefaults(
  defineProps<{
    modelValue: EntryEditorModel;
    ledgers: Ledger[];
    categories: Category[];
    categoriesLoading?: boolean;
    disabled?: boolean;
    submitDisabled?: boolean;
    lockLedger?: boolean;
    submitLabel?: string;
  }>(),
  { submitLabel: '保存账目' },
);
const emit = defineEmits<{ 'update:modelValue': [value: EntryEditorModel]; submit: [] }>();
function patch(value: Partial<EntryEditorModel>) {
  emit('update:modelValue', { ...props.modelValue, ...value });
}
</script>
<template>
  <form class="entry-form" @submit.prevent="$emit('submit')">
    <LedgerSwitcher
      v-if="!lockLedger"
      :ledgers="ledgers"
      :model-value="modelValue.ledgerId"
      :disabled="disabled"
      @update:model-value="patch({ ledgerId: $event })"
    />
    <div class="type-switch" role="tablist" aria-label="收支类型">
      <button
        v-for="item in [
          ['EXPENSE', '支出'],
          ['INCOME', '收入'],
        ] as const"
        :key="item[0]"
        type="button"
        role="tab"
        :disabled="disabled"
        :aria-selected="modelValue.type === item[0]"
        :class="{ active: modelValue.type === item[0] }"
        @click="patch({ type: item[0], categoryId: '' })"
      >
        {{ item[1] }}
      </button>
    </div>
    <EntryAmountInput
      :model-value="modelValue.amount"
      :disabled="disabled"
      @update:model-value="patch({ amount: $event })"
    /><CategoryGrid
      :categories="categories"
      :model-value="modelValue.categoryId"
      :loading="categoriesLoading"
      :disabled="disabled"
      @update:model-value="patch({ categoryId: $event })"
    />
    <section class="fields">
      <label
        ><span>业务日期</span
        ><input
          :value="modelValue.businessDate"
          type="date"
          :disabled="disabled"
          required
          @input="patch({ businessDate: ($event.target as HTMLInputElement).value })" /></label
      ><label
        ><span>支付方式（选填）</span
        ><select
          :value="modelValue.paymentMethod"
          :disabled="disabled"
          @change="
            patch({
              paymentMethod: ($event.target as HTMLSelectElement).value as EntryPaymentMethod | '',
            })
          "
        >
          <option value="">未选择</option>
          <option value="CASH">现金</option>
          <option value="WECHAT">微信</option>
          <option value="ALIPAY">支付宝</option>
          <option value="BANK_CARD">银行卡</option>
          <option value="OTHER">其他</option>
        </select></label
      ><label
        ><span>备注（选填）</span
        ><textarea
          :value="modelValue.note"
          maxlength="500"
          :disabled="disabled"
          placeholder="记录这一笔的用途"
          @input="patch({ note: ($event.target as HTMLTextAreaElement).value })"
        /><small>{{ modelValue.note.length }}/500</small></label
      >
    </section>
    <button class="submit" type="submit" :disabled="disabled || submitDisabled">
      <slot name="submit">{{ submitLabel }}</slot>
    </button>
  </form>
</template>
<style scoped>
.entry-form {
  display: grid;
  gap: 18px;
}
.type-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
  border-radius: 14px;
  background: var(--siyu-secondary-bg);
}
.type-switch button {
  min-height: 44px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--siyu-text-secondary);
}
.type-switch .active {
  background: var(--siyu-surface);
  color: var(--siyu-primary);
  font-weight: 700;
  box-shadow: 0 1px 5px color-mix(in srgb, var(--siyu-text) 10%, transparent);
}
.fields {
  display: grid;
  gap: 12px;
}
label {
  display: grid;
  gap: 7px;
}
label > span {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
input,
select,
textarea {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 12px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
textarea {
  min-height: 88px;
  resize: vertical;
}
label small {
  color: var(--siyu-text-tertiary);
  text-align: right;
}
.submit {
  position: sticky;
  bottom: 8px;
  min-height: 52px;
  border: 0;
  border-radius: 14px;
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 6px 20px color-mix(in srgb, var(--siyu-primary) 25%, transparent);
}
button:disabled {
  opacity: 0.55;
}
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
button:focus-visible {
  outline: 3px solid var(--siyu-primary-soft);
  outline-offset: 2px;
}
</style>
