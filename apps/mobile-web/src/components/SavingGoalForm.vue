<script setup lang="ts">
import type { Ledger } from '../entry';

export interface SavingGoalFormModel {
  ledgerId: string;
  name: string;
  targetAmount: string;
  initialAmount: string;
  targetDate: string;
  coverUrl: string;
  note: string;
}

const props = defineProps<{
  modelValue: SavingGoalFormModel;
  ledgers?: Ledger[];
  edit?: boolean;
  busy?: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: SavingGoalFormModel];
  submit: [];
}>();

function update<K extends keyof SavingGoalFormModel>(key: K, value: SavingGoalFormModel[K]) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
</script>

<template>
  <form class="saving-goal-form field-stack" @submit.prevent="$emit('submit')">
    <label v-if="!edit && ledgers?.length">
      所属账本
      <select
        :value="modelValue.ledgerId"
        :disabled="busy"
        @change="update('ledgerId', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="ledger in ledgers" :key="ledger.id" :value="ledger.id">
          {{ ledger.name }} · {{ ledger.type === 'PERSONAL' ? '个人账本' : '朝暮同笺' }}
        </option>
      </select>
    </label>
    <label>
      目标名称
      <input
        :value="modelValue.name"
        :disabled="busy"
        maxlength="100"
        autocomplete="off"
        placeholder="例如：旅行基金"
        @input="update('name', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      目标金额（元）
      <input
        :value="modelValue.targetAmount"
        :disabled="busy"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0.00"
        @input="update('targetAmount', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label v-if="!edit">
      初始已存（元）
      <input
        :value="modelValue.initialAmount"
        :disabled="busy"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0.00"
        @input="update('initialAmount', ($event.target as HTMLInputElement).value)"
      />
      <small>初始金额计入创建者贡献，可以为 0。</small>
    </label>
    <label>
      目标日期（可选）
      <input
        :value="modelValue.targetDate"
        :disabled="busy"
        type="date"
        @input="update('targetDate', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      封面图片网址（可选）
      <input
        :value="modelValue.coverUrl"
        :disabled="busy"
        type="url"
        maxlength="2048"
        inputmode="url"
        autocomplete="url"
        placeholder="https://example.com/cover.jpg"
        @input="update('coverUrl', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <label>
      备注（可选）
      <textarea
        :value="modelValue.note"
        :disabled="busy"
        maxlength="500"
        placeholder="写下这个目标的计划"
        @input="update('note', ($event.target as HTMLTextAreaElement).value)"
      />
    </label>
    <button class="primary-button" type="submit" :disabled="busy">
      {{ busy ? '正在保存…' : edit ? '保存目标修改' : '创建攒钱目标' }}
    </button>
  </form>
</template>

<style scoped>
.saving-goal-form small {
  color: var(--siyu-text-tertiary);
  line-height: 1.5;
}
</style>
