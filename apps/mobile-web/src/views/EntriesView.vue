<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { isRequestCancelled } from '../api';
import { useAuthStore } from '../auth';
import AppBottomNav from '../components/AppBottomNav.vue';
import AppEmpty from '../components/AppEmpty.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import EntryFilterDrawer, {
  type CreatorOption,
  type EntryFilters,
} from '../components/EntryFilterDrawer.vue';
import EntryListItem from '../components/EntryListItem.vue';
import LedgerSwitcher from '../components/LedgerSwitcher.vue';
import { createEntryApi, type Entry, type EntryType, type Ledger } from '../entry';
import { consumeCreatedEntryId } from '../entry-flash';
import { listCategories, listLedgers, type Category } from '../entry-resources';
import { localBusinessDate, persistLedgerId, resolveLedger } from '../ledger-context';
import { useApiSession } from '../use-api-session';

const PAGE_SIZE = 20;
const MAX_RESTORE_PAGES = 10;
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const session = useApiSession();
const api = createEntryApi(session);
const ledgers = ref<Ledger[]>([]);
const selectedLedgerId = ref('');
const entries = ref<Entry[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const paging = ref(false);
const fatal = ref('');
const pageError = ref('');
const notice = ref('');
const hasNext = ref(false);
const loadedPage = ref(0);
const filterOpen = ref(false);
const highlightedId = ref('');
const keywordInput = ref('');
let controller: AbortController | undefined;
let keywordTimer: ReturnType<typeof setTimeout> | undefined;
let initialized = false;
const month = computed(() =>
  validMonth(route.query.month)
    ? String(route.query.month)
    : localBusinessDate(auth.user?.timezone).slice(0, 7),
);
const selectedLedger = computed(() =>
  ledgers.value.find((item) => item.id === selectedLedgerId.value),
);
const typeFilter = computed<EntryType | ''>(() =>
  route.query.type === 'INCOME' || route.query.type === 'EXPENSE' ? route.query.type : '',
);
const categoryId = computed(() =>
  typeof route.query.categoryId === 'string' ? route.query.categoryId : '',
);
const creatorUserId = computed(() =>
  typeof route.query.creatorUserId === 'string' ? route.query.creatorUserId : '',
);
const keyword = computed(() =>
  typeof route.query.keyword === 'string' ? route.query.keyword.trim() : '',
);
const targetPage = computed(() => clampPage(route.query.page));
const hasFilters = computed(() =>
  Boolean(typeFilter.value || categoryId.value || creatorUserId.value || keyword.value),
);
const groups = computed(() => {
  const result: Array<{ date: string; items: Entry[] }> = [];
  for (const entry of entries.value) {
    const group = result.at(-1);
    if (group?.date === entry.businessDate) group.items.push(entry);
    else result.push({ date: entry.businessDate, items: [entry] });
  }
  return result;
});
const creators = computed<CreatorOption[]>(() => {
  const map = new Map<string, string>();
  for (const member of selectedLedger.value?.members ?? []) map.set(member.userId, member.nickname);
  for (const entry of entries.value) map.set(entry.creator.id, entry.creator.nickname);
  return [...map].map(([id, name]) => ({ id, name }));
});
const filters = computed<EntryFilters>(() => ({
  type: typeFilter.value,
  categoryId: categoryId.value,
  creatorUserId: creatorUserId.value,
}));
const filterDraft = ref<EntryFilters>({ type: '', categoryId: '', creatorUserId: '' });

function validMonth(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
function clampPage(value: unknown): number {
  const raw = typeof value === 'string' ? Number(value) : 1;
  return Number.isInteger(raw) && raw > 0 ? Math.min(raw, MAX_RESTORE_PAGES) : 1;
}
function baseQuery(overrides: LocationQueryRaw = {}): LocationQueryRaw {
  return {
    ledgerId: selectedLedgerId.value,
    month: month.value,
    ...(typeFilter.value ? { type: typeFilter.value } : {}),
    ...(categoryId.value ? { categoryId: categoryId.value } : {}),
    ...(creatorUserId.value ? { creatorUserId: creatorUserId.value } : {}),
    ...(keyword.value ? { keyword: keyword.value } : {}),
    ...(targetPage.value > 1 ? { page: String(targetPage.value) } : {}),
    ...overrides,
  };
}
async function replaceQuery(query: LocationQueryRaw) {
  await router.replace({ name: 'entries', query });
}
async function loadFilterData(signal?: AbortSignal) {
  if (!selectedLedgerId.value) return;
  try {
    const [expense, income] = await Promise.all([
      listCategories(session, selectedLedgerId.value, 'EXPENSE', true, signal),
      listCategories(session, selectedLedgerId.value, 'INCOME', true, signal),
    ]);
    categories.value = [...expense.items, ...income.items];
  } catch (cause) {
    if (!isRequestCancelled(cause)) pageError.value = '筛选分类加载失败，账目列表仍可使用。';
  }
}
async function loadEntries() {
  if (!selectedLedgerId.value) return;
  controller?.abort();
  controller = new AbortController();
  const signal = controller.signal;
  loading.value = true;
  fatal.value = '';
  pageError.value = '';
  entries.value = [];
  loadedPage.value = 0;
  hasNext.value = false;
  try {
    for (let page = 1; page <= targetPage.value; page += 1) {
      const result = await api.list(
        {
          ledgerId: selectedLedgerId.value,
          month: month.value,
          page,
          pageSize: PAGE_SIZE,
          ...(typeFilter.value ? { type: typeFilter.value } : {}),
          ...(categoryId.value ? { categoryId: categoryId.value } : {}),
          ...(creatorUserId.value ? { creatorUserId: creatorUserId.value } : {}),
          ...(keyword.value ? { keyword: keyword.value } : {}),
        },
        signal,
      );
      const seen = new Set(entries.value.map((item) => item.id));
      entries.value.push(...result.items.filter((item) => !seen.has(item.id)));
      loadedPage.value = page;
      hasNext.value = result.hasNext;
      if (!result.hasNext) {
        if (targetPage.value > page)
          await replaceQuery(baseQuery({ page: page > 1 ? String(page) : undefined }));
        break;
      }
    }
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '账目加载失败';
  } finally {
    if (!signal.aborted) loading.value = false;
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
    if (resolved.fellBack) notice.value = '原账本已不可用，已切换到个人账本。';
    keywordInput.value = keyword.value;
    const canonical = baseQuery({
      ledgerId: resolved.ledger.id,
      month: month.value,
      page: targetPage.value > 1 ? String(targetPage.value) : undefined,
    });
    await replaceQuery(canonical);
    await Promise.all([loadEntries(), loadFilterData(controller?.signal)]);
    highlightedId.value = consumeCreatedEntryId();
    initialized = true;
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '页面加载失败';
  } finally {
    loading.value = false;
  }
}
async function changeLedger(id: string) {
  selectedLedgerId.value = id;
  persistLedgerId(id);
  await replaceQuery({ ledgerId: id, month: month.value });
}
async function changeMonth(value: string) {
  if (validMonth(value)) await replaceQuery({ ...baseQuery(), month: value, page: undefined });
}
function commitKeyword() {
  if (keywordTimer) clearTimeout(keywordTimer);
  void replaceQuery({
    ...baseQuery(),
    keyword: keywordInput.value.trim() || undefined,
    page: undefined,
  });
}
function scheduleKeyword() {
  if (keywordTimer) clearTimeout(keywordTimer);
  keywordTimer = setTimeout(commitKeyword, 300);
}
function openFilters() {
  filterDraft.value = { ...filters.value };
  filterOpen.value = true;
}
async function applyFilters(value: EntryFilters) {
  filterOpen.value = false;
  await replaceQuery({
    ...baseQuery(),
    type: value.type || undefined,
    categoryId: value.categoryId || undefined,
    creatorUserId: value.creatorUserId || undefined,
    page: undefined,
  });
}
async function resetFilters() {
  filterOpen.value = false;
  await replaceQuery({
    ledgerId: selectedLedgerId.value,
    month: month.value,
    ...(keyword.value ? { keyword: keyword.value } : {}),
  });
}
async function loadMore() {
  if (paging.value || !hasNext.value || loadedPage.value >= MAX_RESTORE_PAGES) return;
  paging.value = true;
  try {
    await replaceQuery({ ...baseQuery(), page: String(loadedPage.value + 1) });
  } finally {
    paging.value = false;
  }
}
function openEntry(entry: Entry) {
  void router.push({
    name: 'entry-detail',
    params: { id: entry.id },
    query: { from: route.fullPath },
  });
}
watch(
  () => route.fullPath,
  async () => {
    if (!initialized) return;
    keywordInput.value = keyword.value;
    await loadEntries();
  },
  { flush: 'post' },
);
onMounted(initialize);
onBeforeUnmount(() => {
  controller?.abort();
  if (keywordTimer) clearTimeout(keywordTimer);
});
</script>
<template>
  <main class="entries-page">
    <AppPageHeader title="账目明细"
      ><RouterLink
        class="new-link"
        :to="{
          name: 'entry-new',
          query: { ledgerId: selectedLedgerId, type: typeFilter || undefined },
        }"
        >记一笔</RouterLink
      ></AppPageHeader
    >
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <section v-if="ledgers.length" class="controls">
      <LedgerSwitcher
        :ledgers="ledgers"
        :model-value="selectedLedgerId"
        :disabled="loading"
        @update:model-value="changeLedger"
      />
      <div class="month-search">
        <label
          ><span>月份</span
          ><input
            :value="month"
            type="month"
            @change="changeMonth(($event.target as HTMLInputElement).value)" /></label
        ><button type="button" @click="openFilters">
          筛选<span v-if="hasFilters" class="dot" aria-label="已应用筛选" />
        </button>
      </div>
      <label class="search"
        ><span class="sr-only">搜索备注</span
        ><input
          v-model="keywordInput"
          maxlength="100"
          type="search"
          placeholder="搜索备注"
          @input="scheduleKeyword"
          @keydown.enter.prevent="commitKeyword"
      /></label>
    </section>
    <p v-if="pageError" class="partial-error" role="alert">{{ pageError }}</p>
    <section v-if="loading" class="loading" aria-live="polite">正在加载账目…</section>
    <AppErrorState
      v-else-if="fatal"
      title="账目加载失败"
      :message="fatal"
      retry-label="重试"
      @retry="loadEntries"
    /><AppEmpty
      v-else-if="!entries.length"
      :title="hasFilters ? '没有符合条件的账目' : '这个月还没有账目'"
      :description="hasFilters ? '可以调整筛选或搜索条件。' : '记下第一笔收入或支出吧。'"
      ><RouterLink
        class="empty-action"
        :to="{
          name: 'entry-new',
          query: { ledgerId: selectedLedgerId, type: typeFilter || undefined },
        }"
        >记一笔</RouterLink
      ></AppEmpty
    >
    <section v-else class="groups">
      <section v-for="group in groups" :key="group.date" class="day-group">
        <h2>{{ group.date }}</h2>
        <div class="items">
          <EntryListItem
            v-for="entry in group.items"
            :key="entry.id"
            :entry="entry"
            :ledger-type="selectedLedger?.type || 'PERSONAL'"
            :highlighted="entry.id === highlightedId"
            @open="openEntry(entry)"
          />
        </div>
      </section>
      <button
        v-if="hasNext && loadedPage < MAX_RESTORE_PAGES"
        class="load-more"
        type="button"
        :disabled="paging"
        @click="loadMore"
      >
        {{ paging ? '加载中…' : '加载更多' }}
      </button>
      <p v-else class="end-note">已经到底了</p>
    </section>
    <EntryFilterDrawer
      v-model:draft="filterDraft"
      :open="filterOpen"
      :model-value="filters"
      :ledger="selectedLedger"
      :categories="categories"
      :creators="creators"
      @close="filterOpen = false"
      @apply="applyFilters"
      @reset="resetFilters"
    /><AppBottomNav />
  </main>
