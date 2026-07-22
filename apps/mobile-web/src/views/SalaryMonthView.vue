<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError, isRequestCancelled } from '../api';
import AppDialog from '../components/AppDialog.vue';
import AppEmpty from '../components/AppEmpty.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import SalaryItemEditor from '../components/SalaryItemEditor.vue';
import { currentBusinessDate } from '../entry';
import {
  createSalaryApi,
  editableSalaryItems,
  formatSalaryCent,
  parseSalaryRoute,
  salaryItemsInput,
  salaryMonthDate,
  salaryMonthLabel,
  type EditableSalaryItem,
  type SalaryProfile,
  type SalaryRecord,
  type SalaryRecordItemInput,
} from '../salary';
import { useApiSession } from '../use-api-session';

const route = useRoute();
const router = useRouter();
const api = createSalaryApi(useApiSession());
const profiles = ref<SalaryProfile[]>([]);
const profileId = ref('');
const record = ref<SalaryRecord>();
const items = ref<EditableSalaryItem[]>([]);
const loading = ref(true);
const fatal = ref('');
const message = ref('');
const formError = ref('');
const busy = ref(false);
const copyPreviousMonth = ref(false);
const paidDialogOpen = ref(false);
const paidDate = ref(currentBusinessDate());
const syncEntry = ref(true);
const recordKey = ref(`salary-record-${crypto.randomUUID()}`);
const paymentKey = ref(`salary-paid-${crypto.randomUUID()}`);
let controller: AbortController | undefined;

const routeValue = computed(() => parseSalaryRoute(route.params.year, route.params.month));
const salaryMonth = computed(() => {
  const value = routeValue.value;
  return value?.month ? salaryMonthDate(value.year, value.month) : '';
});
const profile = computed(() => profiles.value.find((item) => item.id === profileId.value));
const parsedItems = computed(() => salaryItemsInput(items.value, false));
const preview = computed(() => {
  if (!parsedItems.value.ok) return null;
  let grossCent = 0;
  let deductionCent = 0;
  for (const item of parsedItems.value.items) {
    if (item.itemType === 'EARNING') grossCent += item.amountCent;
    else deductionCent += item.amountCent;
  }
  return { grossCent, deductionCent, netCent: grossCent - deductionCent };
});

function resetItems() {
  items.value = editableSalaryItems(record.value?.items ?? profile.value?.defaultItems ?? []);
  syncEntry.value = profile.value?.defaultSyncEntry ?? true;
}

async function load() {
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  fatal.value = '';
  message.value = '';
  const parsed = routeValue.value;
  if (!parsed?.month) {
    fatal.value = '工资月份无效，请返回工资首页重新选择。';
    loading.value = false;
    return;
  }
  try {
    const loadedProfiles = await api.listProfiles(controller.signal);
    profiles.value = loadedProfiles;
    const requested = typeof route.query.profileId === 'string' ? route.query.profileId : '';
    profileId.value =
      loadedProfiles.find((item) => item.id === requested)?.id ??
      loadedProfiles.find((item) => item.status === 'ACTIVE')?.id ??
      '';
    const loadedRecords = await api.listAllRecords(
      { year: parsed.year, ...(profileId.value ? { profileId: profileId.value } : {}) },
      controller.signal,
    );
    record.value = loadedRecords.find((item) => item.salaryMonth === salaryMonth.value);
    resetItems();
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '月度工资加载失败';
  } finally {
    loading.value = false;
  }
}

