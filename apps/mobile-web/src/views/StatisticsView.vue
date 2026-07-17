<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '../api';
import { useAuthStore } from '../auth';
import AppBottomNav from '../components/AppBottomNav.vue';
import LedgerSwitcher from '../components/LedgerSwitcher.vue';
import MonthlySummaryCard from '../components/MonthlySummaryCard.vue';
import StatisticsTrendChart from '../components/StatisticsTrendChart.vue';
import { coupleLedgerApi, type Ledger } from '../couple-ledger';
import { currentBusinessMonth, formatCent } from '../entry';
import { persistLedgerId, resolveLedgerId } from '../ledger-selection';
import {
  statisticsApi,
  type StatisticsCategories,
  type StatisticsMembers,
  type StatisticsOverview,
  type StatisticsTrend,
} from '../statistics';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const ledgers = ref<Ledger[]>([]);
const selectedLedgerId = ref('');
const month = ref(route.query.month?.toString() || currentBusinessMonth(auth.user?.timezone));
const overview = ref<StatisticsOverview>();
const trend = ref<StatisticsTrend>();
const categories = ref<StatisticsCategories>();
const members = ref<StatisticsMembers>();
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

async function loadStatistics(showPageLoading = false): Promise<void> {
  if (!selectedLedgerId.value) return;
  if (showPageLoading) loading.value = true;
  else refreshing.value = true;
  error.value = '';
  noAccess.value = false;
  try {
    persistLedgerId(selectedLedgerId.value);
    await syncUrl();
    const [nextOverview, nextTrend, nextCategories, nextMembers] = await Promise.all([
      statisticsApi.overview(selectedLedgerId.value, month.value, auth.accessToken),
      statisticsApi.trend(selectedLedgerId.value, month.value, auth.accessToken),
      statisticsApi.categories(selectedLedgerId.value, month.value, auth.accessToken),
      statisticsApi.members(selectedLedgerId.value, month.value, auth.accessToken),
    ]);
    overview.value = nextOverview;
    trend.value = nextTrend;
    categories.value = nextCategories;
    members.value = nextMembers;
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
    await loadStatistics(true);
    ready.value = true;
  } catch (caught) {
    error.value = explainFailure(caught);
  } finally {
    loading.value = false;
  }
}

watch([selectedLedgerId, month], () => {
  if (ready.value) void loadStatistics();
});
onMounted(initialize);
</script>

