<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '../api';
import { useAuthStore } from '../auth';
import { categoryApi, type Category } from '../category';
import AppBottomNav from '../components/AppBottomNav.vue';
import EntryListItem from '../components/EntryListItem.vue';
import LedgerSwitcher from '../components/LedgerSwitcher.vue';
import { coupleLedgerApi, type Ledger } from '../couple-ledger';
import {
  currentBusinessMonth,
  entryApi,
  type Entry,
  type EntryList,
  type EntryType,
} from '../entry';
import { persistLedgerId, resolveLedgerId } from '../ledger-selection';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const ledgers = ref<Ledger[]>([]);
const categories = ref<Category[]>([]);
const result = ref<EntryList>({ items: [], page: 1, pageSize: 20, total: 0, hasNext: false });
const selectedLedgerId = ref('');
const loading = ref(true);
const refreshing = ref(false);
const noAccess = ref(false);
const error = ref('');
const ready = ref(false);

function queryString(name: string): string {
  const value = route.query[name];
  return typeof value === 'string' ? value : '';
}

const filters = reactive({
  month: queryString('month') || currentBusinessMonth(auth.user?.timezone),
  type: (['EXPENSE', 'INCOME'].includes(queryString('type')) ? queryString('type') : '') as
    EntryType | '',
  categoryId: queryString('categoryId'),
  creatorUserId: queryString('creatorUserId'),
  keyword: queryString('keyword'),
  page: Math.max(1, Number(queryString('page')) || 1),
});

const selectedLedger = computed(() =>
  ledgers.value.find((ledger) => ledger.id === selectedLedgerId.value),
);
const groupedEntries = computed(() => {
  const groups: Array<{ date: string; items: Entry[] }> = [];
  for (const entry of result.value.items) {
    const previous = groups.at(-1);
    if (previous?.date === entry.businessDate) previous.items.push(entry);
    else groups.push({ date: entry.businessDate, items: [entry] });
  }
  return groups;
});

function dateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

function explainFailure(caught: unknown): string {
  return caught instanceof ApiError ? caught.message : '请求失败，请检查网络后重试';
}

async function loadCategories(): Promise<void> {
  if (!selectedLedgerId.value) return;
  try {
    const types: EntryType[] = filters.type ? [filters.type] : ['EXPENSE', 'INCOME'];
    const lists = await Promise.all(
      types.map((type) => categoryApi.list(selectedLedgerId.value, type, true, auth.accessToken)),
    );
    categories.value = lists.flatMap((list) => list.items);
    if (!categories.value.some((category) => category.id === filters.categoryId)) {
      filters.categoryId = '';
    }
  } catch {
    categories.value = [];
    filters.categoryId = '';
  }
}

async function syncUrl(): Promise<void> {
  await router.replace({
    query: {
      ledgerId: selectedLedgerId.value,
      month: filters.month,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.creatorUserId ? { creatorUserId: filters.creatorUserId } : {}),
      ...(filters.keyword.trim() ? { keyword: filters.keyword.trim() } : {}),
      ...(filters.page > 1 ? { page: String(filters.page) } : {}),
    },
  });
}

async function loadEntries(showPageLoading = false): Promise<void> {
  if (!selectedLedgerId.value) return;
  if (showPageLoading) loading.value = true;
  else refreshing.value = true;
  error.value = '';
  noAccess.value = false;
  try {
    persistLedgerId(selectedLedgerId.value);
    await syncUrl();
    result.value = await entryApi.list(
      {
        ledgerId: selectedLedgerId.value,
        month: filters.month,
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.creatorUserId ? { creatorUserId: filters.creatorUserId } : {}),
        ...(filters.keyword.trim() ? { keyword: filters.keyword.trim() } : {}),
        page: filters.page,
        pageSize: 20,
      },
      auth.accessToken,
    );
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
    selectedLedgerId.value = resolveLedgerId(ledgers.value, queryString('ledgerId') || undefined);
    if (!selectedLedgerId.value) {
      error.value = '当前没有可用账本';
      return;
    }
    await Promise.all([loadCategories(), loadEntries(true)]);
    ready.value = true;
  } catch (caught) {
    if (caught instanceof ApiError && [403, 404].includes(caught.status)) noAccess.value = true;
    error.value = explainFailure(caught);
  } finally {
    loading.value = false;
  }
}

async function ledgerChanged(): Promise<void> {
  if (!ready.value) return;
  filters.page = 1;
  filters.categoryId = '';
  filters.creatorUserId = '';
  await Promise.all([loadCategories(), loadEntries()]);
}

async function typeChanged(): Promise<void> {
  filters.categoryId = '';
  filters.page = 1;
  await loadCategories();
}

async function applyFilters(): Promise<void> {
  filters.page = 1;
  await loadEntries();
}

