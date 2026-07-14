<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router';
import { ApiError, isRequestCancelled } from '../api';
import AppDialog from '../components/AppDialog.vue';
import AppDrawer from '../components/AppDrawer.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import EntryDetailCard from '../components/EntryDetailCard.vue';
import EntryEditorForm, { type EntryEditorModel } from '../components/EntryEditorForm.vue';
import { amountInputFromCent, parseAmountToCent } from '../entry-money';
import { createEntryApi, type Entry, type Ledger, type UpdateEntryRequest } from '../entry';
import { listCategories, listLedgers, type Category } from '../entry-resources';
import { useApiSession } from '../use-api-session';

const route = useRoute();
const router = useRouter();
const session = useApiSession();
const api = createEntryApi(session);
const entry = ref<Entry>();
const ledgers = ref<Ledger[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const fatal = ref('');
const message = ref('');
const editing = ref(false);
const deleting = ref(false);
const submitting = ref(false);
const deleteOpen = ref(false);
const conflictOpen = ref(false);
const draft = ref<EntryEditorModel>({
  ledgerId: '',
  type: 'EXPENSE',
  amount: '',
  categoryId: '',
  businessDate: '',
  note: '',
  paymentMethod: '',
});
let controller: AbortController | undefined;
const ledgerName = computed(
  () => ledgers.value.find((item) => item.id === entry.value?.ledgerId)?.name || '当前账本',
);
const canSubmit = computed(() => {
  const amount = parseAmountToCent(draft.value.amount);
  return (
    amount.ok && Boolean(draft.value.categoryId && draft.value.businessDate) && !sameAsEntry.value
  );
});
const sameAsEntry = computed(() => {
  if (!entry.value) return true;
  const amount = parseAmountToCent(draft.value.amount);
  return (
    amount.ok &&
    amount.amountCent === entry.value.amountCent &&
    draft.value.type === entry.value.type &&
    draft.value.categoryId === entry.value.category.id &&
    draft.value.businessDate === entry.value.businessDate &&
    draft.value.note.trim() === (entry.value.note || '') &&
    String(draft.value.paymentMethod || '') === String(entry.value.paymentMethod || '')
  );
});

function fallback(): RouteLocationRaw {
  return {
    name: 'entries',
    query: {
      ...(entry.value
        ? { ledgerId: entry.value.ledgerId, month: entry.value.businessDate.slice(0, 7) }
        : {}),
    },
  };
}
function returnTarget(): RouteLocationRaw {
  const value = typeof route.query.from === 'string' ? route.query.from : '';
  if (!value.startsWith('/')) return fallback();
  try {
    const resolved = router.resolve(value);
    return resolved.name === 'entries' ? value : fallback();
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
    const [loadedEntry, loadedLedgers] = await Promise.all([
      api.get(id, controller.signal),
      listLedgers(session, controller.signal),
    ]);
    entry.value = loadedEntry;
    ledgers.value = loadedLedgers;
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value =
        cause instanceof ApiError && cause.status === 404
          ? '该账目不可用或你无权访问。'
          : cause instanceof Error
            ? cause.message
            : '详情加载失败';
  } finally {
    loading.value = false;
  }
}
function resetDraft() {
  if (!entry.value) return;
  draft.value = {
    ledgerId: entry.value.ledgerId,
    type: entry.value.type,
    amount: amountInputFromCent(entry.value.amountCent),
    categoryId: entry.value.category.id,
    businessDate: entry.value.businessDate,
    note: entry.value.note || '',
    paymentMethod: entry.value.paymentMethod || '',
  };
}
async function loadCategoriesForDraft() {
  if (!entry.value) return;
  try {
    const result = await listCategories(session, entry.value.ledgerId, draft.value.type, false);
    categories.value = result.items.filter((item) => item.isEnabled);
    if (!categories.value.some((item) => item.id === draft.value.categoryId))
      draft.value = { ...draft.value, categoryId: '' };
  } catch (cause) {
    message.value = cause instanceof Error ? cause.message : '分类加载失败';
  }
}
async function openEdit() {
  if (!entry.value?.canEdit || entry.value.sourceType !== 'MANUAL') return;
  resetDraft();
  await loadCategoriesForDraft();
  editing.value = true;
}
async function changeDraft(value: EntryEditorModel) {
  const typeChanged = value.type !== draft.value.type;
  draft.value = value;
  if (typeChanged) {
    draft.value = { ...draft.value, categoryId: '' };
    await loadCategoriesForDraft();
  }
}
async function save() {
  if (!entry.value || !canSubmit.value || submitting.value) return;
  const amount = parseAmountToCent(draft.value.amount);
  if (!amount.ok) return;
  submitting.value = true;
  message.value = '';
  const input: UpdateEntryRequest = {
    expectedVersion: entry.value.version,
    type: draft.value.type,
    amountCent: amount.amountCent,
    categoryId: draft.value.categoryId,
    businessDate: draft.value.businessDate,
    note: draft.value.note.trim() || null,
    paymentMethod: draft.value.paymentMethod || null,
  };
  try {
    entry.value = await api.update(entry.value.id, input);
    editing.value = false;
    message.value = '账目已更新。';
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 'ENTRY_VERSION_CONFLICT')
      conflictOpen.value = true;
    else if (
      cause instanceof ApiError &&
      ['CATEGORY_DISABLED', 'ENTRY_CATEGORY_INVALID'].includes(cause.code)
    ) {
      await loadCategoriesForDraft();
      message.value = '原分类已不可用，请重新选择。';
    } else message.value = cause instanceof Error ? cause.message : '保存失败';
  } finally {
    submitting.value = false;
  }
}
async function resolveConflict(continueEditing: boolean) {
  conflictOpen.value = false;
  await load();
  if (continueEditing && entry.value) {
    resetDraft();
    await loadCategoriesForDraft();
    editing.value = true;
  } else editing.value = false;
}
async function remove() {
  if (!entry.value || deleting.value) return;
  deleting.value = true;
  message.value = '';
  try {
    await api.delete(entry.value.id, entry.value.version);
    deleteOpen.value = false;
    await router.replace(returnTarget());
  } catch (cause) {
    deleteOpen.value = false;
    if (cause instanceof ApiError && cause.code === 'ENTRY_VERSION_CONFLICT') {
      message.value = '账目已被更新，请刷新后再删除。';
      await load();
    } else if (cause instanceof ApiError && cause.code === 'ENTRY_SOURCE_MANAGED')
      message.value = '来源账目只能在对应业务中管理。';
    else if (cause instanceof ApiError && cause.status === 404)
      fatal.value = '该账目不可用或你无权访问。';
    else message.value = cause instanceof Error ? cause.message : '删除失败，请重试';
  } finally {
    deleting.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>
<template>
  <main class="detail-page">
    <AppPageHeader title="账目详情" back-label="返回" @back="back" />
    <section v-if="loading" class="loading" aria-live="polite">正在加载账目…</section>
    <AppErrorState v-else-if="fatal" title="账目不可用" :message="fatal"
      ><button class="back-button" type="button" @click="back">返回明细</button></AppErrorState
    ><template v-else-if="entry"
      ><p v-if="message" class="message" role="status">{{ message }}</p>
      <EntryDetailCard :entry="entry" :ledger-name="ledgerName" />
      <div v-if="entry.canEdit || entry.canDelete" class="actions">
        <button v-if="entry.canEdit" type="button" @click="openEdit">编辑账目</button
        ><button v-if="entry.canDelete" class="danger" type="button" @click="deleteOpen = true">
          删除账目
        </button>
      </div></template
    ><AppDrawer
      :open="editing"
      title="编辑账目"
      :busy="submitting"
      @close="!submitting && (editing = false)"
      ><EntryEditorForm
        :model-value="draft"
        :ledgers="ledgers"
        :categories="categories"
        lock-ledger
        :disabled="submitting"
        :submit-disabled="!canSubmit"
        @update:model-value="changeDraft"
        @submit="save"
        ><template #submit>{{
          submitting ? '保存中…' : sameAsEntry ? '没有修改' : '保存修改'
        }}</template></EntryEditorForm
      ></AppDrawer
    ><AppDialog
      :open="deleteOpen"
      title="确认删除这笔账目？"
      confirm-text="删除账目"
      danger
      :busy="deleting"
      @confirm="remove"
      @cancel="deleteOpen = false"
      ><p>删除后不会再出现在正常明细中，此操作不会物理删除财务记录。</p></AppDialog
    ><AppDialog
      :open="conflictOpen"
      title="数据已被更新"
      confirm-text="重新加载并继续编辑"
      cancel-text="放弃本次修改"
      @confirm="resolveConflict(true)"
      @cancel="resolveConflict(false)"
      ><p>当前内容不是最新版本。为避免覆盖其他修改，请先重新加载。</p></AppDialog
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
.message {
  padding: 12px;
  border-radius: 12px;
  background: var(--siyu-primary-soft);
  color: var(--siyu-text-secondary);
  overflow-wrap: anywhere;
}
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}
.actions button,
.back-button {
  min-height: 48px;
  border: 1px solid var(--siyu-primary);
  border-radius: 13px;
  background: var(--siyu-surface);
  color: var(--siyu-primary);
  font-weight: 700;
}
.actions .danger {
  border-color: var(--siyu-danger);
  color: var(--siyu-danger);
}
@media (max-width: 340px) {
  .detail-page {
    padding-inline: 12px;
  }
  .actions {
    grid-template-columns: 1fr;
  }
}
</style>
