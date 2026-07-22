<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError, isRequestCancelled } from '../api';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import SavingGoalForm, { type SavingGoalFormModel } from '../components/SavingGoalForm.vue';
import type { Ledger } from '../entry';
import { listLedgers } from '../entry-resources';
import { persistLedgerId, resolveLedger } from '../ledger-context';
import { createSavingGoalsApi, parseSavingAmount } from '../saving-goals';
import { useApiSession } from '../use-api-session';

const route = useRoute();
const router = useRouter();
const session = useApiSession();
const api = createSavingGoalsApi(session);
const ledgers = ref<Ledger[]>([]);
const loading = ref(true);
const fatal = ref('');
const formError = ref('');
const busy = ref(false);
const idempotencyKey = ref(`saving-goal-${crypto.randomUUID()}`);
const form = ref<SavingGoalFormModel>({
  ledgerId: '',
  name: '',
  targetAmount: '',
  initialAmount: '0',
  targetDate: '',
  coverUrl: '',
  note: '',
});
let controller: AbortController | undefined;

async function initialize() {
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  fatal.value = '';
  try {
    ledgers.value = await listLedgers(session, controller.signal);
    const requested = typeof route.query.ledgerId === 'string' ? route.query.ledgerId : '';
    const resolved = resolveLedger(ledgers.value, requested);
    if (!resolved.ledger) throw new Error('没有可用账本');
    form.value.ledgerId = resolved.ledger.id;
    persistLedgerId(resolved.ledger.id);
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '目标创建页加载失败';
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (busy.value) return;
  formError.value = '';
  const name = form.value.name.trim();
  if (!name) {
    formError.value = '请输入目标名称';
    return;
  }
  const target = parseSavingAmount(form.value.targetAmount);
  if (!target.ok) {
    formError.value = `目标金额：${target.message}`;
    return;
  }
  const initial = parseSavingAmount(form.value.initialAmount || '0', true);
  if (!initial.ok) {
    formError.value = `初始金额：${initial.message}`;
    return;
  }
  if (!form.value.ledgerId) {
    formError.value = '请选择所属账本';
    return;
  }
  busy.value = true;
  try {
    const goal = await api.create({
      ledgerId: form.value.ledgerId,
      name,
      targetCent: target.amountCent,
      initialCent: initial.amountCent,
      targetDate: form.value.targetDate || null,
      coverUrl: form.value.coverUrl.trim() || null,
      note: form.value.note.trim() || null,
      idempotencyKey: idempotencyKey.value,
    });
    idempotencyKey.value = `saving-goal-${crypto.randomUUID()}`;
    persistLedgerId(goal.ledgerId);
    await router.replace({
      name: 'saving-goal-detail',
      params: { id: goal.id },
      query: { ledgerId: goal.ledgerId, created: '1' },
    });
  } catch (cause) {
    formError.value =
      cause instanceof ApiError && cause.code === 'IDEMPOTENCY_CONFLICT'
        ? '创建请求状态冲突，请返回列表核对目标是否已创建。'
        : cause instanceof Error
          ? cause.message
          : '目标创建失败';
  } finally {
    busy.value = false;
  }
}

onMounted(initialize);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <main class="business-page saving-create-page">
    <AppPageHeader title="新建攒钱目标" back-label="取消" @back="router.push('/saving-goals')" />
    <section v-if="loading" class="state-panel" aria-live="polite">正在准备目标表单…</section>
    <AppErrorState
      v-else-if="fatal"
      title="创建页加载失败"
      :message="fatal"
      retry-label="重试"
      @retry="initialize"
    />
    <template v-else>
      <section class="create-intro">
        <strong>把想实现的事，拆成每天看得见的积累。</strong>
        <p>目标金额和初始金额都按整数分保存，创建后进度由服务端统一计算。</p>
      </section>
      <SavingGoalForm v-model="form" :ledgers="ledgers" :busy="busy" @submit="submit" />
      <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
    </template>
  </main>
</template>

<style scoped>
.saving-create-page {
  display: grid;
  align-content: start;
  gap: 18px;
}
.create-intro {
  padding: 16px;
  border-radius: 14px;
  background: var(--siyu-primary-soft);
  line-height: 1.6;
}
.create-intro p {
  margin: 6px 0 0;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
</style>
