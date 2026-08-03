<script setup lang="ts">
import { CalendarOutlined, ClockCircleOutlined, DownOutlined } from '@ant-design/icons-vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '../api';
import { useAuthStore } from '../auth';
import AppBottomNav from '../components/AppBottomNav.vue';
import AppSkeleton from '../components/AppSkeleton.vue';
import EntryListItem from '../components/EntryListItem.vue';
import LedgerSwitcher from '../components/LedgerSwitcher.vue';
import MonthlySummaryCard from '../components/MonthlySummaryCard.vue';
import { coupleLedgerApi, type Ledger } from '../couple-ledger';
import { createDebtApi, type Debt } from '../debt';
import { currentBusinessMonth, entryApi, formatCent, type Entry } from '../entry';
import { persistLedgerId, resolveLedgerId } from '../ledger-selection';
import { useAmountPrivacy } from '../privacy';
import { createRecurringApi } from '../recurring';
import { statisticsApi, type StatisticsMemberItem, type StatisticsOverview } from '../statistics';
import { useApiSession } from '../use-api-session';

interface AttentionItem {
  key: string;
  title: string;
  detail: string;
  to: string;
  icon: typeof CalendarOutlined;
}

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const session = useApiSession();
const recurringApi = createRecurringApi(session);
const debtApi = createDebtApi(session);
const { amountHidden, toggleAmountHidden } = useAmountPrivacy();
const ledgers = ref<Ledger[]>([]);
const selectedLedgerId = ref('');
const month = ref(route.query.month?.toString() || currentBusinessMonth(auth.user?.timezone));
const overview = ref<StatisticsOverview>();
const members = ref<StatisticsMemberItem[]>([]);
const recentEntries = ref<Entry[]>([]);
const attentionItems = ref<AttentionItem[]>([]);
const attentionLoading = ref(false);
const attentionError = ref('');
const loading = ref(true);
const refreshing = ref(false);
const noAccess = ref(false);
const error = ref('');
const ready = ref(false);
let attentionRequest = 0;

const selectedLedger = computed(() =>
  ledgers.value.find((ledger) => ledger.id === selectedLedgerId.value),
);
const monthLabel = computed(() => {
  const [year, monthNumber] = month.value.split('-');
  return year && monthNumber ? `${year}年${Number(monthNumber)}月` : month.value;
});
const greeting = computed(() => {
  let hour = new Date().getHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: auth.user?.timezone || 'Asia/Shanghai',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date()),
    );
  } catch {
    // Use the local hour when a stored timezone is unavailable.
  }
  return hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
});

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

function shortDate(value: string): string {
  const [, monthNumber, day] = value.split('-');
  return monthNumber && day ? `${Number(monthNumber)}月${Number(day)}日` : value;
}

