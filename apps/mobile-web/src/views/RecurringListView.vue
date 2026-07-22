<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError, isRequestCancelled } from '../api';
import AppDialog from '../components/AppDialog.vue';
import AppDrawer from '../components/AppDrawer.vue';
import AppEmpty from '../components/AppEmpty.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import EntryAmountInput from '../components/EntryAmountInput.vue';
import LedgerSwitcher from '../components/LedgerSwitcher.vue';
import RecurringRuleCard from '../components/RecurringRuleCard.vue';
import RecurringRunCard from '../components/RecurringRunCard.vue';
import type { Ledger } from '../entry';
import { amountInputFromCent, parseAmountToCent } from '../entry-money';
import { listLedgers } from '../entry-resources';
import { persistLedgerId, resolveLedger } from '../ledger-context';
import { createRecurringApi, type RecurringRule, type RecurringRun } from '../recurring';
import { useApiSession } from '../use-api-session';

const route = useRoute();
const router = useRouter();
const session = useApiSession();
const api = createRecurringApi(session);
const ledgers = ref<Ledger[]>([]);
const selectedLedgerId = ref('');
const rules = ref<RecurringRule[]>([]);
const pendingRuns = ref<RecurringRun[]>([]);
const loading = ref(true);
const refreshing = ref(false);
const fatal = ref('');
const message = ref('');
const confirmRun = ref<RecurringRun>();
const skipRun = ref<RecurringRun>();
const confirmAmount = ref('');
const actionBusy = ref(false);
const confirmationKeys = new Map<string, string>();
let initialized = false;
let controller: AbortController | undefined;

const selectedLedger = computed(() =>
  ledgers.value.find((ledger) => ledger.id === selectedLedgerId.value),
);
const currentRules = computed(() =>
  rules.value.filter((rule) => rule.ledgerId === selectedLedgerId.value),
);
const currentPending = computed(() =>
  pendingRuns.value.filter((run) => run.rule.ledgerId === selectedLedgerId.value),
);
const activeCount = computed(
  () => currentRules.value.filter((rule) => rule.status === 'ACTIVE').length,
);
const parsedConfirmAmount = computed(() => parseAmountToCent(confirmAmount.value));

async function syncQuery() {
  await router.replace({ name: 'recurring', query: { ledgerId: selectedLedgerId.value } });
}

async function loadData(initial = false) {
  if (!selectedLedgerId.value) return;
  controller?.abort();
  controller = new AbortController();
  if (initial) loading.value = true;
  else refreshing.value = true;
  fatal.value = '';
  try {
    const [loadedRules, loadedRuns] = await Promise.all([
      api.listAllRules(selectedLedgerId.value, controller.signal),
      api.listAllRuns('PENDING', controller.signal),
    ]);
    rules.value = loadedRules;
    pendingRuns.value = loadedRuns;
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '周期记账加载失败';
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
    initialized = true;
    await syncQuery();
    await loadData(true);
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '周期记账加载失败';
    loading.value = false;
  }
}

watch(selectedLedgerId, async (ledgerId, previous) => {
  if (!initialized || !ledgerId || ledgerId === previous) return;
  persistLedgerId(ledgerId);
  await syncQuery();
  await loadData();
});

function openRule(rule: RecurringRule) {
  void router.push({
    name: 'recurring-detail',
    params: { id: rule.id },
    query: { from: route.fullPath },
  });
}

function beginConfirm(run: RecurringRun) {
  if (!run.canConfirm) return;
  confirmRun.value = run;
  confirmAmount.value = amountInputFromCent(run.amountCent);
}

async function submitConfirm() {
  const run = confirmRun.value;
  if (!run || !run.canConfirm || actionBusy.value || !parsedConfirmAmount.value.ok) return;
  actionBusy.value = true;
  message.value = '';
  const key = confirmationKeys.get(run.id) ?? `recurring-confirm-${crypto.randomUUID()}`;
  confirmationKeys.set(run.id, key);
  try {
    await api.confirmRun(run.id, {
      amountCent: parsedConfirmAmount.value.amountCent,
      idempotencyKey: key,
    });
    confirmationKeys.delete(run.id);
    pendingRuns.value = pendingRuns.value.filter((item) => item.id !== run.id);
    confirmRun.value = undefined;
    message.value = '本期已确认并生成普通账目。';
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 'RECURRING_CATEGORY_DISABLED')
      message.value = '规则分类已停用，当前不能确认入账。';
    else if (cause instanceof ApiError && cause.code === 'IDEMPOTENCY_CONFLICT')
      message.value = '确认请求状态冲突，请刷新后核对本期状态。';
    else message.value = cause instanceof Error ? cause.message : '确认失败';
  } finally {
    actionBusy.value = false;
  }
}

async function submitSkip() {
  const run = skipRun.value;
  if (!run || !run.canSkip || actionBusy.value) return;
  actionBusy.value = true;
  message.value = '';
  try {
    await api.skipRun(run.id);
    pendingRuns.value = pendingRuns.value.filter((item) => item.id !== run.id);
    skipRun.value = undefined;
    message.value = '本期已跳过，不会生成普通账目。';
  } catch (cause) {
    message.value =
      cause instanceof ApiError && cause.code === 'RECURRING_RUN_STATE_CONFLICT'
        ? '本期状态已变化，请刷新后再确认。'
        : cause instanceof Error
          ? cause.message
          : '跳过失败';
  } finally {
    actionBusy.value = false;
  }
}

