<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router';
import { ApiError, isRequestCancelled } from '../api';
import { useAuthStore } from '../auth';
import AppDialog from '../components/AppDialog.vue';
import AppDrawer from '../components/AppDrawer.vue';
import AppEmpty from '../components/AppEmpty.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import DebtEditorForm, { type DebtEditorModel } from '../components/DebtEditorForm.vue';
import EntryAmountInput from '../components/EntryAmountInput.vue';
import {
  createDebtApi,
  debtActionLabel,
  debtDirectionLabel,
  debtStatusLabel,
  type Debt,
} from '../debt';
import { formatCent } from '../entry';
import { amountInputFromCent, parseAmountToCent } from '../entry-money';
import { localBusinessDate } from '../ledger-context';
import { useApiSession } from '../use-api-session';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const api = createDebtApi(useApiSession());
const debt = ref<Debt>();
const loading = ref(true);
const fatal = ref('');
const message = ref(route.query.created === '1' ? '借贷记录已创建。' : '');
const editing = ref(false);
const processing = ref(false);
const deleting = ref(false);
const editBusy = ref(false);
const transactionBusy = ref(false);
const deleteOpen = ref(false);
const editDraft = ref<DebtEditorModel>({
  direction: 'BORROWED',
  counterpartyName: '',
  amount: '',
  startDate: '',
  dueDate: '',
  note: '',
  reminderEnabled: false,
});
const transaction = ref({
  amount: '',
  businessDate: localBusinessDate(auth.user?.timezone),
  syncEntry: false,
  note: '',
});
const transactionKey = ref(`debt-transaction-${crypto.randomUUID()}`);
let controller: AbortController | undefined;

const progress = computed(() =>
  debt.value && debt.value.principalCent > 0
    ? Math.min(100, Math.floor((debt.value.processedCent / debt.value.principalCent) * 100))
    : 0,
);
const parsedTransactionAmount = computed(() => parseAmountToCent(transaction.value.amount));
const canProcess = computed(
  () =>
    parsedTransactionAmount.value.ok &&
    Boolean(transaction.value.businessDate) &&
    parsedTransactionAmount.value.amountCent <= (debt.value?.remainingCent ?? 0) &&
    !transactionBusy.value,
);
const sameEdit = computed(
  () =>
    !debt.value ||
    (editDraft.value.counterpartyName.trim() === debt.value.counterpartyName &&
      (editDraft.value.dueDate || null) === debt.value.dueDate &&
      editDraft.value.note.trim() === (debt.value.note || '') &&
      editDraft.value.reminderEnabled === debt.value.reminderEnabled),
);

function fallback(): RouteLocationRaw {
  return { name: 'debts' };
}
function returnTarget(): RouteLocationRaw {
  const value = typeof route.query.from === 'string' ? route.query.from : '';
  if (!value.startsWith('/')) return fallback();
  try {
    return router.resolve(value).name === 'debts' ? value : fallback();
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
    debt.value = await api.get(String(route.params.id), controller.signal);
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value =
        cause instanceof ApiError && cause.status === 404
          ? '该借贷不可用或你无权访问。'
          : cause instanceof Error
            ? cause.message
            : '详情加载失败';
  } finally {
    loading.value = false;
  }
}

function openEdit() {
  if (!debt.value?.canEdit) return;
  editDraft.value = {
    direction: debt.value.direction,
    counterpartyName: debt.value.counterpartyName,
    amount: amountInputFromCent(debt.value.principalCent),
    startDate: debt.value.startDate,
    dueDate: debt.value.dueDate || '',
    note: debt.value.note || '',
    reminderEnabled: debt.value.reminderEnabled,
  };
  editing.value = true;
}

