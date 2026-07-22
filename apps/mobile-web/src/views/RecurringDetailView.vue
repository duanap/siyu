<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router';
import { ApiError, isRequestCancelled } from '../api';
import AppDialog from '../components/AppDialog.vue';
import AppDrawer from '../components/AppDrawer.vue';
import AppEmpty from '../components/AppEmpty.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import EntryAmountInput from '../components/EntryAmountInput.vue';
import RecurringRuleForm, {
  type RecurringRuleFormModel,
} from '../components/RecurringRuleForm.vue';
import RecurringRunCard from '../components/RecurringRunCard.vue';
import type { Ledger } from '../entry';
import { amountInputFromCent, formatAmount, parseAmountToCent } from '../entry-money';
import { listCategories, listLedgers, type Category } from '../entry-resources';
import {
  createRecurringApi,
  generationModeLabel,
  recurringFrequencyLabel,
  recurringProgressLabel,
  recurringStatusLabel,
  type RecurringRule,
  type RecurringRun,
} from '../recurring';
import { useApiSession } from '../use-api-session';

const route = useRoute();
const router = useRouter();
const session = useApiSession();
const api = createRecurringApi(session);
const rule = ref<RecurringRule>();
const runs = ref<RecurringRun[]>([]);
const ledgers = ref<Ledger[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const fatal = ref('');
const message = ref(route.query.created === '1' ? '周期规则已创建。' : '');
const editing = ref(false);
const categoriesLoading = ref(false);
const editBusy = ref(false);
const stateBusy = ref(false);
const actionBusy = ref(false);
const deleting = ref(false);
const deleteOpen = ref(false);
const confirmRun = ref<RecurringRun>();
const skipRun = ref<RecurringRun>();
const confirmAmount = ref('');
const confirmationKeys = new Map<string, string>();
let controller: AbortController | undefined;
let categoryController: AbortController | undefined;

const emptyDraft = (): RecurringRuleFormModel => ({
  ledgerId: '',
  name: '',
  entryType: 'EXPENSE',
  amount: '',
  categoryId: '',
  frequency: 'MONTHLY',
  intervalValue: 1,
  startDate: '',
  generationMode: 'AUTO',
  endMode: 'NONE',
  endDate: '',
  totalOccurrences: 12,
  reminderDaysBefore: 1,
});
const editDraft = ref<RecurringRuleFormModel>(emptyDraft());
const parsedEditAmount = computed(() => parseAmountToCent(editDraft.value.amount));
const parsedConfirmAmount = computed(() => parseAmountToCent(confirmAmount.value));
const ledgerName = computed(
  () => ledgers.value.find((ledger) => ledger.id === rule.value?.ledgerId)?.name ?? '当前账本',
);
const sortedRuns = computed(() =>
  [...runs.value].sort((left, right) => right.scheduledDate.localeCompare(left.scheduledDate)),
);
const editValid = computed(
  () =>
    parsedEditAmount.value.ok &&
    Boolean(
      editDraft.value.name.trim() && editDraft.value.categoryId && editDraft.value.startDate,
    ) &&
    Number.isInteger(editDraft.value.intervalValue) &&
    editDraft.value.intervalValue >= 1 &&
    editDraft.value.intervalValue <= 1200 &&
    Number.isInteger(editDraft.value.reminderDaysBefore) &&
    editDraft.value.reminderDaysBefore >= 0 &&
    editDraft.value.reminderDaysBefore <= 365 &&
    (editDraft.value.endMode !== 'DATE' ||
      Boolean(editDraft.value.endDate && editDraft.value.endDate >= editDraft.value.startDate)) &&
    (editDraft.value.endMode !== 'COUNT' ||
      (Number.isInteger(editDraft.value.totalOccurrences) &&
        editDraft.value.totalOccurrences >= 1)),
);
const sameEdit = computed(() => {
  const current = rule.value;
  if (!current || !parsedEditAmount.value.ok) return true;
  return (
    editDraft.value.name.trim() === current.name &&
    editDraft.value.entryType === current.entryType &&
    parsedEditAmount.value.amountCent === current.amountCent &&
    editDraft.value.categoryId === current.categoryId &&
    editDraft.value.frequency === current.frequency &&
    editDraft.value.intervalValue === current.intervalValue &&
    editDraft.value.startDate === current.startDate &&
    editDraft.value.generationMode === current.generationMode &&
    (editDraft.value.endMode === 'DATE' ? editDraft.value.endDate : null) === current.endDate &&
    (editDraft.value.endMode === 'COUNT' ? editDraft.value.totalOccurrences : null) ===
      current.totalOccurrences &&
    editDraft.value.reminderDaysBefore === current.reminderDaysBefore
  );
});

function fallback(): RouteLocationRaw {
  return { name: 'recurring', query: rule.value ? { ledgerId: rule.value.ledgerId } : {} };
}
function returnTarget(): RouteLocationRaw {
  const value = typeof route.query.from === 'string' ? route.query.from : '';
  if (!value.startsWith('/')) return fallback();
  try {
    return router.resolve(value).name === 'recurring' ? value : fallback();
  } catch {
    return fallback();
  }
}
function back() {
  void router.push(returnTarget());
}

async function load() {
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  fatal.value = '';
  try {
    const id = String(route.params.id);
    const [loadedRule, loadedRuns, loadedLedgers] = await Promise.all([
      api.getRule(id, controller.signal),
      api.listAllRuns(undefined, controller.signal),
      listLedgers(session, controller.signal),
    ]);
    rule.value = loadedRule;
    runs.value = loadedRuns.filter((run) => run.ruleId === id);
    ledgers.value = loadedLedgers;
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value =
        cause instanceof ApiError && cause.status === 404
          ? '该周期规则不可用或你无权访问。'
          : cause instanceof Error
            ? cause.message
            : '详情加载失败';
  } finally {
    loading.value = false;
  }
}

function draftFromRule(current: RecurringRule): RecurringRuleFormModel {
  return {
    ledgerId: current.ledgerId,
    name: current.name,
    entryType: current.entryType,
    amount: amountInputFromCent(current.amountCent),
    categoryId: current.categoryId,
    frequency: current.frequency,
    intervalValue: current.intervalValue,
    startDate: current.startDate,
    generationMode: current.generationMode,
    endMode: current.endDate ? 'DATE' : current.totalOccurrences !== null ? 'COUNT' : 'NONE',
    endDate: current.endDate ?? '',
    totalOccurrences: current.totalOccurrences ?? Math.max(12, current.completedOccurrences),
    reminderDaysBefore: current.reminderDaysBefore,
  };
}

async function loadEditCategories() {
  if (!rule.value) return;
  categoryController?.abort();
  categoryController = new AbortController();
  categoriesLoading.value = true;
  try {
    const result = await listCategories(
      session,
      rule.value.ledgerId,
      editDraft.value.entryType,
      true,
      categoryController.signal,
    );
    categories.value = result.items;
    if (!categories.value.some((category) => category.id === editDraft.value.categoryId))
      editDraft.value = { ...editDraft.value, categoryId: '' };
  } catch (cause) {
    if (!isRequestCancelled(cause))
      message.value = cause instanceof Error ? cause.message : '分类加载失败';
  } finally {
    categoriesLoading.value = false;
  }
}

async function openEdit() {
  if (!rule.value?.canEdit) return;
  editDraft.value = draftFromRule(rule.value);
  await loadEditCategories();
  editing.value = true;
}

watch(
  () => editDraft.value.entryType,
  async (entryType, previous) => {
    if (!editing.value || entryType === previous) return;
    await loadEditCategories();
  },
);

async function saveEdit() {
  if (
    !rule.value ||
    !editValid.value ||
    sameEdit.value ||
    editBusy.value ||
    !parsedEditAmount.value.ok
  )
    return;
  editBusy.value = true;
  message.value = '';
  try {
    rule.value = await api.updateRule(rule.value.id, {
      name: editDraft.value.name.trim(),
      entryType: editDraft.value.entryType,
      amountCent: parsedEditAmount.value.amountCent,
      categoryId: editDraft.value.categoryId,
      frequency: editDraft.value.frequency,
      intervalValue: editDraft.value.intervalValue,
      startDate: editDraft.value.startDate,
      endDate: editDraft.value.endMode === 'DATE' ? editDraft.value.endDate : null,
      totalOccurrences:
        editDraft.value.endMode === 'COUNT' ? editDraft.value.totalOccurrences : null,
      generationMode: editDraft.value.generationMode,
      reminderDaysBefore: editDraft.value.reminderDaysBefore,
    });
    editing.value = false;
    message.value = '周期规则已更新。';
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 'RECURRING_SCHEDULE_LOCKED')
      message.value = '已有执行实例，不能修改收支分类、频率、开始日期或生成方式。';
    else if (cause instanceof ApiError && cause.code === 'RECURRING_CATEGORY_INVALID') {
      message.value = '所选分类已停用或与账本、收支类型不匹配。';
      await loadEditCategories();
    } else message.value = cause instanceof Error ? cause.message : '保存失败';
  } finally {
    editBusy.value = false;
  }
}