onMounted(initialize);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <main class="recurring-page">
    <AppPageHeader title="周期记账" back-label="返回" @back="router.push('/account')">
      <RouterLink
        class="new-link"
        :to="{ name: 'recurring-new', query: { ledgerId: selectedLedgerId } }"
        >新增</RouterLink
      >
    </AppPageHeader>
    <section v-if="loading" class="loading" aria-live="polite">
      正在加载周期规则和待确认事项…
    </section>
    <AppErrorState
      v-else-if="fatal"
      title="周期记账加载失败"
      :message="fatal"
      retry-label="重试"
      @retry="initialize"
    />
    <template v-else>
      <LedgerSwitcher v-model="selectedLedgerId" :ledgers="ledgers" :disabled="refreshing" />
      <p v-if="message" class="message" role="status">{{ message }}</p>
      <section class="summary" aria-label="周期记账概览">
        <div>
          <small>待确认</small><strong>{{ currentPending.length }}</strong>
        </div>
        <div>
          <small>进行中规则</small><strong>{{ activeCount }}</strong>
        </div>
        <p>
          {{
            selectedLedger?.type === 'COUPLE'
              ? '双方可查看，操作权限以服务端返回为准。'
              : '个人周期规则仅本人可见。'
          }}
        </p>
      </section>
      <section v-if="currentPending.length" class="section-block">
        <div class="section-title">
          <h2>待确认</h2>
          <span>{{ currentPending.length }} 项</span>
        </div>
        <div class="run-list">
          <RecurringRunCard
            v-for="run in currentPending"
            :key="run.id"
            :run="run"
            actions
            :busy="actionBusy"
            @confirm="beginConfirm(run)"
            @skip="skipRun = run"
          />
        </div>
      </section>
      <section class="section-block">
        <div class="section-title">
          <h2>周期规则</h2>
          <span>{{ currentRules.length }} 条</span>
        </div>
        <AppEmpty
          v-if="!currentRules.length"
          title="还没有周期规则"
          description="可以添加房租、订阅、分期或固定收入，到期自动记账或等待确认。"
        >
          <RouterLink
            class="empty-action"
            :to="{ name: 'recurring-new', query: { ledgerId: selectedLedgerId } }"
            >创建周期规则</RouterLink
          >
        </AppEmpty>
        <div v-else class="rule-list">
          <RecurringRuleCard
            v-for="rule in currentRules"
            :key="rule.id"
            :rule="rule"
            @open="openRule(rule)"
          />
        </div>
      </section>
    </template>

    <AppDrawer
      :open="Boolean(confirmRun)"
      title="确认本期金额"
      :busy="actionBusy"
      @close="!actionBusy && (confirmRun = undefined)"
    >
      <form class="confirm-form" @submit.prevent="submitConfirm">
        <p>确认后会按本期计划日期生成一笔普通账目；金额只影响本期。</p>
        <EntryAmountInput v-model="confirmAmount" :disabled="actionBusy" />
        <button type="submit" :disabled="actionBusy || !parsedConfirmAmount.ok">
          {{ actionBusy ? '确认中…' : '确认并入账' }}
        </button>
      </form>
    </AppDrawer>
    <AppDialog
      :open="Boolean(skipRun)"
      title="确认跳过本期？"
      confirm-text="跳过本期"
      danger
      :busy="actionBusy"
      @confirm="submitSkip"
      @cancel="!actionBusy && (skipRun = undefined)"
      ><p>跳过后本期不会生成普通账目，且不能再次确认。</p></AppDialog
    >
  </main>
</template>

<style scoped>
.recurring-page {
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
.loading {
  padding: 40px 16px;
  text-align: center;
}
.message {
  padding: 11px 12px;
  border-radius: 12px;
  background: var(--siyu-primary-soft);
  color: var(--siyu-text-secondary);
  overflow-wrap: anywhere;
}
.summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
  padding: 18px;
  border: 1px solid var(--siyu-border);
  border-radius: 18px;
  background: var(--siyu-surface);
}
.summary div {
  display: grid;
  gap: 4px;
}
.summary small,
.summary p,
.section-title span,
.confirm-form p {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.summary strong {
  color: var(--siyu-primary);
  font-size: 28px;
  font-variant-numeric: tabular-nums;
}
.summary p {
  grid-column: 1 / -1;
  margin: 0;
  line-height: 1.6;
}
.section-block {
  margin-top: 24px;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.section-title h2 {
  margin: 0;
  font-size: 18px;
}
.run-list,
.rule-list {
  display: grid;
  gap: 10px;
}
.empty-action {
  width: max-content;
  margin: auto;
  padding: 0 18px;
  border-radius: 12px;
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
}
.confirm-form {
  display: grid;
  gap: 16px;
}
.confirm-form p {
  margin: 0;
  line-height: 1.6;
}
.confirm-form button {
  min-height: 48px;
  border: 0;
  border-radius: 12px;
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
  font-weight: 700;
}
.confirm-form button:disabled {
  opacity: 0.55;
}
@media (max-width: 340px) {
  .recurring-page {
    padding-inline: 10px;
  }
}
</style>