async function saveEdit() {
  if (!debt.value || sameEdit.value || editBusy.value || !editDraft.value.counterpartyName.trim())
    return;
  editBusy.value = true;
  message.value = '';
  try {
    debt.value = await api.update(debt.value.id, {
      counterpartyName: editDraft.value.counterpartyName.trim(),
      dueDate: editDraft.value.dueDate || null,
      note: editDraft.value.note.trim() || null,
      reminderEnabled: editDraft.value.reminderEnabled,
    });
    editing.value = false;
    message.value = '借贷信息已更新。';
  } catch (cause) {
    message.value = cause instanceof Error ? cause.message : '保存失败';
  } finally {
    editBusy.value = false;
  }
}

function openProcess() {
  if (!debt.value || debt.value.status === 'SETTLED' || !debt.value.canEdit) return;
  transaction.value = {
    amount: '',
    businessDate: localBusinessDate(auth.user?.timezone),
    syncEntry: false,
    note: '',
  };
  processing.value = true;
}

async function submitTransaction() {
  if (!debt.value || !canProcess.value || !parsedTransactionAmount.value.ok) return;
  transactionBusy.value = true;
  message.value = '';
  try {
    const result = await api.createTransaction(debt.value.id, {
      amountCent: parsedTransactionAmount.value.amountCent,
      businessDate: transaction.value.businessDate,
      syncEntry: transaction.value.syncEntry,
      idempotencyKey: transactionKey.value,
      note: transaction.value.note.trim() || null,
    });
    transactionKey.value = `debt-transaction-${crypto.randomUUID()}`;
    processing.value = false;
    debt.value = await api.get(result.debt.id);
    message.value = `${debtActionLabel(debt.value.direction)}已记录${result.transaction.syncEntry ? '，并已同步普通账目' : ''}。`;
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 'DEBT_AMOUNT_EXCEEDS_REMAINING')
      message.value = '处理金额超过当前剩余金额，请重新输入。';
    else if (
      cause instanceof ApiError &&
      ['DEBT_SYNC_LEDGER_UNAVAILABLE', 'DEBT_SYNC_CATEGORY_UNAVAILABLE'].includes(cause.code)
    )
      message.value = '个人账本或“其他”分类当前不可用，本次处理未保存。';
    else if (cause instanceof ApiError && cause.code === 'IDEMPOTENCY_CONFLICT')
      message.value = '处理请求状态冲突，请刷新详情确认后再操作。';
    else message.value = cause instanceof Error ? cause.message : '处理失败';
  } finally {
    transactionBusy.value = false;
  }
}