async function changeState(action: 'pause' | 'resume') {
  if (!rule.value || stateBusy.value) return;
  stateBusy.value = true;
  message.value = '';
  try {
    rule.value =
      action === 'pause' ? await api.pauseRule(rule.value.id) : await api.resumeRule(rule.value.id);
    message.value =
      action === 'pause' ? '周期规则已暂停。' : '周期规则已恢复，将从当前日期之后的下一期继续。';
  } catch (cause) {
    message.value =
      cause instanceof ApiError && cause.code === 'RECURRING_RULE_STATE_CONFLICT'
        ? '规则状态已变化，正在重新加载。'
        : cause instanceof Error
          ? cause.message
          : '操作失败';
    await load();
  } finally {
    stateBusy.value = false;
  }
}

function beginConfirm(run: RecurringRun) {
  if (!run.canConfirm) return;
  confirmRun.value = run;
  confirmAmount.value = amountInputFromCent(run.amountCent);
}

async function submitConfirm() {
  const currentRun = confirmRun.value;
  if (!currentRun || !currentRun.canConfirm || actionBusy.value || !parsedConfirmAmount.value.ok)
    return;
  actionBusy.value = true;
  message.value = '';
  const key = confirmationKeys.get(currentRun.id) ?? `recurring-confirm-${crypto.randomUUID()}`;
  confirmationKeys.set(currentRun.id, key);
  try {
    const updated = await api.confirmRun(currentRun.id, {
      amountCent: parsedConfirmAmount.value.amountCent,
      idempotencyKey: key,
    });
    confirmationKeys.delete(currentRun.id);
    runs.value = runs.value.map((run) => (run.id === updated.id ? updated : run));
    confirmRun.value = undefined;
    message.value = '本期已确认并生成普通账目。';
  } catch (cause) {
    message.value =
      cause instanceof ApiError && cause.code === 'IDEMPOTENCY_CONFLICT'
        ? '确认请求状态冲突，请刷新详情核对本期状态。'
        : cause instanceof Error
          ? cause.message
          : '确认失败';
  } finally {
    actionBusy.value = false;
  }
}