function urgentDebts(debts: Debt[]): Debt[] {
  return debts
    .filter(
      (debt) =>
        debt.status !== 'SETTLED' &&
        debt.status !== 'CANCELLED' &&
        (debt.overdueDays > 0 || debt.dueDate !== null),
    )
    .sort((left, right) => {
      if (left.overdueDays > 0 && right.overdueDays === 0) return -1;
      if (right.overdueDays > 0 && left.overdueDays === 0) return 1;
      return (left.dueDate || '').localeCompare(right.dueDate || '');
    });
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

async function loadAttention(): Promise<void> {
  if (!selectedLedgerId.value || !selectedLedger.value) return;
  const request = ++attentionRequest;
  attentionLoading.value = true;
  attentionError.value = '';

  const results = await Promise.allSettled([
    recurringApi.listAllRuns('PENDING'),
    selectedLedger.value.type === 'PERSONAL' ? debtApi.listAll() : Promise.resolve([] as Debt[]),
  ]);
  if (request !== attentionRequest) return;

  const items: AttentionItem[] = [];
  let failedSources = 0;
  const recurringResult = results[0];
  if (recurringResult.status === 'fulfilled') {
    const count = recurringResult.value.filter(
      (run) => run.rule.ledgerId === selectedLedgerId.value,
    ).length;
    if (count > 0) {
      items.push({
        key: 'recurring',
        title: '待确认周期账目',
        detail: `${count} 笔`,
        to: `/recurring?ledgerId=${selectedLedgerId.value}`,
        icon: CalendarOutlined,
      });
    }
  } else failedSources += 1;

  const debtResult = results[1];
  if (debtResult.status === 'fulfilled') {
    const debts = urgentDebts(debtResult.value);
    const first = debts[0];
    if (first) {
      items.push({
        key: 'debt',
        title: '个人借贷',
        detail:
          first.overdueDays > 0
            ? `${debts.length} 笔 · 最早已逾期 ${first.overdueDays} 天`
            : `${debts.length} 笔 · ${shortDate(first.dueDate!)}到期`,
        to: '/debts',
        icon: ClockCircleOutlined,
      });
    }
  } else failedSources += 1;

  attentionItems.value = items;
  attentionError.value = failedSources ? '部分待办暂时无法读取' : '';
  attentionLoading.value = false;
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
    void loadAttention();
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
    <header class="dashboard-header">
      <div class="dashboard-welcome">
        <h1>
          {{
            selectedLedger?.type === 'COUPLE'
              ? '我们的账本'
              : `${greeting}，${auth.user?.nickname || '朋友'}`
          }}
        </h1>
        <p>四时有余，简单记账，安心生活</p>
      </div>
      <div class="dashboard-context" aria-label="首页账本与月份">
        <LedgerSwitcher
          v-model="selectedLedgerId"
          :ledgers="ledgers"
          :disabled="refreshing"
          compact
        />
        <label class="month-control">
          <span class="visually-hidden">统计月份</span>
          <CalendarOutlined aria-hidden="true" />
          <span aria-hidden="true">{{ monthLabel }}</span>
          <DownOutlined aria-hidden="true" />
          <input v-model="month" type="month" :disabled="refreshing" aria-label="统计月份" />
        </label>
      </div>
    </header>

    <AppSkeleton v-if="loading" label="正在准备首页" variant="dashboard" :rows="3" />

    <section v-else-if="noAccess" class="state-panel">
      <strong>无法访问这个账本</strong>
      <p>{{ error }}</p>
      <button class="secondary-button" type="button" @click="initialize">重新选择账本</button>
    </section>

    <template v-else>
      <p v-if="error" class="inline-error" role="alert">
        {{ error }}
        <button class="text-action" type="button" @click="loadDashboard()">重试</button>
      </p>

      <template v-else-if="overview">
        <MonthlySummaryCard
          :overview="overview"
          :hidden="amountHidden"
          prominent
          @toggle-visibility="toggleAmountHidden"
        />

        <section class="dashboard-section attention-section" aria-labelledby="attention-title">
          <div class="surface-card dashboard-group-card">
            <div class="section-title">
              <h2 id="attention-title">近期需要处理</h2>
              <RouterLink to="/notifications">查看消息</RouterLink>
            </div>
            <div class="attention-list" aria-live="polite">
              <p v-if="attentionLoading" class="attention-state">正在读取待办…</p>
              <template v-else>
                <RouterLink v-for="item in attentionItems" :key="item.key" :to="item.to">
                  <span class="attention-icon" aria-hidden="true"
                    ><component :is="item.icon"
                  /></span>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.detail }}</small>
                </RouterLink>
                <p v-if="!attentionItems.length && !attentionError" class="attention-state">
                  最近没有需要处理的事项
                </p>
                <p v-if="attentionError" class="attention-warning">
                  {{ attentionError }}
                  <button type="button" @click="loadAttention">重试</button>
                </p>
              </template>
            </div>
          </div>
        </section>

        <section
          v-if="selectedLedger?.type === 'COUPLE' && members.length"
          class="dashboard-section"
        >
          <div class="section-title">
            <h2>本月记录贡献</h2>
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
                member.isCurrentUser ? '我记录' : `${member.nickname}记录`
              }}</span>
              <strong>{{ amountHidden ? '••••••' : formatCent(member.amountCent) }}</strong>
              <small>{{ member.entryCount }} 笔</small>
            </article>
          </div>
          <p class="contribution-note">这里展示记录贡献，不用于比较彼此花销。</p>
        </section>

        <section class="dashboard-section">
          <div class="surface-card dashboard-group-card">
            <div class="section-title">
              <h2>{{ selectedLedger?.type === 'COUPLE' ? '最近一起记下' : '最近明细' }}</h2>
              <RouterLink :to="`/entries?ledgerId=${selectedLedgerId}&month=${month}`"
                >查看全部</RouterLink
              >
            </div>
            <div v-if="recentEntries.length" class="recent-list">
              <EntryListItem
                v-for="entry in recentEntries"
                :key="entry.id"
                :entry="entry"
                :ledger-type="selectedLedger?.type || 'PERSONAL'"
                :amount-hidden="amountHidden"
                home-summary
                @open="
                  router.push({
                    name: 'entry-detail',
                    params: { id: entry.id },
                    query: { from: route.fullPath },
                  })
                "
              />
            </div>
            <div v-else class="state-panel compact-state">
              <strong>这个月还没有账目</strong>
              <p>记录第一笔后，首页和统计会同步更新。</p>
              <RouterLink class="primary-button" :to="`/entries/new?ledgerId=${selectedLedgerId}`"
                >记一笔</RouterLink
              >
            </div>
          </div>
        </section>
      </template>
    </template>
  </main>
  <AppBottomNav active="home" />