async function saveRecord() {
  if (busy.value || !profile.value || record.value?.paymentStatus === 'PAID') return;
  formError.value = '';
  if (!copyPreviousMonth.value && !parsedItems.value.ok) {
    formError.value = parsedItems.value.message;
    return;
  }
  busy.value = true;
  try {
    if (record.value) {
      if (!parsedItems.value.ok) return;
      record.value = await api.updateRecord(record.value.id, {
        items: parsedItems.value.items as SalaryRecordItemInput[],
      });
      message.value = '月度工资已更新。';
    } else if (copyPreviousMonth.value) {
      record.value = await api.createRecord({
        profileId: profile.value.id,
        salaryMonth: salaryMonth.value,
        copyPreviousMonth: true,
        idempotencyKey: recordKey.value,
      });
      recordKey.value = `salary-record-${crypto.randomUUID()}`;
      message.value = '已复制上月项目并创建本月工资。';
    } else if (parsedItems.value.ok) {
      record.value = await api.createRecord({
        profileId: profile.value.id,
        salaryMonth: salaryMonth.value,
        items: parsedItems.value.items as SalaryRecordItemInput[],
        copyPreviousMonth: false,
        idempotencyKey: recordKey.value,
      });
      recordKey.value = `salary-record-${crypto.randomUUID()}`;
      message.value = '本月工资已创建。';
    }
    copyPreviousMonth.value = false;
    resetItems();
  } catch (cause) {
    formError.value =
      cause instanceof ApiError && cause.code === 'IDEMPOTENCY_CONFLICT'
        ? '请求状态冲突，请刷新后核对工资记录。'
        : cause instanceof Error
          ? cause.message
          : '月度工资保存失败';
  } finally {
    busy.value = false;
  }
}

function openPaidDialog() {
  if (!record.value?.canEdit || record.value.paymentStatus === 'PAID') return;
  paidDate.value = currentBusinessDate();
  syncEntry.value = profile.value?.defaultSyncEntry ?? true;
  formError.value = '';
  paidDialogOpen.value = true;
}

async function markPaid() {
  if (!record.value || busy.value || record.value.paymentStatus === 'PAID') return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate.value)) {
    formError.value = '请选择有效的到账日期';
    return;
  }
  busy.value = true;
  formError.value = '';
  try {
    record.value = await api.markPaid(record.value.id, {
      paidDate: paidDate.value,
      syncEntry: syncEntry.value,
      idempotencyKey: paymentKey.value,
    });
    paymentKey.value = `salary-paid-${crypto.randomUUID()}`;
    paidDialogOpen.value = false;
    message.value = syncEntry.value ? '工资已确认到账，并同步为收入账目。' : '工资已确认到账。';
    resetItems();
  } catch (cause) {
    formError.value =
      cause instanceof ApiError && cause.code === 'IDEMPOTENCY_CONFLICT'
        ? '到账请求状态冲突，请刷新后核对工资状态。'
        : cause instanceof Error
          ? cause.message
          : '确认到账失败';
  } finally {
    busy.value = false;
  }
}