async function submitSkip() {
  const currentRun = skipRun.value;
  if (!currentRun || !currentRun.canSkip || actionBusy.value) return;
  actionBusy.value = true;
  message.value = '';
  try {
    const updated = await api.skipRun(currentRun.id);
    runs.value = runs.value.map((run) => (run.id === updated.id ? updated : run));
    skipRun.value = undefined;
    message.value = '本期已跳过，不会生成普通账目。';
  } catch (cause) {
    message.value = cause instanceof Error ? cause.message : '跳过失败';
  } finally {
    actionBusy.value = false;
  }
}

async function remove() {
  if (!rule.value || deleting.value) return;
  deleting.value = true;
  message.value = '';
  try {
    await api.deleteRule(rule.value.id);
    deleteOpen.value = false;
    await router.replace(returnTarget());
  } catch (cause) {
    deleteOpen.value = false;
    if (cause instanceof ApiError && cause.status === 404)
      fatal.value = '该周期规则不可用或你无权访问。';
    else message.value = cause instanceof Error ? cause.message : '删除失败';
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
onBeforeUnmount(() => {
  controller?.abort();
  categoryController?.abort();
});
</script>

<template>
  <main class="detail-page">
    <AppPageHeader title="周期规则详情" back-label="返回" @back="back" />
    <section v-if="loading" class="loading" aria-live="polite">正在加载周期规则…</section>
    <AppErrorState v-else-if="fatal" title="周期规则不可用" :message="fatal">
      <button class="secondary" type="button" @click="back">返回周期列表</button>
    </AppErrorState>
    <template v-else-if="rule">
      <p v-if="message" class="message" role="status">{{ message }}</p>
      <section class="hero">
        <div class="hero-title">
          <div>
            <small>{{ ledgerName }}</small>
            <h2>{{ rule.name }}</h2>
          </div>
          <span :data-status="rule.status">{{ recurringStatusLabel(rule.status) }}</span>
        </div>
        <small>每期金额</small>
        <strong :data-type="rule.entryType">{{
          formatAmount(rule.amountCent, rule.entryType)
        }}</strong>
        <p>
          {{ recurringFrequencyLabel(rule.frequency, rule.intervalValue) }} ·
          {{ generationModeLabel(rule.generationMode) }}
        </p>
        <p>
          {{ recurringProgressLabel(rule) }} ·
          {{ rule.nextRunDate ? `下次 ${rule.nextRunDate}` : '没有下一期' }}
        </p>
      </section>
      <section class="info-card">
        <div>
          <span>分类</span
          ><b>{{ rule.category.name }}{{ rule.category.isEnabled ? '' : '（已停用）' }}</b>
        </div>
        <div>
          <span>开始日期</span><b>{{ rule.startDate }}</b>
        </div>
        <div>
          <span>结束条件</span
          ><b>{{
            rule.endDate || (rule.totalOccurrences ? `共 ${rule.totalOccurrences} 期` : '不设结束')
          }}</b>
        </div>
        <div>
          <span>提前提醒</span
          ><b>{{ rule.reminderDaysBefore === 0 ? '到期当天' : `${rule.reminderDaysBefore} 天` }}</b>
        </div>
      </section>
      <div class="actions">
        <button v-if="rule.canEdit" type="button" @click="openEdit">编辑</button>
        <button
          v-if="rule.canPause"
          type="button"
          :disabled="stateBusy"
          @click="changeState('pause')"
        >
          暂停
        </button>
        <button
          v-if="rule.canResume"
          class="primary"
          type="button"
          :disabled="stateBusy"
          @click="changeState('resume')"
        >
          恢复
        </button>
        <button v-if="rule.canDelete" class="danger" type="button" @click="deleteOpen = true">
          删除
        </button>
      </div>
      <p
        v-if="!rule.canEdit && !rule.canPause && !rule.canResume && !rule.canDelete"
        class="readonly-note"
      >
        你可以查看这条共同规则，但当前没有管理权限。
      </p>
      <section class="history">
        <h2>执行记录</h2>
        <AppEmpty
          v-if="!sortedRuns.length"
          title="还没有执行记录"
          description="到期物化后会在这里显示自动入账、待确认、跳过或失败状态。"
        />
        <div v-else class="run-list">
          <RecurringRunCard
            v-for="item in sortedRuns"
            :key="item.id"
            :run="item"
            actions
            :busy="actionBusy"
            @confirm="beginConfirm(item)"
            @skip="skipRun = item"
          />
        </div>
      </section>
    </template>

    <AppDrawer
      :open="editing"
      title="编辑周期规则"
      :busy="editBusy"
      @close="!editBusy && (editing = false)"
    >
      <RecurringRuleForm
        v-model="editDraft"
        :ledgers="ledgers"
        :categories="categories"
        :categories-loading="categoriesLoading"
        lock-ledger
        :disabled="editBusy"
        :submit-disabled="sameEdit || !editValid"
        @submit="saveEdit"
        ><template #submit>{{
          editBusy ? '保存中…' : sameEdit ? '没有修改' : '保存修改'
        }}</template></RecurringRuleForm
      >
    </AppDrawer>
    <AppDrawer
      :open="Boolean(confirmRun)"
      title="确认本期金额"
      :busy="actionBusy"
      @close="!actionBusy && (confirmRun = undefined)"
    >
      <form class="confirm-form" @submit.prevent="submitConfirm">
        <p>金额只作用于本期，确认后按计划日期生成普通账目。</p>
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
    >
      <p>跳过后本期不会生成普通账目，且不能再次确认。</p>
    </AppDialog>
    <AppDialog
      :open="deleteOpen"
      title="确认删除这条周期规则？"
      confirm-text="删除规则"
      danger
      :busy="deleting"
      @confirm="remove"
      @cancel="deleteOpen = false"
    >
      <p>规则将软删除并停止后续执行；历史实例和已生成账目仍会保留。</p>
    </AppDialog>
  </main>