</template>

<style scoped>
.dashboard-page {
  padding-top: max(20px, env(safe-area-inset-top));
}
.dashboard-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(132px, 0.72fr);
  align-items: start;
  gap: 16px;
  margin-bottom: 20px;
}
.dashboard-welcome {
  min-width: 0;
  padding-top: 4px;
}
.dashboard-welcome h1 {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: clamp(24px, 7vw, 30px);
  line-height: 1.2;
}
.dashboard-welcome p {
  margin: 10px 0 0;
  color: var(--siyu-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}
.dashboard-context {
  display: grid;
  gap: 8px;
}
.month-control {
  position: relative;
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  overflow: hidden;
  border: 1px solid var(--siyu-border);
  border-radius: 999px;
  background: var(--siyu-surface);
  color: var(--siyu-primary);
  font-size: 13px;
  font-weight: 700;
}
.month-control input {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  width: 100%;
  height: 46px;
  min-height: 46px;
  opacity: 0;
  cursor: pointer;
  transform: translateY(-50%);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
.dashboard-group-card {
  padding-top: 8px;
  padding-bottom: 0;
}
.attention-list {
  padding-top: 0;
  padding-bottom: 0;
}
.attention-list > a {
  display: grid;
  min-height: 68px;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  color: var(--siyu-text);
  text-decoration: none;
}
.attention-list > a + a {
  border-top: 1px solid var(--siyu-border);
}
.attention-list strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attention-list small {
  color: var(--siyu-text-secondary);
  text-align: right;
}
.attention-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-size: 20px;
}
.attention-state,
.attention-warning {
  display: flex;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.attention-warning {
  color: var(--siyu-warning);
}
.attention-warning button {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--siyu-primary);
}
.member-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.member-card {
  min-width: 0;
}
.member-card span,
.member-card small {
  display: block;
  overflow: hidden;
  color: var(--siyu-text-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.member-card strong {
  display: block;
  margin: 8px 0 6px;
  overflow-wrap: anywhere;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}
.contribution-note {
  margin: 10px 4px 0;
  color: var(--siyu-text-tertiary);
  font-size: 12px;
  text-align: center;
}
.recent-list {
  padding: 0 4px;
}
.recent-list :deep(.entry-item) {
  border-width: 0 0 1px;
  border-radius: 0;
}
.recent-list :deep(.entry-item:last-child) {
  border-bottom: 0;
}
.compact-state {
  min-height: 190px;
}
@media (max-width: 360px) {
  .dashboard-header {
    grid-template-columns: 1fr;
  }
  .dashboard-context {
    grid-template-columns: minmax(0, 1fr) 124px;
  }
}
@media (max-width: 340px) {
  .dashboard-context {
    grid-template-columns: 1fr;
  }
  .member-grid {
    gap: 8px;
  }
  .attention-list > a {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 9px;
    padding: 8px 0;
  }
  .attention-list small {
    grid-column: 2;
    text-align: left;
  }
  .attention-icon {
    width: 36px;
    height: 36px;
  }
}
</style>