watch(() => [route.params.year, route.params.month, route.query.profileId], load);
onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <main class="business-page salary-month">
    <AppPageHeader
      :title="salaryMonth ? salaryMonthLabel(salaryMonth) : '月度工资'"
      back-label="工资"
      @back="router.push('/salary')"
    />
    <section v-if="loading" class="state-panel" aria-live="polite">正在加载月度工资…</section>
    <AppErrorState
      v-else-if="fatal"
      title="月度工资加载失败"
      :message="fatal"
      retry-label="重试"
      @retry="load"
    />
    <AppEmpty
      v-else-if="!profiles.length"
      title="还没有工资档案"
      description="先设置发薪日和常用项目，再录入月度工资。"
    >
      <RouterLink class="primary-button" to="/salary">去建立工资档案</RouterLink>
    </AppEmpty>
    <template v-else>
      <p v-if="message" class="inline-success" role="status">{{ message }}</p>
      <section v-if="record" class="net-card">
        <small>{{
          record.paymentStatus === 'PAID' ? '实发工资 · 已到账' : '实发工资 · 待到账'
        }}</small>
        <strong>{{ formatSalaryCent(record.netCent) }}</strong>
        <p>
          应发 {{ formatSalaryCent(record.grossCent) }} · 扣除
          {{ formatSalaryCent(record.deductionCent) }}
        </p>
        <p v-if="record.paidDate">到账日期 {{ record.paidDate }}</p>
      </section>
      <section v-if="!record" class="surface-card copy-card">
        <label
          ><input v-model="copyPreviousMonth" type="checkbox" />直接复制上月工资项目和金额</label
        >
        <p class="muted-copy">
          复制模式由服务端读取最近一个月记录；若没有上月记录，请关闭后手动录入。
        </p>
      </section>
      <section class="surface-card item-section">
        <div class="section-heading">
          <div>
            <small>工资组成</small>
            <h2>
              {{
                record?.paymentStatus === 'PAID'
                  ? '到账明细'
                  : record
                    ? '修改本月项目'
                    : '录入本月项目'
              }}
            </h2>
          </div>
          <span>{{ items.length }} 项</span>
        </div>
        <SalaryItemEditor
          v-if="!copyPreviousMonth"
          :items="items"
          :disabled="record?.paymentStatus === 'PAID' || (!record?.canEdit && Boolean(record))"
          @update:items="items = $event"
        />
        <p v-if="!copyPreviousMonth" class="muted-copy">
          金额为 0 的项目不会保存到本月记录；所有已保存项目均为正整数分。
        </p>
      </section>
      <section
        v-if="!copyPreviousMonth && preview && record?.paymentStatus !== 'PAID'"
        class="surface-card preview-card"
      >
        <div>
          <small>应发</small><strong>{{ formatSalaryCent(preview.grossCent) }}</strong>
        </div>
        <div>
          <small>扣除</small><strong>{{ formatSalaryCent(preview.deductionCent) }}</strong>
        </div>
        <div>
          <small>实发</small><strong>{{ formatSalaryCent(preview.netCent) }}</strong>
        </div>
      </section>
      <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
      <div
        v-if="record?.paymentStatus !== 'PAID' && (!record || record.canEdit)"
        class="form-actions"
      >
        <button type="button" class="primary-button" :disabled="busy" @click="saveRecord">
          {{ busy ? '正在保存…' : record ? '保存修改' : '创建本月工资' }}
        </button>
        <button
          v-if="record"
          type="button"
          class="secondary-button"
          :disabled="busy"
          @click="openPaidDialog"
        >
          确认工资到账
        </button>
      </div>
      <p v-else-if="record?.paymentStatus === 'PAID'" class="read-only-copy">
        工资到账事实不可修改；如同步了收入账目，该来源事实也保持不可变。
      </p>
      <AppEmpty
        v-else-if="record && !record.canEdit"
        title="只能查看这条工资记录"
        description="当前账号没有修改权限，工资隐私与归属由服务端校验。"
      />
    </template>

    <AppDialog
      :open="paidDialogOpen"
      title="确认工资到账"
      confirm-text="确认到账"
      :busy="busy"
      @confirm="markPaid"
      @cancel="paidDialogOpen = false"
    >
      <div class="field-stack paid-form">
        <p>确认后工资记录将变为只读，到账事实不可撤销。</p>
        <label>到账日期<input v-model="paidDate" type="date" /></label>
        <label class="check-row"
          ><input v-model="syncEntry" type="checkbox" />同步生成个人账本收入</label
        >
        <p v-if="formError" class="inline-error" role="alert">{{ formError }}</p>
      </div>
    </AppDialog>
  </main>
</template>

<style scoped>
.salary-month {
  display: grid;
  align-content: start;
  gap: 16px;
}
.net-card {
  padding: 20px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--siyu-income) 12%, var(--siyu-surface));
  border: 1px solid color-mix(in srgb, var(--siyu-income) 30%, var(--siyu-border));
}
.net-card small,
.net-card p,
.section-heading small {
  color: var(--siyu-text-secondary);
}
.net-card strong {
  display: block;
  margin: 10px 0;
  font-size: 30px;
  overflow-wrap: anywhere;
}
.net-card p {
  margin: 5px 0 0;
}
.copy-card label,
.check-row {
  display: grid;
  grid-template-columns: 44px 1fr;
  align-items: center;
}
.copy-card input,
.check-row input {
  width: 22px;
  min-height: 22px;
}
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.section-heading h2 {
  margin: 4px 0 0;
  font-size: 18px;
}
.section-heading span {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.preview-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.preview-card div {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.preview-card small {
  color: var(--siyu-text-secondary);
}
.preview-card strong {
  font-size: 14px;
  overflow-wrap: anywhere;
}
.read-only-copy {
  padding: 14px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--siyu-primary) 8%, transparent);
  color: var(--siyu-text-secondary);
  line-height: 1.7;
}
.paid-form p {
  margin: 0;
}
</style>