async function changePage(page: number): Promise<void> {
  filters.page = page;
  await loadEntries();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

watch(selectedLedgerId, ledgerChanged);
watch(() => filters.type, typeChanged);
onMounted(initialize);
</script>

<template>
  <main class="business-page">
    <header class="business-header">
      <div>
        <p class="eyebrow">四时有余</p>
        <h1>账目明细</h1>
      </div>
      <RouterLink class="new-entry" :to="`/entries/new?ledgerId=${selectedLedgerId}`"
        >+ 记一笔</RouterLink
      >
    </header>

    <section v-if="loading" class="state-panel" aria-live="polite">
      <strong>正在加载明细</strong>
      <p>读取账本和本月账目…</p>
    </section>

    <section v-else-if="noAccess" class="state-panel">
      <strong>无法访问这个账本</strong>
      <p>{{ error }}</p>
      <button class="secondary-button" type="button" @click="initialize">重新选择账本</button>
    </section>

    <template v-else>
      <section class="surface-card filters-panel">
        <LedgerSwitcher v-model="selectedLedgerId" :ledgers="ledgers" :disabled="refreshing" />
        <form class="filter-grid" aria-label="账目筛选" @submit.prevent="applyFilters">
          <label>
            <span>月份</span>
            <input v-model="filters.month" type="month" />
          </label>
          <label>
            <span>类型</span>
            <select v-model="filters.type">
              <option value="">全部收支</option>
              <option value="EXPENSE">支出</option>
              <option value="INCOME">收入</option>
            </select>
          </label>
          <label>
            <span>分类</span>
            <select v-model="filters.categoryId">
              <option value="">全部分类</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}{{ category.isEnabled ? '' : '（已停用）' }}
              </option>
            </select>
          </label>
          <label v-if="selectedLedger?.type === 'COUPLE'">
            <span>创建人</span>
            <select v-model="filters.creatorUserId">
              <option value="">全部成员</option>
              <option
                v-for="member in selectedLedger.members"
                :key="member.userId"
                :value="member.userId"
              >
                {{ member.nickname }}
              </option>
            </select>
          </label>
          <label class="keyword-field">
            <span>备注搜索</span>
            <input v-model="filters.keyword" maxlength="100" placeholder="输入关键词" />
          </label>
          <button class="secondary-button filter-button" type="submit" :disabled="refreshing">
            {{ refreshing ? '查询中…' : '筛选' }}
          </button>
        </form>
      </section>

      <p v-if="error" class="inline-error" role="alert">
        {{ error }}
        <button class="text-action" type="button" @click="loadEntries()">重试</button>
      </p>

      <section v-else-if="result.items.length === 0" class="state-panel entries-state">
        <strong>这个筛选条件下还没有账目</strong>
        <p>可以调整月份和筛选条件，或先记录第一笔收支。</p>
        <RouterLink class="primary-button" :to="`/entries/new?ledgerId=${selectedLedgerId}`">
          记一笔
        </RouterLink>
      </section>

      <section v-else class="entry-groups" :aria-busy="refreshing">
        <p class="result-meta">共 {{ result.total }} 笔</p>
        <article v-for="group in groupedEntries" :key="group.date" class="entry-group surface-card">
          <h2>{{ dateLabel(group.date) }}</h2>
          <EntryListItem
            v-for="entry in group.items"
            :key="entry.id"
            :entry="entry"
            :ledger-type="selectedLedger?.type || 'PERSONAL'"
            @open="
              router.push({
                name: 'entry-detail',
                params: { id: entry.id },
                query: { from: route.fullPath },
              })
            "
          />
        </article>

        <nav class="pagination" aria-label="账目分页">
          <button
            class="secondary-button"
            type="button"
            :disabled="result.page <= 1 || refreshing"
            @click="changePage(result.page - 1)"
          >
            上一页
          </button>
          <span>第 {{ result.page }} 页</span>
          <button
            class="secondary-button"
            type="button"
            :disabled="!result.hasNext || refreshing"
            @click="changePage(result.page + 1)"
          >
            下一页
          </button>
        </nav>
      </section>
    </template>
  </main>
  <AppBottomNav active="entries" />
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
.new-entry {
  flex: 0 0 auto;
}
.filters-panel {
  display: grid;
  gap: 14px;
}
.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.filter-grid label {
  display: grid;
  min-width: 0;
  gap: 6px;
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.keyword-field {
  grid-column: 1 / -1;
}
.filter-button {
  min-height: 44px;
  grid-column: 1 / -1;
}
.inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.entries-state {
  margin-top: 16px;
}
.entry-groups {
  display: grid;
  gap: 12px;
  margin-top: 18px;
}
.result-meta {
  margin: 0;
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.entry-group {
  padding-top: 12px;
  padding-bottom: 2px;
}
.entry-group h2 {
  margin: 0 0 2px;
  color: var(--siyu-text-secondary);
  font-size: 13px;
  font-weight: 600;
}
.entry-group :deep(.entry-row:last-child) {
  border-bottom: 0;
}
.pagination {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  color: var(--siyu-text-secondary);
  font-size: 12px;
  text-align: center;
}
@media (max-width: 340px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }
  .keyword-field,
  .filter-button {
    grid-column: auto;
  }
}
</style>
