<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '../api';
import { useAuthStore } from '../auth';
import AppBottomNav from '../components/AppBottomNav.vue';
import EntryListItem from '../components/EntryListItem.vue';
import LedgerSwitcher from '../components/LedgerSwitcher.vue';
import MonthlySummaryCard from '../components/MonthlySummaryCard.vue';
import { coupleLedgerApi, type Ledger } from '../couple-ledger';
import { currentBusinessMonth, entryApi, formatCent, type Entry } from '../entry';
import { persistLedgerId, resolveLedgerId } from '../ledger-selection';
import { statisticsApi, type StatisticsMemberItem, type StatisticsOverview } from '../statistics';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const ledgers = ref<Ledger[]>([]);
const selectedLedgerId = ref('');
const month = ref(route.query.month?.toString() || currentBusinessMonth(auth.user?.timezone));
const overview = ref<StatisticsOverview>();
const members = ref<StatisticsMemberItem[]>([]);
const recentEntries = ref<Entry[]>([]);
const loading = ref(true);
const refreshing = ref(false);
const noAccess = ref(false);
const error = ref('');
const ready = ref(false);

const selectedLedger = computed(() =>
  ledgers.value.find((ledger) => ledger.id === selectedLedgerId.value),
);

function requestedType(): 'PERSONAL' | 'COUPLE' | undefined {
  return route.query.ledger === 'couple'
    ? 'COUPLE'
    : route.query.ledger === 'personal'
      ? 'PERSONAL'
      : undefined;
}

function explainFailure(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : '请求失败，请检查网络后重试';
}

async function syncUrl(): Promise<void> {
  await router.replace({
    query: {
      ledger: selectedLedger.value?.type.toLowerCase(),
      ledgerId: selectedLedgerId.value,
      month: month.value,
    },
  });
}

