<script setup lang="ts">
import EntryAmountInput from './EntryAmountInput.vue';

export interface DebtEditorModel {
  direction: 'BORROWED' | 'LENT';
  counterpartyName: string;
  amount: string;
  startDate: string;
  dueDate: string;
  note: string;
  reminderEnabled: boolean;
}

const props = defineProps<{
  modelValue: DebtEditorModel;
  editing?: boolean;
  disabled?: boolean;
  submitDisabled?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: DebtEditorModel];
  submit: [];
}>();

function update<K extends keyof DebtEditorModel>(key: K, value: DebtEditorModel[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
</script>

<template>
  <form class="debt-form" @submit.prevent="$emit('submit')">
    <fieldset v-if="!editing" :disabled="disabled" class="direction-tabs">
      <legend>借贷方向</legend>
      <button
        v-for="item in [
          { value: 'BORROWED', label: '我欠别人的' },
          { value: 'LENT', label: '别人欠我的' },
        ] as const"
        :key="item.value"
        type="button"
        role="tab"
        :aria-selected="modelValue.direction === item.value"
        @click="update('direction', item.value)"
      >
        {{ item.label }}
      </button>
    </fieldset>

    <label class="field"
      ><span>对方名称</span
      ><input
        :value="modelValue.counterpartyName"
        :disabled="disabled"
        maxlength="100"
        autocomplete="off"
        placeholder="姓名或备注名称"
        required
        @input="update('counterpartyName', ($event.target as HTMLInputElement).value)"
    /></label>

    <EntryAmountInput
      v-if="!editing"
      :model-value="modelValue.amount"
      :disabled="disabled"
      @update:model-value="update('amount', $event)"
    />

    <div class="date-grid">
      <label v-if="!editing" class="field"
        ><span>开始日期</span
        ><input
          :value="modelValue.startDate"
          :disabled="disabled"
          type="date"
          required
          @input="update('startDate', ($event.target as HTMLInputElement).value)"
      /></label>
      <label class="field"
        ><span>到期日期（选填）</span
        ><input
          :value="modelValue.dueDate"
          :disabled="disabled"
          type="date"
          :min="modelValue.startDate"
          @input="update('dueDate', ($event.target as HTMLInputElement).value)"
      /></label>
    </div>

    <label class="field"
      ><span>备注（选填）</span
      ><textarea
        :value="modelValue.note"
        :disabled="disabled"
        maxlength="500"
        rows="3"
        placeholder="用途、约定或其他说明"
        @input="update('note', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>

    <label class="switch-field"
      ><input
        :checked="modelValue.reminderEnabled"
        :disabled="disabled"
        type="checkbox"
        @change="update('reminderEnabled', ($event.target as HTMLInputElement).checked)"
      /><span
        ><b>保存提醒偏好</b><small>通知模块上线前仅记录设置，不会发送提醒。</small></span
      ></label
    >

    <button class="submit" type="submit" :disabled="disabled || submitDisabled">
      <slot name="submit">保存</slot>
    </button>
  </form>
</template>

<style scoped>
.debt-form {
  display: grid;
  gap: 18px;
}
.direction-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 4px;
  border: 0;
  border-radius: 14px;
  background: var(--siyu-secondary-bg);
}
.direction-tabs legend {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
.direction-tabs button {
  min-height: 44px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--siyu-text-secondary);
}
.direction-tabs button[aria-selected='true'] {
  background: var(--siyu-surface);
  color: var(--siyu-primary);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--siyu-text) 8%, transparent);
  font-weight: 700;
}
.field,
.switch-field {
  display: grid;
  gap: 7px;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.field input,
.field textarea {
  width: 100%;
  min-height: 46px;
  padding: 10px 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 12px;
  outline: 0;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.field textarea {
  min-height: 92px;
  resize: vertical;
}
.field input:focus,
.field textarea:focus {
  border-color: var(--siyu-primary);
}
.date-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.date-grid > :only-child {
  grid-column: 1 / -1;
}
.switch-field {
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: start;
  min-height: 44px;
}
.switch-field input {
  width: 22px;
  height: 22px;
  margin: 1px auto;
}
.switch-field b,
.switch-field small {
  display: block;
}
.switch-field b {
  color: var(--siyu-text);
}
.switch-field small {
  margin-top: 4px;
  line-height: 1.5;
}
.submit {
  min-height: 50px;
  border: 0;
  border-radius: 14px;
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
  font-weight: 700;
}
.submit:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}
@media (max-width: 340px) {
  .date-grid {
    grid-template-columns: 1fr;
  }
}
</style>
