<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { isRequestCancelled } from '../api';
import AppEmpty from '../components/AppEmpty.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import LedgerSwitcher from '../components/LedgerSwitcher.vue';
import SavingGoalCard from '../components/SavingGoalCard.vue';
import type { Ledger } from '../entry';
import { listLedgers } from '../entry-resources';
import { persistLedgerId, resolveLedger } from '../ledger-context';
import { createSavingGoalsApi, formatSavingCent, type SavingGoal } from '../saving-goals';
import { useApiSession } from '../use-api-session';

const route = useRoute();
const router = useRouter();
const session = useApiSession();
const api = createSavingGoalsApi(session);
const ledgers = ref<Ledger[]>([]);
const selectedLedgerId = ref('');
const goals = ref<SavingGoal[]>([]);
const loading = ref(true);
const refreshing = ref(false);
const fatal = ref('');
let controller: AbortController | undefined;

const selectedLedger = computed(() =>
  ledgers.value.find((ledger) => ledger.id === selectedLedgerId.value),
);
const targetTotal = computed(() =>
  goals.value.reduce((total, goal) => total + BigInt(goal.targetCent), 0n),
);
const savedTotal = computed(() =>
  goals.value.reduce((total, goal) => total + BigInt(goal.savedCent), 0n),
);
const completedCount = computed(
  () => goals.value.filter((goal) => goal.status === 'COMPLETED').length,
);

async function syncQuery() {
  await router.replace({ name: 'saving-goals', query: { ledgerId: selectedLedgerId.value } });
}

async function loadGoals(initial = false) {
  if (!selectedLedgerId.value) return;
  controller?.abort();
  controller = new AbortController();
  if (initial) loading.value = true;
  else refreshing.value = true;
  fatal.value = '';
  try {
    goals.value = await api.listAll(selectedLedgerId.value, controller.signal);
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '攒钱目标加载失败';
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

async function initialize() {
  loading.value = true;
  fatal.value = '';
  try {
    ledgers.value = await listLedgers(session);
    const requested = typeof route.query.ledgerId === 'string' ? route.query.ledgerId : '';
    const resolved = resolveLedger(ledgers.value, requested);
    if (!resolved.ledger) throw new Error('没有可用账本');
    selectedLedgerId.value = resolved.ledger.id;
    persistLedgerId(resolved.ledger.id);
    await syncQuery();
    await loadGoals(true);
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '攒钱目标加载失败';
    loading.value = false;
  }
}

async function selectLedger(ledgerId: string) {
  if (!ledgerId || ledgerId === selectedLedgerId.value) return;
  selectedLedgerId.value = ledgerId;
  persistLedgerId(ledgerId);
  await syncQuery();
  await loadGoals();
}

function openGoal(goal: SavingGoal) {
  void router.push({
    name: 'saving-goal-detail',
    params: { id: goal.id },
    query: { ledgerId: selectedLedgerId.value },
  });
}

onMounted(initialize);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <main class="business-page saving-list-page">
    <AppPageHeader title="攒钱目标" back-label="返回" @back="router.push('/account')">
      <RouterLink
        class="header-link"
        :to="{ name: 'saving-goal-new', query: { ledgerId: selectedLedgerId } }"
        >新增</RouterLink
      >
    </AppPageHeader>
    <section v-if="loading" class="state-panel" aria-live="polite">正在加载攒钱目标…</section>
    <AppErrorState
      v-else-if="fatal"
      title="攒钱目标加载失败"
      :message="fatal"
      retry-label="重试"
      @retry="initialize"
    />
    <template v-else>
      <LedgerSwitcher
        :model-value="selectedLedgerId"
        :ledgers="ledgers"
        :disabled="refreshing"
        @update:model-value="selectLedger"
      />
      <section class="saving-summary" aria-label="攒钱目标概览">
        <small>{{ selectedLedger?.type === 'COUPLE' ? '共同目标' : '个人目标' }}</small>
        <strong>{{ formatSavingCent(savedTotal) }} / {{ formatSavingCent(targetTotal) }}</strong>
        <p>共 {{ goals.length }} 个目标，{{ completedCount }} 个已完成</p>
      </section>
      <p v-if="refreshing" class="refreshing-copy" aria-live="polite">正在切换账本…</p>
      <AppEmpty
        v-if="!goals.length && !refreshing"
        title="还没有攒钱目标"
        description="从一笔初始积累开始，为旅行、应急储备或共同计划慢慢攒下进度。"
      >
        <RouterLink
          class="primary-button"
          :to="{ name: 'saving-goal-new', query: { ledgerId: selectedLedgerId } }"
          >创建第一个目标</RouterLink
        >
      </AppEmpty>
      <section v-else class="goal-list" aria-label="目标列表">
        <SavingGoalCard v-for="goal in goals" :key="goal.id" :goal="goal" @open="openGoal(goal)" />
      </section>
      <p class="scope-copy">
        {{
          selectedLedger?.type === 'COUPLE'
            ? '朝暮同笺双方可查看和存入；目标管理权限以服务端返回为准。'
            : '个人目标仅本人可见。'
        }}
      </p>
    </template>
  </main>
</template>

<style scoped>
.saving-list-page {
  display: grid;
  align-content: start;
  gap: 16px;
}
.header-link {
  display: inline-flex;
  min-width: 44px;
  min-height: 44px;
  align-items: center;
  justify-content: flex-end;
  color: var(--siyu-primary);
  text-decoration: none;
}
.saving-summary {
  padding: 20px 16px;
  border-radius: 18px;
  background: var(--siyu-primary-soft);
}
.saving-summary small,
.saving-summary p,
.scope-copy,
.refreshing-copy {
  color: var(--siyu-text-secondary);
}
.saving-summary strong {
  display: block;
  margin-top: 8px;
  overflow-wrap: anywhere;
  color: var(--siyu-primary);
  font-size: clamp(22px, 7vw, 30px);
  font-variant-numeric: tabular-nums;
}
.saving-summary p,
.scope-copy,
.refreshing-copy {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
}
.goal-list {
  display: grid;
  gap: 12px;
}
.scope-copy {
  margin: 0;
  text-align: center;
}
</style>
