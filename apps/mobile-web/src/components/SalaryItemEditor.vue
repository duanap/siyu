<script setup lang="ts">
import type { EditableSalaryItem } from '../salary';

const props = withDefaults(
  defineProps<{ items: EditableSalaryItem[]; disabled?: boolean; allowZero?: boolean }>(),
  { disabled: false, allowZero: false },
);
const emit = defineEmits<{ 'update:items': [items: EditableSalaryItem[]] }>();

function update(index: number, patch: Partial<EditableSalaryItem>) {
  emit(
    'update:items',
    props.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
  );
}

function add(itemType: EditableSalaryItem['itemType']) {
  const prefix = itemType === 'EARNING' ? 'earning' : 'deduction';
  let suffix = props.items.length + 1;
  while (props.items.some((item) => item.itemCode === `${prefix}_${suffix}`)) suffix += 1;
  emit('update:items', [
    ...props.items,
    {
      itemType,
      itemCode: `${prefix}_${suffix}`,
      itemName: itemType === 'EARNING' ? '其他收入' : '其他扣除',
      amount: props.allowZero ? '0.00' : '',
    },
  ]);
}

function remove(index: number) {
  emit(
    'update:items',
    props.items.filter((_, itemIndex) => itemIndex !== index),
  );
}
</script>

<template>
  <div class="salary-editor">
    <article
      v-for="(item, index) in props.items"
      :key="`${item.itemCode}-${index}`"
      class="item-card"
    >
      <div class="item-heading">
        <strong>{{ item.itemName || `项目 ${index + 1}` }}</strong>
        <button
          type="button"
          class="remove-action"
          :disabled="props.disabled || props.items.length <= 1"
          :aria-label="`删除${item.itemName || '工资项目'}`"
          @click="remove(index)"
        >
          删除
        </button>
      </div>
      <div class="item-fields">
        <label>
          类型
          <select
            :value="item.itemType"
            :disabled="props.disabled"
            @change="
              update(index, {
                itemType: ($event.target as HTMLSelectElement)
                  .value as EditableSalaryItem['itemType'],
              })
            "
          >
            <option value="EARNING">收入</option>
            <option value="DEDUCTION">扣除</option>
          </select>
        </label>
        <label>
          名称
          <input
            :value="item.itemName"
            maxlength="100"
            :disabled="props.disabled"
            autocomplete="off"
            @input="update(index, { itemName: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <label>
          金额（元）
          <input
            :value="item.amount"
            inputmode="decimal"
            placeholder="0.00"
            :disabled="props.disabled"
            @input="update(index, { amount: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <label>
          项目代码
          <input
            :value="item.itemCode"
            maxlength="50"
            :disabled="props.disabled"
            autocapitalize="off"
            autocomplete="off"
            @input="update(index, { itemCode: ($event.target as HTMLInputElement).value })"
          />
        </label>
      </div>
    </article>
    <div v-if="!props.disabled" class="add-actions">
      <button type="button" class="secondary-button" @click="add('EARNING')">添加收入项</button>
      <button type="button" class="secondary-button" @click="add('DEDUCTION')">添加扣除项</button>
    </div>
  </div>
</template>

<style scoped>
.salary-editor,
.item-fields {
  display: grid;
  gap: 12px;
}
.item-card {
  padding: 14px;
  border: 1px solid var(--siyu-border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--siyu-surface) 92%, var(--siyu-primary) 8%);
}
.item-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.item-heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
}
.remove-action {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--siyu-danger);
}
.remove-action:disabled {
  opacity: 0.45;
}
.item-fields {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.item-fields label {
  display: grid;
  gap: 6px;
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.item-fields input,
.item-fields select {
  width: 100%;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid var(--siyu-border);
  border-radius: 10px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.item-fields input:focus,
.item-fields select:focus {
  border-color: var(--siyu-primary);
  outline: 3px solid var(--siyu-primary-soft);
}
.add-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 340px) {
  .item-fields {
    grid-template-columns: 1fr;
  }
}
</style>
