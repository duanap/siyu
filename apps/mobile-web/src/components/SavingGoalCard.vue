<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  formatSavingCent,
  formatSavingProgress,
  savingGoalStatusLabel,
  type SavingGoal,
} from '../saving-goals';

const props = defineProps<{ goal: SavingGoal }>();
defineEmits<{ open: [] }>();
const coverFailed = ref(false);
const progressWidth = computed(() => Math.min(100, props.goal.progressBasisPoints / 100));
watch(
  () => props.goal.coverUrl,
  () => (coverFailed.value = false),
);
</script>

<template>
  <button type="button" class="saving-goal-card" @click="$emit('open')">
    <img
      v-if="goal.coverUrl && !coverFailed"
      class="goal-cover"
      :src="goal.coverUrl"
      :alt="`${goal.name}封面`"
      referrerpolicy="no-referrer"
      @error="coverFailed = true"
    />
    <span v-else class="goal-mark" aria-hidden="true">{{ goal.name.slice(0, 1) }}</span>
    <span class="goal-content">
      <span class="goal-heading">
        <strong>{{ goal.name }}</strong>
        <small :class="goal.status.toLowerCase()">{{ savingGoalStatusLabel(goal.status) }}</small>
      </span>
      <span class="goal-meta">
        <span>{{ formatSavingProgress(goal.progressBasisPoints) }}</span>
        <span>{{ goal.targetDate ? `目标 ${goal.targetDate}` : '未设置目标日期' }}</span>
      </span>
      <span class="progress-track" aria-hidden="true"
        ><span :style="{ width: `${progressWidth}%` }"
      /></span>
      <span class="goal-amount">
        <span>已存 {{ formatSavingCent(goal.savedCent) }}</span>
        <span>目标 {{ formatSavingCent(goal.targetCent) }}</span>
      </span>
    </span>
  </button>
</template>

<style scoped>
.saving-goal-card {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  width: 100%;
  min-height: 116px;
  align-items: start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--siyu-border);
  border-radius: 14px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
  text-align: left;
}
.goal-cover,
.goal-mark {
  width: 48px;
  height: 48px;
  border-radius: 14px;
}
.goal-cover {
  object-fit: cover;
}
.goal-mark {
  display: grid;
  place-items: center;
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-size: 18px;
  font-weight: 700;
}
.goal-content,
.goal-heading,
.goal-meta,
.goal-amount {
  display: flex;
  min-width: 0;
}
.goal-content {
  flex-direction: column;
  gap: 8px;
}
.goal-heading,
.goal-meta,
.goal-amount {
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.goal-heading strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.goal-heading small {
  flex: none;
  color: var(--siyu-text-secondary);
}
.goal-heading small.completed {
  color: var(--siyu-income);
}
.goal-meta,
.goal-amount {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.goal-meta span:last-child,
.goal-amount span:last-child {
  text-align: right;
}
.progress-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--siyu-secondary-bg);
}
.progress-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--siyu-primary);
}
.saving-goal-card:focus-visible {
  outline: 3px solid var(--siyu-primary-soft);
  outline-offset: 2px;
}
@media (max-width: 340px) {
  .saving-goal-card {
    grid-template-columns: 40px minmax(0, 1fr);
    padding: 14px 12px;
  }
  .goal-cover,
  .goal-mark {
    width: 40px;
    height: 40px;
  }
  .goal-amount {
    align-items: flex-start;
    flex-direction: column;
  }
  .goal-amount span:last-child {
    text-align: left;
  }
}
</style>
