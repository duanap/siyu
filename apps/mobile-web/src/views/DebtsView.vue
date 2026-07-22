<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { isRequestCancelled } from '../api';
import { useAuthStore } from '../auth';
import AppEmpty from '../components/AppEmpty.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import DebtProgressCard from '../components/DebtProgressCard.vue';
import DebtSummaryCard from '../components/DebtSummaryCard.vue';
import { createDebtApi, summarizeDebts, type Debt, type DebtSummary } from '../debt';
import { localBusinessDate } from '../ledger-context';
import { useApiSession } from '../use-api-session';

type Filter = 'ALL' | 'BORROWED' | 'LENT' | 'OVERDUE' | 'SETTLED';
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const api = createDebtApi(useApiSession());
const debts = ref<Debt[]>([]);
const summary = ref<DebtSummary>();
const loading = ref(true);
const summaryLoading = ref(false);
const fatal = ref('');
const summaryError = ref('');
const filter = ref<Filter>('ALL');
let controller: AbortController | undefined;

const filteredDebts = computed(() =>
  debts.value.filter((debt) => {
    if (filter.value === 'BORROWED' || filter.value === 'LENT')
      return debt.direction === filter.value;
    if (filter.value === 'OVERDUE') return debt.overdueDays > 0;
    if (filter.value === 'SETTLED') return debt.status === 'SETTLED';
    return true;
  }),
);

async function detailBatch(items: Debt[], signal: AbortSignal): Promise<Debt[]> {
  const result: Debt[] = [];
  for (let offset = 0; offset < items.length; offset += 5) {
    result.push(
      ...(await Promise.all(
        items.slice(offset, offset + 5).map((item) => api.get(item.id, signal)),
      )),
    );
  }
  return result;
}

async function load() {
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  fatal.value = '';
  summary.value = undefined;
  summaryError.value = '';
  try {
    debts.value = await api.listAll(controller.signal);
    loading.value = false;
    summaryLoading.value = true;
    const details = await detailBatch(debts.value, controller.signal);
    const today = localBusinessDate(auth.user?.timezone);
    summary.value = summarizeDebts(details, today.slice(0, 7), today);
  } catch (cause) {
    if (isRequestCancelled(cause)) return;
    const message = cause instanceof Error ? cause.message : '借贷加载失败';
    if (loading.value) fatal.value = message;
    else summaryError.value = message;
  } finally {
    loading.value = false;
    summaryLoading.value = false;
  }
}

function openDebt(debt: Debt) {
  void router.push({
    name: 'debt-detail',
    params: { id: debt.id },
    query: { from: route.fullPath },
  });
}

onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <main class="debts-page">
    <AppPageHeader title="借贷" back-label="返回" @back="router.push('/home')"
      ><RouterLink class="new-link" to="/debts/new">新增</RouterLink></AppPageHeader
    >
    <section v-if="loading" class="loading" aria-live="polite">正在加载借贷记录…</section>
    <AppErrorState
      v-else-if="fatal"
      title="借贷加载失败"
      :message="fatal"
      retry-label="重试"
      @retry="load"
    />
    <template v-else>
      <DebtSummaryCard :summary="summary" :loading="summaryLoading" :error="summaryError" />
      <nav class="filters" aria-label="借贷筛选">
        <button
          v-for="item in [
            { key: 'ALL', label: '全部' },
            { key: 'BORROWED', label: '我欠' },
            { key: 'LENT', label: '欠我' },
            { key: 'OVERDUE', label: '逾期' },
            { key: 'SETTLED', label: '结清' },
          ] as const"
          :key="item.key"
          type="button"
          :aria-pressed="filter === item.key"
          @click="filter = item.key"
        >
          {{ item.label }}
        </button>
      </nav>
      <AppEmpty
        v-if="!debts.length"
        title="还没有借贷记录"
        description="新增后可以跟踪部分还款、收款、到期和结清。"
        ><RouterLink class="empty-action" to="/debts/new">新增借贷</RouterLink></AppEmpty
      >
      <AppEmpty
        v-else-if="!filteredDebts.length"
        title="没有符合条件的记录"
        description="可以切换上方筛选查看其他借贷。"
      />
      <section v-else class="debt-list">
        <DebtProgressCard
          v-for="debt in filteredDebts"
          :key="debt.id"
          :debt="debt"
          @open="openDebt(debt)"
        />
      </section>
      <p class="privacy-note">个人借贷仅本人可见，不进入情侣账本统计。</p>
    </template>
  </main>
</template>

<style scoped>
.debts-page {
  width: min(100%, 480px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 0 16px max(32px, env(safe-area-inset-bottom));
  overflow-x: clip;
  background: var(--siyu-page-bg);
  color: var(--siyu-text);
}
.new-link,
.empty-action {
  display: grid;
  min-width: 44px;
  min-height: 44px;
  place-items: center;
  color: var(--siyu-primary);
  text-decoration: none;
}
.filters {
  display: flex;
  gap: 8px;
  margin: 16px 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.filters button {
  flex: 0 0 auto;
  min-width: 58px;
  min-height: 44px;
  padding: 0 13px;
  border: 1px solid var(--siyu-border);
  border-radius: 999px;
  background: var(--siyu-surface);
  color: var(--siyu-text-secondary);
}
.filters button[aria-pressed='true'] {
  border-color: var(--siyu-primary);
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-weight: 700;
}
.debt-list {
  display: grid;
  gap: 10px;
}
.loading {
  padding: 40px;
  text-align: center;
}
.empty-action {
  width: max-content;
  margin: auto;
  padding: 0 20px;
  border-radius: 12px;
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
}
.privacy-note {
  margin: 20px 4px 0;
  color: var(--siyu-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}
@media (max-width: 340px) {
  .debts-page {
    padding-inline: 10px;
  }
}
</style>