async function remove() {
  if (!debt.value || deleting.value) return;
  deleting.value = true;
  message.value = '';
  try {
    await api.delete(debt.value.id);
    deleteOpen.value = false;
    await router.replace(returnTarget());
  } catch (cause) {
    deleteOpen.value = false;
    if (cause instanceof ApiError && cause.code === 'DEBT_HAS_SYNCED_ENTRY') {
      message.value = '已有处理同步为普通账目，这条借贷不能删除。';
      await load();
    } else if (cause instanceof ApiError && cause.status === 404)
      fatal.value = '该借贷不可用或你无权访问。';
    else message.value = cause instanceof Error ? cause.message : '删除失败';
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <main class="detail-page">
    <AppPageHeader title="借贷详情" back-label="返回" @back="back" />
    <section v-if="loading" class="loading" aria-live="polite">正在加载借贷详情…</section>
    <AppErrorState v-else-if="fatal" title="借贷不可用" :message="fatal"
      ><button class="secondary" type="button" @click="back">返回借贷列表</button></AppErrorState
    >
    <template v-else-if="debt">
      <p v-if="message" class="message" role="status">{{ message }}</p>
      <section class="hero" :class="{ overdue: debt.overdueDays > 0 }">
        <div class="hero-title">
          <div>
            <small>{{ debtDirectionLabel(debt.direction) }}</small>
            <h2>{{ debt.counterpartyName }}</h2>
          </div>
          <span>{{ debtStatusLabel(debt) }}</span>
        </div>
        <small>剩余金额</small><strong>{{ formatCent(debt.remainingCent) }}</strong>
        <div class="facts">
          <span>原始 {{ formatCent(debt.principalCent) }}</span
          ><span>已处理 {{ formatCent(debt.processedCent) }}</span>
        </div>
        <div class="track" :aria-label="`已处理 ${progress}%`">
          <i :style="{ width: `${progress}%` }" />
        </div>
      </section>
      <section class="info-card">
        <div>
          <span>开始日期</span><b>{{ debt.startDate }}</b>
        </div>
        <div>
          <span>到期日期</span><b>{{ debt.dueDate || '未设置' }}</b>
        </div>
        <div>
          <span>提醒偏好</span><b>{{ debt.reminderEnabled ? '已保存' : '未启用' }}</b>
        </div>
        <div>
          <span>备注</span><b>{{ debt.note || '无' }}</b>
        </div>
      </section>
      <div class="actions">
        <button
          v-if="debt.status !== 'SETTLED' && debt.canEdit"
          class="primary"
          type="button"
          @click="openProcess"
        >
          记录{{ debtActionLabel(debt.direction) }}
        </button>
        <button v-if="debt.canEdit" type="button" @click="openEdit">编辑</button>
        <button v-if="debt.canDelete" class="danger" type="button" @click="deleteOpen = true">
          删除
        </button>
      </div>
      <p v-if="!debt.canDelete" class="readonly-note">
        存在已同步普通账目的处理记录，因此不能删除这条借贷。
      </p>
      <section class="history">
        <h2>{{ debtActionLabel(debt.direction) }}记录</h2>
        <AppEmpty
          v-if="!debt.transactions?.length"
          title="还没有处理记录"
          description="可以分多次记录，剩余为零后会自动结清。"
        />
        <ol v-else>
          <li v-for="item in debt.transactions" :key="item.id">
            <span class="timeline-dot" aria-hidden="true" />
            <div>
              <b>{{ debtActionLabel(debt.direction) }} {{ formatCent(item.amountCent) }}</b
              ><small>{{ item.businessDate }}{{ item.syncEntry ? ' · 已同步账目' : '' }}</small>
              <p v-if="item.note">{{ item.note }}</p>
            </div>
          </li>
        </ol>
      </section>
    </template>

    <AppDrawer
      :open="editing"
      title="编辑借贷"
      :busy="editBusy"
      @close="!editBusy && (editing = false)"
      ><DebtEditorForm
        v-model="editDraft"
        editing
        :disabled="editBusy"
        :submit-disabled="sameEdit || !editDraft.counterpartyName.trim()"
        @submit="saveEdit"
        ><template #submit>{{
          editBusy ? '保存中…' : sameEdit ? '没有修改' : '保存修改'
        }}</template></DebtEditorForm
      ></AppDrawer
    >
    <AppDrawer
      :open="processing"
      :title="`记录${debt ? debtActionLabel(debt.direction) : '处理'}`"
      :busy="transactionBusy"
      @close="!transactionBusy && (processing = false)"
      ><form class="transaction-form" @submit.prevent="submitTransaction">
        <EntryAmountInput v-model="transaction.amount" :disabled="transactionBusy" />
        <p
          v-if="
            parsedTransactionAmount.ok &&
            debt &&
            parsedTransactionAmount.amountCent > debt.remainingCent
          "
          class="field-error"
          role="alert"
        >
          不能超过剩余 {{ formatCent(debt.remainingCent) }}
        </p>
        <label
          ><span>业务日期</span
          ><input
            v-model="transaction.businessDate"
            type="date"
            :disabled="transactionBusy"
            required /></label
        ><label
          ><span>备注（选填）</span
          ><textarea
            v-model="transaction.note"
            maxlength="500"
            rows="3"
            :disabled="transactionBusy"
          /></label
        ><label class="sync"
          ><input
            v-model="transaction.syncEntry"
            type="checkbox"
            :disabled="transactionBusy"
          /><span
            >同步生成个人账本{{ debt?.direction === 'BORROWED' ? '支出' : '收入'
            }}<small>处理记录、汇总和普通账目会在同一事务保存。</small></span
          ></label
        ><button class="submit" type="submit" :disabled="!canProcess">
          {{
            transactionBusy ? '保存中…' : `确认${debt ? debtActionLabel(debt.direction) : '处理'}`
          }}
        </button>
      </form></AppDrawer
    >
    <AppDialog
      :open="deleteOpen"
      title="确认删除这条借贷？"
      confirm-text="删除借贷"
      danger
      :busy="deleting"
      @confirm="remove"
      @cancel="deleteOpen = false"
      ><p>仅没有同步普通账目的借贷可以删除；未同步的处理记录会一起软删除。</p></AppDialog
    >
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
  padding: 40px;
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
.hero.overdue {
  border-color: color-mix(in srgb, var(--siyu-danger) 55%, var(--siyu-border));
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
.facts,
.info-card span,
.history small {
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
.hero > strong {
  display: block;
  margin: 6px 0 12px;
  color: var(--siyu-warning);
  font-size: 32px;
  font-variant-numeric: tabular-nums;
}
.facts {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}
.track {
  height: 9px;
  margin-top: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--siyu-secondary-bg);
}
.track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--siyu-warning);
}
.info-card {
  display: grid;
  gap: 14px;
  margin-top: 12px;
}
.info-card div {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 12px;
}
.info-card b {
  overflow-wrap: anywhere;
  text-align: right;
}
.actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9px;
  margin-top: 12px;
}
.actions button,
.secondary,
.submit {
  min-height: 48px;
  border: 1px solid var(--siyu-primary);
  border-radius: 13px;
  background: var(--siyu-surface);
  color: var(--siyu-primary);
  font-weight: 700;
}
.actions .primary,
.submit {
  border: 0;
  background: var(--siyu-primary);
  color: var(--siyu-on-primary);
}
.actions .danger {
  border-color: var(--siyu-danger);
  color: var(--siyu-danger);
}
.history {
  margin-top: 24px;
}
.history h2 {
  font-size: 18px;
}
.history ol {
  margin: 0;
  padding: 0;
  list-style: none;
}
.history li {
  position: relative;
  display: grid;
  min-height: 70px;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 10px;
}
.history li:not(:last-child)::before {
  position: absolute;
  top: 16px;
  bottom: 0;
  left: 6px;
  width: 1px;
  background: var(--siyu-border);
  content: '';
}
.timeline-dot {
  position: relative;
  z-index: 1;
  width: 13px;
  height: 13px;
  margin-top: 3px;
  border-radius: 50%;
  background: var(--siyu-primary);
}
.history b,
.history small {
  display: block;
}
.history small {
  margin-top: 5px;
}
.history p {
  margin: 6px 0 0;
  overflow-wrap: anywhere;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.transaction-form {
  display: grid;
  gap: 18px;
}
.transaction-form > label {
  display: grid;
  gap: 7px;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.transaction-form input[type='date'],
.transaction-form textarea {
  width: 100%;
  min-height: 46px;
  padding: 10px 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 12px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.transaction-form textarea {
  min-height: 88px;
  resize: vertical;
}
.transaction-form .sync {
  grid-template-columns: 44px minmax(0, 1fr);
  min-height: 44px;
}
.sync input {
  width: 22px;
  height: 22px;
  margin: 1px auto;
}
.sync small {
  display: block;
  margin-top: 4px;
  line-height: 1.5;
}
.submit:disabled {
  opacity: 0.48;
}
.field-error {
  margin: -10px 0 0;
  color: var(--siyu-danger);
  font-size: 13px;
}
@media (max-width: 340px) {
  .detail-page {
    padding-inline: 12px;
  }
  .actions {
    grid-template-columns: 1fr;
  }
  .hero > strong {
    font-size: 28px;
  }
}
</style>
