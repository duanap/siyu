<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError, isRequestCancelled } from '../api';
import { useAuthStore } from '../auth';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import EntryEditorForm, { type EntryEditorModel } from '../components/EntryEditorForm.vue';
import { createEntryApi, type EntryType, type Ledger } from '../entry';
import { markEntryCreated } from '../entry-flash';
import { parseAmountToCent } from '../entry-money';
import { listCategories, listLedgers, type Category } from '../entry-resources';
import { localBusinessDate, persistLedgerId, resolveLedger } from '../ledger-context';
import { useApiSession } from '../use-api-session';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const session = useApiSession();
const api = createEntryApi(session);
const ledgers = ref<Ledger[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const categoriesLoading = ref(false);
const submitting = ref(false);
const fatal = ref('');
const error = ref('');
const idempotencyKey = ref(`entry-${crypto.randomUUID()}`);
let categoryController: AbortController | undefined;
const initialType: EntryType = route.query.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
const form = ref<EntryEditorModel>({
  ledgerId: '',
  type: initialType,
  amount: '',
  categoryId: '',
  businessDate: localBusinessDate(auth.user?.timezone),
  note: '',
  paymentMethod: '',
});
const parsedAmount = computed(() => parseAmountToCent(form.value.amount));
const canSubmit = computed(
  () =>
    !submitting.value &&
    parsedAmount.value.ok &&
    Boolean(form.value.ledgerId && form.value.categoryId && form.value.businessDate),
);

async function syncQuery() {
  await router.replace({
    name: 'entry-new',
    query: { ledgerId: form.value.ledgerId, type: form.value.type },
  });
}
async function loadCategoriesForForm() {
  if (!form.value.ledgerId) return;
  categoryController?.abort();
  categoryController = new AbortController();
  categoriesLoading.value = true;
  error.value = '';
  try {
    const result = await listCategories(
      session,
      form.value.ledgerId,
      form.value.type,
      false,
      categoryController.signal,
    );
    categories.value = result.items.filter((item) => item.isEnabled);
    if (!categories.value.some((item) => item.id === form.value.categoryId))
      form.value = { ...form.value, categoryId: '' };
  } catch (cause) {
    if (!isRequestCancelled(cause))
      error.value = cause instanceof Error ? cause.message : '分类加载失败';
  } finally {
    categoriesLoading.value = false;
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
    form.value = { ...form.value, ledgerId: resolved.ledger.id };
    persistLedgerId(resolved.ledger.id);
    await syncQuery();
    await loadCategoriesForForm();
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '页面加载失败';
  } finally {
    loading.value = false;
  }
}
watch(
  () => [form.value.ledgerId, form.value.type] as const,
  async ([ledgerId, type], [oldLedger, oldType]) => {
    if (loading.value || (ledgerId === oldLedger && type === oldType)) return;
    persistLedgerId(ledgerId);
    await syncQuery();
    await loadCategoriesForForm();
  },
);
async function submit() {
  if (!canSubmit.value || !parsedAmount.value.ok) return;
  submitting.value = true;
  error.value = '';
  try {
    const entry = await api.create({
      ledgerId: form.value.ledgerId,
      type: form.value.type,
      amountCent: parsedAmount.value.amountCent,
      categoryId: form.value.categoryId,
      businessDate: form.value.businessDate,
      note: form.value.note.trim() || null,
      paymentMethod: form.value.paymentMethod || null,
      idempotencyKey: idempotencyKey.value,
    });
    markEntryCreated(entry.id);
    idempotencyKey.value = `entry-${crypto.randomUUID()}`;
    await router.replace({
      name: 'entries',
      query: { ledgerId: entry.ledgerId, month: entry.businessDate.slice(0, 7) },
    });
  } catch (cause) {
    if (
      cause instanceof ApiError &&
      ['CATEGORY_DISABLED', 'ENTRY_CATEGORY_INVALID'].includes(cause.code)
    )
      await loadCategoriesForForm();
    error.value =
      cause instanceof ApiError && cause.code === 'IDEMPOTENCY_CONFLICT'
        ? '保存请求状态冲突，请确认明细后再操作。'
        : cause instanceof Error
          ? cause.message
          : '保存失败';
  } finally {
    submitting.value = false;
  }
}
function cancel() {
  void router.push({
    name: 'entries',
    query: { ledgerId: form.value.ledgerId, month: form.value.businessDate.slice(0, 7) },
  });
}
onMounted(initialize);
onBeforeUnmount(() => categoryController?.abort());
</script>
<template>
  <main class="entry-page">
    <AppPageHeader title="记一笔" back-label="取消" @back="cancel" />
    <section v-if="loading" class="loading" aria-live="polite">正在准备账本和分类…</section>
    <AppErrorState
      v-else-if="fatal"
      title="暂时无法记账"
      :message="fatal"
      retry-label="重试"
      @retry="initialize"
    /><template v-else
      ><p v-if="error" class="message error" role="alert">{{ error }}</p>
      <EntryEditorForm
        v-model="form"
        :ledgers="ledgers"
        :categories="categories"
        :categories-loading="categoriesLoading"
        :disabled="submitting"
        :submit-disabled="!canSubmit"
        @submit="submit"
        ><template #submit>{{ submitting ? '保存中…' : '保存账目' }}</template></EntryEditorForm
      ></template
    >
  </main>
</template>
<style scoped>
.entry-page {
  width: min(100%, 480px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 0 16px max(28px, env(safe-area-inset-bottom));
  overflow-x: clip;
  background: var(--siyu-page-bg);
  color: var(--siyu-text);
}
.loading {
  padding: 40px 20px;
  border: 1px solid var(--siyu-border);
  border-radius: 18px;
  background: var(--siyu-surface);
  text-align: center;
}
.message {
  padding: 12px;
  border-radius: 12px;
  overflow-wrap: anywhere;
}
.error {
  background: var(--siyu-danger-soft);
  color: var(--siyu-danger);
}
@media (max-width: 340px) {
  .entry-page {
    padding-inline: 12px;
  }
}
</style>