<template>
  <main class="business-page statistics-page">
    <header class="business-header">
      <div>
        <p class="eyebrow">四时有余</p>
        <h1>统计</h1>
      </div>
      <RouterLink class="text-action" :to="`/home?ledgerId=${selectedLedgerId}&month=${month}`"
        >返回首页</RouterLink
      >
    </header>

    <section v-if="loading" class="state-panel" aria-live="polite">
      <strong>正在计算统计</strong>
      <p>聚合所选账本的月度收支…</p>
    </section>

    <section v-else-if="noAccess" class="state-panel">
      <strong>无法访问这个账本</strong>
      <p>{{ error }}</p>
      <button class="secondary-button" type="button" @click="initialize">重新选择账本</button>
    </section>

    <template v-else>
      <section class="surface-card statistics-controls">
        <LedgerSwitcher v-model="selectedLedgerId" :ledgers="ledgers" :disabled="refreshing" />
        <label>
          <span>统计月份</span>
          <input v-model="month" type="month" :disabled="refreshing" />
        </label>
      </section>

      <p v-if="error" class="inline-error" role="alert">
        {{ error }}
        <button class="text-action" type="button" @click="loadStatistics()">重试</button>
      </p>

      <template v-else-if="overview && trend && categories && members">
        <MonthlySummaryCard :overview="overview" />

        <section v-if="overview.entryCount === 0" class="state-panel statistics-empty">
          <strong>这个月还没有可统计的账目</strong>
          <p>统计不会显示空坐标轴。记录第一笔后，这里会及时更新。</p>
          <RouterLink class="primary-button" :to="`/entries/new?ledgerId=${selectedLedgerId}`"
            >记一笔</RouterLink
          >
        </section>

        <template v-else>
          <section class="statistics-section">
            <div class="section-title">
              <h2>收支趋势</h2>
              <span>{{ month }}</span>
            </div>
            <div class="surface-card chart-card">
              <StatisticsTrendChart :items="trend.items" />
            </div>
          </section>

          <section class="statistics-section">
            <div class="section-title">
              <h2>支出分类</h2>
              <span>共 {{ formatCent(categories.totalCent) }}</span>
            </div>
            <div class="surface-card ranking-list">
              <article v-for="item in categories.items" :key="item.categoryId" class="ranking-item">
                <div class="ranking-copy">
                  <span
                    class="color-dot"
                    :style="{ backgroundColor: item.color }"
                    aria-hidden="true"
                  ></span>
                  <strong :title="item.name">{{ item.name }}</strong>
                  <small>{{ (item.basisPoints / 100).toFixed(1) }}%</small>
                  <b>{{ formatCent(item.amountCent) }}</b>
                </div>
                <div class="progress-track" aria-hidden="true">
                  <span
                    :style="{ width: `${item.basisPoints / 100}%`, backgroundColor: item.color }"
                  ></span>
                </div>
              </article>
            </div>
          </section>

          <section v-if="selectedLedger?.type === 'COUPLE'" class="statistics-section">
            <div class="section-title">
              <h2>成员支出</h2>
              <span>按记录人归属</span>
            </div>
            <div class="surface-card ranking-list">
              <article v-for="member in members.items" :key="member.userId" class="member-row">
                <div>
                  <strong :title="member.nickname">{{
                    member.isCurrentUser ? '我' : member.nickname
                  }}</strong>
                  <small v-if="member.memberStatus === 'LEFT'">已退出</small>
                </div>
                <span>{{ (member.basisPoints / 100).toFixed(1) }}%</span>
                <b>{{ formatCent(member.amountCent) }}</b>
              </article>
            </div>
          </section>

          <section class="surface-card detail-metrics" aria-label="其他统计指标">
            <div>
              <span>日均支出</span
              ><strong>{{ formatCent(overview.averageDailyExpenseCent) }}</strong>
            </div>
            <div>
              <span>最大单笔</span><strong>{{ formatCent(overview.largestExpenseCent) }}</strong>
            </div>
            <div>
              <span>收支笔数</span><strong>{{ overview.entryCount }} 笔</strong>
            </div>
          </section>
        </template>
      </template>
    </template>
  </main>
  <AppBottomNav active="statistics" />
</template>

<style scoped>
.business-header > div {
  min-width: 0;
}
.eyebrow {
  margin: 0 0 4px;
  color: var(--siyu-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.statistics-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(124px, 0.62fr);
  gap: 12px;
  margin-bottom: 14px;
}
.statistics-controls > label {
  display: grid;
  gap: 6px;
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.statistics-controls input {
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  border: 1px solid var(--siyu-border);
  border-radius: 10px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.statistics-empty {
  margin-top: 16px;
}
.statistics-section {
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
.section-title span {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.chart-card {
  padding: 8px 4px 0;
  overflow: hidden;
}
.ranking-list {
  display: grid;
  gap: 16px;
}
.ranking-item {
  min-width: 0;
}
.ranking-copy {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 9px;
}
.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.ranking-copy strong,
.member-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ranking-copy small,
.member-row small,
.member-row span {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.ranking-copy b,
.member-row b {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.progress-track {
  height: 7px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--siyu-border) 72%, transparent);
}
.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
}
.member-row {
  display: grid;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
}
.member-row > div {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}
.detail-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 24px;
}
.detail-metrics div {
  min-width: 0;
}
.detail-metrics span {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.detail-metrics strong {
  display: block;
  margin-top: 8px;
  overflow-wrap: anywhere;
  font-size: 14px;
}
@media (max-width: 340px) {
  .statistics-controls,
  .detail-metrics {
    grid-template-columns: 1fr;
  }
  .ranking-copy {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .ranking-copy small {
    display: none;
  }
}
</style>
