<script setup lang="ts">
import { categoryGlyph } from '../category';
import type { Category } from '../entry-resources';
defineProps<{
  categories: Category[];
  modelValue: string;
  disabled?: boolean;
  loading?: boolean;
}>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>
<template>
  <section class="category-section" aria-labelledby="category-grid-title">
    <div class="section-title">
      <h2 id="category-grid-title">分类</h2>
      <span v-if="loading">加载中…</span>
    </div>
    <div v-if="categories.length" class="category-grid">
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        :disabled="disabled || !category.isEnabled"
        :aria-pressed="modelValue === category.id"
        @click="$emit('update:modelValue', category.id)"
      >
        <span class="glyph" :style="{ '--category-color': category.color }">{{
          categoryGlyph(category.icon)
        }}</span
        ><span>{{ category.name }}</span>
      </button>
    </div>
    <p v-else-if="!loading" class="category-empty">当前类型没有可用分类，请先到分类管理中启用。</p>
  </section>
</template>
<style scoped>
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 {
  margin: 0 0 12px;
  font-size: 16px;
}
.section-title span,
.category-empty {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.category-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 6px;
}
button {
  display: grid;
  min-width: 0;
  min-height: 72px;
  place-items: center;
  gap: 5px;
  padding: 5px 2px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: transparent;
  color: var(--siyu-text);
  font-size: 12px;
}
button > span:last-child {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
button[aria-pressed='true'] {
  border-color: var(--siyu-primary);
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-weight: 700;
}
.glyph {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--category-color) 17%, var(--siyu-surface));
  color: var(--category-color);
  font-size: 15px;
  font-weight: 700;
}
.category-empty {
  margin: 0;
  padding: 16px;
  border-radius: 12px;
  background: var(--siyu-secondary-bg);
  line-height: 1.6;
}
@media (max-width: 340px) {
  .category-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap-inline: 2px;
  }
}
</style>