</template>
<style scoped>
.entries-page {
  width: min(100%, 480px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 0 16px calc(82px + env(safe-area-inset-bottom));
  overflow-x: clip;
  background: var(--siyu-page-bg);
  color: var(--siyu-text);
}
.new-link,
.empty-action {
  display: grid;
  min-height: 44px;
  place-items: center;
  color: var(--siyu-primary);
  text-decoration: none;
}
.controls {
  display: grid;
  gap: 10px;
}
.month-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 88px;
  gap: 9px;
}
.month-search label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 13px;
  background: var(--siyu-surface);
}
.month-search label span {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.month-search input {
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--siyu-text);
}
.month-search button {
  position: relative;
  min-height: 48px;
  border: 1px solid var(--siyu-border);
  border-radius: 13px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.dot {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--siyu-primary);
}
.search input {
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  border: 1px solid var(--siyu-border);
  border-radius: 13px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.notice,
.partial-error {
  padding: 10px 12px;
  border-radius: 11px;
  background: var(--siyu-primary-soft);
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.partial-error {
  color: var(--siyu-danger);
}
.loading {
  padding: 40px;
  text-align: center;
}
.groups {
  display: grid;
  gap: 18px;
  margin-top: 18px;
}
.day-group h2 {
  margin: 0 0 8px;
  color: var(--siyu-text-secondary);
  font-size: 14px;
}
.items {
  display: grid;
  gap: 8px;
}
.load-more {
  width: 100%;
  min-height: 48px;
  border: 1px solid var(--siyu-border);
  border-radius: 13px;
  background: var(--siyu-surface);
  color: var(--siyu-primary);
}
.end-note {
  color: var(--siyu-text-tertiary);
  text-align: center;
}
.empty-action {
  margin: auto;
  padding: 0 20px;
  border-radius: 12px;
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
  width: max-content;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
@media (max-width: 340px) {
  .entries-page {
    padding-inline: 10px;
  }
  .month-search {
    grid-template-columns: minmax(0, 1fr) 76px;
  }
}
</style>
