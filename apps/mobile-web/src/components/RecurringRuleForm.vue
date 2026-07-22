<script setup lang="ts">
import type { EntryType, Ledger } from '../entry';
import type { Category } from '../entry-resources';
import type { GenerationMode, RecurringFrequency } from '../recurring';
import CategoryGrid from './CategoryGrid.vue';
import EntryAmountInput from './EntryAmountInput.vue';
import LedgerSwitcher from './LedgerSwitcher.vue';

export type RecurringEndMode = 'NONE' | 'DATE' | 'COUNT';

export interface RecurringRuleFormModel {
  ledgerId: string;
  name: string;
  entryType: EntryType;
  amount: string;
  categoryId: string;
  frequency: RecurringFrequency;
  intervalValue: number;
  startDate: string;
  generationMode: GenerationMode;
  endMode: RecurringEndMode;
  endDate: string;
  totalOccurrences: number;
  reminderDaysBefore: number;
}

const props = withDefaults(
  defineProps<{
    modelValue: RecurringRuleFormModel;
    ledgers: Ledger[];
    categories: Category[];
    categoriesLoading?: boolean;
    disabled?: boolean;
    submitDisabled?: boolean;
    lockLedger?: boolean;
  }>(),
  { categoriesLoading: false, disabled: false, submitDisabled: false, lockLedger: false },
);
const emit = defineEmits<{ 'update:modelValue': [value: RecurringRuleFormModel]; submit: [] }>();

function patch(value: Partial<RecurringRuleFormModel>) {
  emit('update:modelValue', { ...props.modelValue, ...value });
}
</script>

<template>
  <form class="recurring-form" @submit.prevent="$emit('submit')">
    <LedgerSwitcher
      v-if="!lockLedger"
      :ledgers="ledgers"
      :model-value="modelValue.ledgerId"
      :disabled="disabled"
      @update:model-value="patch({ ledgerId: $event })"
    />
    <label class="field">
      <span>规则名称</span>
      <input
        :value="modelValue.name"
        maxlength="100"
        required
        placeholder="例如：房租"
        :disabled="disabled"
        @input="patch({ name: ($event.target as HTMLInputElement).value })"
      />
      <small>{{ modelValue.name.length }}/100</small>
    </label>
    <div class="choice" role="tablist" aria-label="收支类型">
      <button
        v-for="item in [
          ['EXPENSE', '支出'],
          ['INCOME', '收入'],
        ] as const"
        :key="item[0]"
        type="button"
        role="tab"
        :disabled="disabled"
        :aria-selected="modelValue.entryType === item[0]"
        :class="{ active: modelValue.entryType === item[0] }"
        @click="patch({ entryType: item[0], categoryId: '' })"
      >
        {{ item[1] }}
      </button>
    </div>
    <EntryAmountInput
      :model-value="modelValue.amount"
      :disabled="disabled"
      @update:model-value="patch({ amount: $event })"
    />
    <CategoryGrid
      :categories="categories"
      :model-value="modelValue.categoryId"
      :loading="categoriesLoading"
      :disabled="disabled"
      @update:model-value="patch({ categoryId: $event })"
    />
    <section class="fields">
      <div class="pair">
        <label class="field">
          <span>重复频率</span>
          <select
            :value="modelValue.frequency"
            :disabled="disabled"
            @change="
              patch({ frequency: ($event.target as HTMLSelectElement).value as RecurringFrequency })
            "
          >
            <option value="MONTHLY">按月</option>
            <option value="YEARLY">按年</option>
          </select>
        </label>
        <label class="field">
          <span>间隔</span>
          <input
            :value="modelValue.intervalValue"
            type="number"
            min="1"
            max="1200"
            inputmode="numeric"
            :disabled="disabled"
            @input="patch({ intervalValue: Number(($event.target as HTMLInputElement).value) })"
          />
        </label>
      </div>
      <label class="field">
        <span>开始日期</span>
        <input
          :value="modelValue.startDate"
          type="date"
          required
          :disabled="disabled"
          @input="patch({ startDate: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <fieldset>
        <legend>生成方式</legend>
        <label
          v-for="item in [
            ['AUTO', '自动记账'],
            ['CONFIRM', '到期确认'],
          ] as const"
          :key="item[0]"
        >
          <input
            type="radio"
            name="generation-mode"
            :value="item[0]"
            :checked="modelValue.generationMode === item[0]"
            :disabled="disabled"
            @change="patch({ generationMode: item[0] as GenerationMode })"
          />
          <span>{{ item[1] }}</span>
        </label>
        <small>到期确认会先生成待确认事项，确认实际金额后才入账。</small>
      </fieldset>
      <label class="field">
        <span>结束条件</span>
        <select
          :value="modelValue.endMode"
          :disabled="disabled"
          @change="
            patch({ endMode: ($event.target as HTMLSelectElement).value as RecurringEndMode })
          "
        >
          <option value="NONE">不设结束</option>
          <option value="DATE">指定结束日期</option>
          <option value="COUNT">指定总期数</option>
        </select>
      </label>
      <label v-if="modelValue.endMode === 'DATE'" class="field">
        <span>结束日期</span>
        <input
          :value="modelValue.endDate"
          type="date"
          :min="modelValue.startDate"
          required
          :disabled="disabled"
          @input="patch({ endDate: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <label v-if="modelValue.endMode === 'COUNT'" class="field">
        <span>总期数</span>
        <input
          :value="modelValue.totalOccurrences"
          type="number"
          min="1"
          inputmode="numeric"
          required
          :disabled="disabled"
          @input="patch({ totalOccurrences: Number(($event.target as HTMLInputElement).value) })"
        />
      </label>
      <label class="field">
        <span>提前提醒天数</span>
        <input
          :value="modelValue.reminderDaysBefore"
          type="number"
          min="0"
          max="365"
          inputmode="numeric"
          :disabled="disabled"
          @input="patch({ reminderDaysBefore: Number(($event.target as HTMLInputElement).value) })"
        />
        <small>0 表示到期当天；站内通知读取功能将在通知任务中上线。</small>
      </label>
    </section>
    <button class="submit" type="submit" :disabled="disabled || submitDisabled">
      <slot name="submit">保存规则</slot>
    </button>
  </form>
</template>

<style scoped>
.recurring-form {
  display: grid;
  gap: 18px;
}
.field,
.fields {
  display: grid;
  gap: 7px;
}
.fields {
  gap: 14px;
}
.field > span,
legend {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.field small,
fieldset small {
  color: var(--siyu-text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}
.field > small:first-of-type {
  text-align: right;
}
input,
select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 9px 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 12px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.choice {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
  border-radius: 14px;
  background: var(--siyu-secondary-bg);
}
.choice button {
  min-height: 44px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--siyu-text-secondary);
}
.choice button.active {
  background: var(--siyu-surface);
  color: var(--siyu-primary);
  font-weight: 700;
}
.pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(100px, 0.55fr);
  gap: 10px;
}
fieldset {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 14px;
}
fieldset legend {
  padding: 0 5px;
}
fieldset label {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
}
fieldset input {
  width: 18px;
  min-height: 18px;
}
fieldset small {
  grid-column: 1 / -1;
}
.submit {
  margin-top: 4px;
  min-height: 52px;
  border: 0;
  border-radius: 14px;
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
  font-size: 16px;
  font-weight: 700;
}
button:disabled,
input:disabled,
select:disabled {
  opacity: 0.55;
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid var(--siyu-primary-soft);
  outline-offset: 2px;
}
@media (max-width: 340px) {
  .pair {
    grid-template-columns: 1fr;
  }
}
</style>
