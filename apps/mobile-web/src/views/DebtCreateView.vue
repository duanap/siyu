<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError } from '../api';
import { useAuthStore } from '../auth';
import AppPageHeader from '../components/AppPageHeader.vue';
import DebtEditorForm, { type DebtEditorModel } from '../components/DebtEditorForm.vue';
import { createDebtApi } from '../debt';
import { parseAmountToCent } from '../entry-money';
import { localBusinessDate } from '../ledger-context';
import { useApiSession } from '../use-api-session';

const router = useRouter();
const auth = useAuthStore();
const api = createDebtApi(useApiSession());
const submitting = ref(false);
const error = ref('');
const idempotencyKey = ref(`debt-${crypto.randomUUID()}`);
const form = ref<DebtEditorModel>({
  direction: 'BORROWED',
  counterpartyName: '',
  amount: '',
  startDate: localBusinessDate(auth.user?.timezone),
  dueDate: '',
  note: '',
  reminderEnabled: false,
});
const amount = computed(() => parseAmountToCent(form.value.amount));
const canSubmit = computed(
  () =>
    !submitting.value &&
    amount.value.ok &&
    Boolean(form.value.counterpartyName.trim() && form.value.startDate) &&
    (!form.value.dueDate || form.value.dueDate >= form.value.startDate),
);

async function submit() {
  if (!canSubmit.value || !amount.value.ok) return;
  submitting.value = true;
  error.value = '';
  try {
    const debt = await api.create({
      direction: form.value.direction,
      counterpartyName: form.value.counterpartyName.trim(),
      principalCent: amount.value.amountCent,
      startDate: form.value.startDate,
      dueDate: form.value.dueDate || null,
      note: form.value.note.trim() || null,
      reminderEnabled: form.value.reminderEnabled,
      idempotencyKey: idempotencyKey.value,
    });
    idempotencyKey.value = `debt-${crypto.randomUUID()}`;
    await router.replace({ name: 'debt-detail', params: { id: debt.id }, query: { created: '1' } });
  } catch (cause) {
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
</script>

<template>
  <main class="create-page">
    <AppPageHeader title="新增借贷" back-label="取消" @back="router.push('/debts')" />
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <DebtEditorForm
      v-model="form"
      :disabled="submitting"
      :submit-disabled="!canSubmit"
      @submit="submit"
      ><template #submit>{{ submitting ? '保存中…' : '保存借贷' }}</template></DebtEditorForm
    >
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
.error {
  padding: 12px;
  border-radius: 12px;
  background: var(--siyu-danger-soft);
  color: var(--siyu-danger);
  overflow-wrap: anywhere;
}
@media (max-width: 340px) {
  .create-page {
    padding-inline: 12px;
  }
}
</style>
