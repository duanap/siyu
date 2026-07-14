<script setup lang="ts">
import type { EntryType, Ledger } from '../entry';
import type { Category } from '../entry-resources';
import AppDrawer from './AppDrawer.vue';

export interface CreatorOption {
  id: string;
  name: string;
}
export interface EntryFilters {
  type: EntryType | '';
  categoryId: string;
  creatorUserId: string;
}
const props = defineProps<{
  open: boolean;
  modelValue: EntryFilters;
  ledger: Ledger | undefined;
  categories: Category[];
  creators: CreatorOption[];
  loading?: boolean;
}>();
defineEmits<{ close: []; apply: [value: EntryFilters]; reset: [] }>();
const draft = defineModel<EntryFilters>('draft', { required: false });
function value(): EntryFilters {
  return draft.value ?? props.modelValue;
}
function patch(next: Partial<EntryFilters>) {
  draft.value = { ...value(), ...next };
}
</script>
<template>
  <AppDrawer :open="open" title="筛选账目" @close="$emit('close')"
    ><form class="filter-form" @submit.prevent="$emit('apply', value())">
      <fieldset>
        <legend>收支类型</legend>
        <div class="choice-row">
          <button
            v-for="item in [
              ['', '全部'],
              ['EXPENSE', '支出'],
              ['INCOME', '收入'],
            ] as const"
            :key="item[0]"
            type="button"
            :aria-pressed="value().type === item[0]"
            @click="patch({ type: item[0], categoryId: '' })"
          >
            {{ item[1] }}
          </button>
        </div>
      </fieldset>
      <label
        ><span>分类</span
        ><select
          :value="value().categoryId"
          :disabled="loading"
          @change="patch({ categoryId: ($event.target as HTMLSelectElement).value })"
        >
          <option value="">全部分类</option>
          <option
            v-for="category in categories.filter(
              (item) => !value().type || item.type === value().type,
            )"
            :key="category.id"
            :value="category.id"
          >
            {{ category.name }}{{ category.isEnabled ? '' : '（已停用）' }}
          </option>
        </select></label
      ><label v-if="ledger?.type === 'COUPLE'"
        ><span>创建人</span
        ><select
          :value="value().creatorUserId"
          @change="patch({ creatorUserId: ($event.target as HTMLSelectElement).value })"
        >
          <option value="">全部成员</option>
          <option
            v-if="
              value().creatorUserId && !creators.some((item) => item.id === value().creatorUserId)
            "
            :value="value().creatorUserId"
          >
            已选择的历史创建人
          </option>
          <option v-for="creator in creators" :key="creator.id" :value="creator.id">
            {{ creator.name }}
          </option>
        </select></label
      >
      <div class="actions">
        <button type="button" class="secondary" @click="$emit('reset')">清除筛选</button
        ><button type="submit" class="primary">应用筛选</button>
      </div>
    </form></AppDrawer
  >
</template>
<style scoped>
.filter-form {
  display: grid;
  gap: 18px;
}
fieldset {
  margin: 0;
  padding: 0;
  border: 0;
}
legend,
label > span {
  display: block;
  margin-bottom: 8px;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.choice-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}
.choice-row button,
select,
.actions button {
  min-height: 44px;
  border: 1px solid var(--siyu-border);
  border-radius: 12px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.choice-row button[aria-pressed='true'] {
  border-color: var(--siyu-primary);
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-weight: 700;
}
select {
  width: 100%;
  padding: 0 12px;
}
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}
.actions .primary {
  border-color: var(--siyu-primary);
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
}
</style>
