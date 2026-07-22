<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError, isRequestCancelled } from '../api';
import { useAuthStore } from '../auth';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import RecurringRuleForm, {
  type RecurringRuleFormModel,
} from '../components/RecurringRuleForm.vue';
import type { Ledger } from '../entry';
import { parseAmountToCent } from '../entry-money';
import { listCategories, listLedgers, type Category } from '../entry-resources';
import { localBusinessDate, persistLedgerId, resolveLedger } from '../ledger-context';
import { createRecurringApi } from '../recurring';
import { useApiSession } from '../use-api-session';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const session = useApiSession();
const api = createRecurringApi(session);
const ledgers = ref<Ledger[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const categoriesLoading = ref(false);
const submitting = ref(false);
const fatal = ref('');
const error = ref('');
const idempotencyKey = ref(`recurring-rule-${crypto.randomUUID()}`);
let initialized = false;
let categoryController: AbortController | undefined;
const form = ref<RecurringRuleFormModel>({
  ledgerId: '',
  name: '',
  entryType: 'EXPENSE',
  amount: '',
  categoryId: '',
  frequency: 'MONTHLY',
  intervalValue: 1,
  startDate: localBusinessDate(auth.user?.timezone),
  generationMode: 'AUTO',
  endMode: 'NONE',
  endDate: '',
  totalOccurrences: 12,
  reminderDaysBefore: 1,
});
const amount = computed(() => parseAmountToCent(form.value.amount));
const scheduleValid = computed(
  () =>
    Number.isInteger(form.value.intervalValue) &&
    form.value.intervalValue >= 1 &&
    form.value.intervalValue <= 1200 &&
    Number.isInteger(form.value.reminderDaysBefore) &&
    form.value.reminderDaysBefore >= 0 &&
    form.value.reminderDaysBefore <= 365 &&
    (form.value.endMode !== 'DATE' ||
      Boolean(form.value.endDate && form.value.endDate >= form.value.startDate)) &&
    (form.value.endMode !== 'COUNT' ||
      (Number.isInteger(form.value.totalOccurrences) && form.value.totalOccurrences >= 1)),
);
const canSubmit = computed(
  () =>
    !submitting.value &&
    amount.value.ok &&
    scheduleValid.value &&
    Boolean(
      form.value.ledgerId &&
      form.value.name.trim() &&
      form.value.categoryId &&
      form.value.startDate,
    ),
);

async function syncQuery() {
  await router.replace({ name: 'recurring-new', query: { ledgerId: form.value.ledgerId } });
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
      form.value.entryType,
      false,
      categoryController.signal,
    );
    categories.value = result.items.filter((category) => category.isEnabled);
    if (!categories.value.some((category) => category.id === form.value.categoryId))
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
    initialized = true;
    await syncQuery();
    await loadCategoriesForForm();
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '创建页面加载失败';
  } finally {
    loading.value = false;
  }
}

watch(
  () => [form.value.ledgerId, form.value.entryType] as const,
  async ([ledgerId, entryType], [previousLedger, previousType]) => {
    if (!initialized || (ledgerId === previousLedger && entryType === previousType)) return;
    persistLedgerId(ledgerId);
    await syncQuery();
    await loadCategoriesForForm();
  },
);

async function submit() {
  if (!canSubmit.value || !amount.value.ok) return;
  submitting.value = true;
  error.value = '';
  try {
    const rule = await api.createRule({
      ledgerId: form.value.ledgerId,
      name: form.value.name.trim(),
      entryType: form.value.entryType,
      amountCent: amount.value.amountCent,
      categoryId: form.value.categoryId,
      frequency: form.value.frequency,
      intervalValue: form.value.intervalValue,
      startDate: form.value.startDate,
      endDate: form.value.endMode === 'DATE' ? form.value.endDate : null,
      totalOccurrences: form.value.endMode === 'COUNT' ? form.value.totalOccurrences : null,
      generationMode: form.value.generationMode,
      reminderDaysBefore: form.value.reminderDaysBefore,
      idempotencyKey: idempotencyKey.value,
    });
    idempotencyKey.value = `recurring-rule-${crypto.randomUUID()}`;
    await router.replace({
      name: 'recurring-detail',
      params: { id: rule.id },
      query: { created: '1' },
    });
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 'RECURRING_CATEGORY_INVALID')
      await loadCategoriesForForm();
    error.value =
      cause instanceof ApiError && cause.code === 'IDEMPOTENCY_CONFLICT'
        ? '保存请求状态冲突，请返回列表确认后再操作。'
        : cause instanceof Error
          ? cause.message
          : '保存失败';
  } finally {
    submitting.value = false;
  }
}

function cancel() {
  void router.push({ name: 'recurring', query: { ledgerId: form.value.ledgerId } });
}

onMounted(initialize);
onBeforeUnmount(() => categoryController?.abort());
</script>

<template>
  <main class="create-page">
    <AppPageHeader title="创建周期账目" back-label="取消" @back="cancel" />
    <section v-if="loading" class="loading" aria-live="polite">正在准备账本和分类…</section>
    <AppErrorState
      v-else-if="fatal"
      title="暂时无法创建周期规则"
      :message="fatal"
      retry-label="重试"
      @retry="initialize"
    />
    <template v-else>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <RecurringRuleForm
        v-model="form"
        :ledgers="ledgers"
        :categories="categories"
        :categories-loading="categoriesLoading"
        :disabled="submitting"
        :submit-disabled="!canSubmit"
        @submit="submit"
        ><template #submit>{{ submitting ? '保存中…' : '保存规则' }}</template></RecurringRuleForm
      >
    </template>
  </main>
</template>

<style scoped>
.create-page {
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
.error {
  padding: 12px;
  border-radius: 12px;
  background: var(--siyu-danger-soft);
  color: var(--siyu-danger);
  overflow-wrap: anywhere;
}
@media (max-width: 340px) {
  .create-page {
    padding-inline: 10px;
  }
}
</style>