async function loadDashboard(showPageLoading = false): Promise<void> {
  if (!selectedLedgerId.value) return;
  if (showPageLoading) loading.value = true;
  else refreshing.value = true;
  error.value = '';
  noAccess.value = false;
  try {
    persistLedgerId(selectedLedgerId.value);
    await syncUrl();
    const [nextOverview, entries, memberResult] = await Promise.all([
      statisticsApi.overview(selectedLedgerId.value, month.value, auth.accessToken),
      entryApi.list(
        { ledgerId: selectedLedgerId.value, month: month.value, page: 1, pageSize: 5 },
        auth.accessToken,
      ),
      selectedLedger.value?.type === 'COUPLE'
        ? statisticsApi.members(selectedLedgerId.value, month.value, auth.accessToken)
        : Promise.resolve(undefined),
    ]);
    overview.value = nextOverview;
    recentEntries.value = entries.items;
    members.value = memberResult?.items ?? [];
  } catch (caught) {
    if (caught instanceof ApiError && [403, 404].includes(caught.status)) noAccess.value = true;
    error.value = explainFailure(caught);
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

async function initialize(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    ledgers.value = await coupleLedgerApi.list(auth.accessToken);
    selectedLedgerId.value = resolveLedgerId(
      ledgers.value,
      route.query.ledgerId?.toString(),
      requestedType(),
    );
    if (!selectedLedgerId.value) {
      error.value = '当前没有可用账本';
      return;
    }
    await loadDashboard(true);
    ready.value = true;
  } catch (caught) {
    error.value = explainFailure(caught);
  } finally {
    loading.value = false;
  }
}

watch([selectedLedgerId, month], () => {
  if (ready.value) void loadDashboard();
});
onMounted(initialize);
</script>

<template>
  <main class="business-page dashboard-page">
    <header class="business-header dashboard-header">
      <div>
        <p class="eyebrow">四时有余</p>
        <h1>
          {{
            selectedLedger?.type === 'COUPLE'
              ? '我们的账本'
              : `你好，${auth.user?.nickname || '朋友'}`
          }}
        </h1>
      </div>
      <RouterLink class="text-action" to="/entries/new">记一笔</RouterLink>
    </header>

    <section v-if="loading" class="state-panel" aria-live="polite">
      <strong>正在准备首页</strong>
      <p>读取账本、本月汇总和最近账目…</p>
    </section>

    <section v-else-if="noAccess" class="state-panel">
      <strong>无法访问这个账本</strong>
      <p>{{ error }}</p>
      <button class="secondary-button" type="button" @click="initialize">重新选择账本</button>
    </section>

    <template v-else>
      <section class="surface-card dashboard-controls">
        <LedgerSwitcher v-model="selectedLedgerId" :ledgers="ledgers" :disabled="refreshing" />
        <label>
          <span>统计月份</span>
          <input v-model="month" type="month" :disabled="refreshing" />
        </label>
      </section>

      <p v-if="error" class="inline-error" role="alert">
        {{ error }}
        <button class="text-action" type="button" @click="loadDashboard()">重试</button>
      </p>

      <template v-else-if="overview">
        <MonthlySummaryCard :overview="overview" prominent />

        <section class="quick-metrics" aria-label="本月支出指标">
          <article class="surface-card">
            <span>日均支出</span>
            <strong>{{ formatCent(overview.averageDailyExpenseCent) }}</strong>
          </article>
          <article class="surface-card">
            <span>最大单笔支出</span>
            <strong>{{ formatCent(overview.largestExpenseCent) }}</strong>
          </article>
        </section>

        <section v-if="selectedLedger?.type === 'COUPLE'" class="dashboard-section">
          <div class="section-title">
            <h2>成员支出</h2>
            <RouterLink :to="`/statistics?ledgerId=${selectedLedgerId}&month=${month}`"
              >查看统计</RouterLink
            >
          </div>
          <div class="member-grid">
            <article
              v-for="member in members"
              :key="member.userId"
              class="surface-card member-card"
            >
              <span :title="member.nickname">{{
                member.isCurrentUser ? '我' : member.nickname
              }}</span>
              <strong>{{ formatCent(member.amountCent) }}</strong>
              <small>{{ (member.basisPoints / 100).toFixed(1) }}%</small>
            </article>
          </div>
        </section>

        <section class="dashboard-section">
          <div class="section-title">
            <h2>{{ selectedLedger?.type === 'COUPLE' ? '最近共同账目' : '最近账目' }}</h2>
            <RouterLink :to="`/entries?ledgerId=${selectedLedgerId}&month=${month}`"
              >全部明细</RouterLink
            >
          </div>
          <div v-if="recentEntries.length" class="surface-card recent-list">
            <EntryListItem
              v-for="entry in recentEntries"
              :key="entry.id"
              :entry="entry"
              :show-creator="selectedLedger?.type === 'COUPLE'"
            />
          </div>
          <div v-else class="state-panel compact-state">
            <strong>这个月还没有账目</strong>
            <p>记录第一笔后，首页和统计会同步更新。</p>
            <RouterLink class="primary-button" :to="`/entries/new?ledgerId=${selectedLedgerId}`"
              >记一笔</RouterLink
            >
          </div>
        </section>

        <p class="module-note">工资、借贷、周期和攒钱模块上线后，相关首页卡片才会在这里出现。</p>
      </template>
    </template>
  </main>
  <AppBottomNav active="home" />
</template>

<style scoped>
.dashboard-header > div {
  min-width: 0;
}
.eyebrow {
  margin: 0 0 4px;
  color: var(--siyu-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.dashboard-header h1 {
  overflow-wrap: anywhere;
}
.dashboard-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(124px, 0.62fr);
  gap: 12px;
  margin-bottom: 14px;
}
.dashboard-controls > label {
  display: grid;
  gap: 6px;
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.dashboard-controls input {
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid var(--siyu-border);
  border-radius: 10px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.quick-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.quick-metrics article,
.member-card {
  min-width: 0;
}
.quick-metrics span,
.member-card span,
.member-card small {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.quick-metrics strong,
.member-card strong {
  display: block;
  margin-top: 8px;
  overflow-wrap: anywhere;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}
.dashboard-section {
  margin-top: 24px;
}
.section-title {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.section-title h2 {
  margin: 0;
  font-size: 18px;
}
.section-title a {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  color: var(--siyu-primary);
  font-size: 13px;
  text-decoration: none;
}
.member-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.member-card span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-list {
  padding-top: 2px;
  padding-bottom: 2px;
}
.recent-list :deep(.entry-row:last-child) {
  border-bottom: 0;
}
.compact-state {
  min-height: 190px;
}
.module-note {
  margin: 24px 4px 0;
  color: var(--siyu-text-secondary);
  font-size: 12px;
  line-height: 1.7;
  text-align: center;
}
@media (max-width: 340px) {
  .dashboard-controls,
  .quick-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