</template>

<style scoped>
.detail-page {
  width: min(100%, 480px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 0 16px max(32px, env(safe-area-inset-bottom));
  overflow-x: clip;
  background: var(--siyu-page-bg);
  color: var(--siyu-text);
}
.loading {
  padding: 40px 16px;
  text-align: center;
}
.message,
.readonly-note {
  padding: 11px 12px;
  border-radius: 12px;
  background: var(--siyu-primary-soft);
  color: var(--siyu-text-secondary);
  overflow-wrap: anywhere;
}
.hero,
.info-card {
  padding: 18px;
  border: 1px solid var(--siyu-border);
  border-radius: 18px;
  background: var(--siyu-surface);
}
.hero-title {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}
.hero-title h2 {
  margin: 3px 0 18px;
  overflow-wrap: anywhere;
  font-size: 20px;
}
.hero-title small,
.hero > small,
.hero p,
.info-card span {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.hero-title > span {
  flex: 0 0 auto;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-size: 12px;
}
.hero-title > span[data-status='PAUSED'] {
  background: var(--siyu-warning-soft);
  color: var(--siyu-warning);
}
.hero > strong {
  display: block;
  margin: 6px 0 12px;
  color: var(--siyu-expense);
  font-size: 30px;
  font-variant-numeric: tabular-nums;
}
.hero > strong[data-type='INCOME'] {
  color: var(--siyu-income);
}
.hero p {
  margin: 7px 0 0;
  line-height: 1.5;
}
.info-card {
  display: grid;
  gap: 13px;
  margin-top: 12px;
}
.info-card div {
  display: flex;
  min-width: 0;
  justify-content: space-between;
  gap: 12px;
}
.info-card b {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: right;
}
.actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0;
}
.actions button,
.secondary {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 12px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.actions .primary {
  border-color: var(--siyu-primary);
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
}
.actions .danger {
  border-color: var(--siyu-danger);
  color: var(--siyu-danger);
}
.actions button:disabled {
  opacity: 0.55;
}
.history {
  margin-top: 24px;
}
.history h2 {
  font-size: 18px;
}
.run-list {
  display: grid;
  gap: 10px;
}
.confirm-form {
  display: grid;
  gap: 16px;
}
.confirm-form p {
  margin: 0;
  color: var(--siyu-text-secondary);
  font-size: 12px;
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
  .detail-page {
    padding-inline: 10px;
  }
  .hero-title {
    display: grid;
  }
}
</style>
