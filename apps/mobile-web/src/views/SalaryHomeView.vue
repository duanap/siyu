<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { isRequestCancelled } from '../api';
import AppDrawer from '../components/AppDrawer.vue';
import AppEmpty from '../components/AppEmpty.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import SalaryAnnualChart from '../components/SalaryAnnualChart.vue';
import SalaryBalanceCard from '../components/SalaryBalanceCard.vue';
import SalaryItemEditor from '../components/SalaryItemEditor.vue';
import { currentBusinessDate } from '../entry';
import {
  createSalaryApi,
  DEFAULT_SALARY_TEMPLATE,
  editableSalaryItems,
  formatSalaryCent,
  salaryItemsInput,
  salaryMonthDate,
  salaryMonthLabel,
  type EditableSalaryItem,
  type SalaryAnnualSummary,
  type SalaryBalance,
  type SalaryProfile,
  type SalaryRecord,
} from '../salary';
import { useApiSession } from '../use-api-session';

const router = useRouter();
const api = createSalaryApi(useApiSession());
const today = currentBusinessDate();
const currentYear = Number(today.slice(0, 4));
const currentMonth = Number(today.slice(5, 7));
const profiles = ref<SalaryProfile[]>([]);
const selectedProfileId = ref('');
const records = ref<SalaryRecord[]>([]);
const summary = ref<SalaryAnnualSummary>();
const balance = ref<SalaryBalance>();
const loading = ref(true);
const fatal = ref('');
const message = ref('');
const profileDrawerOpen = ref(false);
const profileBusy = ref(false);
const profileName = ref('我的工资');
const employerName = ref('');
const payDay = ref(10);
const defaultSyncEntry = ref(true);
const profileItems = ref<EditableSalaryItem[]>(editableSalaryItems(DEFAULT_SALARY_TEMPLATE));
const profileError = ref('');
const profileKey = ref(`salary-profile-${crypto.randomUUID()}`);
let controller: AbortController | undefined;

const selectedProfile = computed(() =>
  profiles.value.find((profile) => profile.id === selectedProfileId.value),
);
const currentRecord = computed(() => {
  const target = salaryMonthDate(currentYear, currentMonth);
  return records.value.find(
    (record) => record.profileId === selectedProfileId.value && record.salaryMonth === target,
  );
});

function fillProfileForm(profile?: SalaryProfile) {
  profileName.value = profile?.name ?? '我的工资';
  employerName.value = profile?.employerName ?? '';
  payDay.value = profile?.payDay ?? 10;
  defaultSyncEntry.value = profile?.defaultSyncEntry ?? true;
  profileItems.value = editableSalaryItems(profile?.defaultItems ?? DEFAULT_SALARY_TEMPLATE);
  profileError.value = '';
}

function openProfile(profile?: SalaryProfile) {
  fillProfileForm(profile);
  profileDrawerOpen.value = true;
}

async function load() {
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  fatal.value = '';
  try {
    const loadedProfiles = await api.listProfiles(controller.signal);
    profiles.value = loadedProfiles;
    const requestedProfile = loadedProfiles.find(
      (profile) => profile.id === selectedProfileId.value,
    );
    selectedProfileId.value =
      requestedProfile?.id ??
      loadedProfiles.find((profile) => profile.status === 'ACTIVE')?.id ??
      '';
    const [loadedRecords, loadedSummary, loadedBalance] = await Promise.all([
      api.listAllRecords({ year: currentYear }, controller.signal),
      api.summary(currentYear, controller.signal),
      api.balance(controller.signal),
    ]);
    records.value = loadedRecords;
    summary.value = loadedSummary;
    balance.value = loadedBalance;
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '工资数据加载失败';
  } finally {
    loading.value = false;
  }
}

async function saveProfile() {
  if (profileBusy.value) return;
  const name = profileName.value.trim();
  const employer = employerName.value.trim();
  const items = salaryItemsInput(profileItems.value, true);
  if (!name || name.length > 100) {
    profileError.value = '档案名称应为 1 到 100 个字符';
    return;
  }
  if (employer.length > 100) {
    profileError.value = '单位名称不能超过 100 个字符';
    return;
  }
  if (!Number.isInteger(payDay.value) || payDay.value < 1 || payDay.value > 31) {
    profileError.value = '发薪日请输入 1 到 31';
    return;
  }
  if (!items.ok) {
    profileError.value = items.message;
    return;
  }
  const editing = Boolean(selectedProfile.value);
  profileBusy.value = true;
  profileError.value = '';
  try {
    const input = {
      name,
      employerName: employer || null,
      payDay: payDay.value,
      defaultSyncEntry: defaultSyncEntry.value,
      defaultItems: items.items,
    };
    const saved = selectedProfile.value
      ? await api.updateProfile(selectedProfile.value.id, input)
      : await api.createProfile({ ...input, idempotencyKey: profileKey.value });
    if (!selectedProfile.value) profileKey.value = `salary-profile-${crypto.randomUUID()}`;
    profiles.value = selectedProfile.value
      ? profiles.value.map((profile) => (profile.id === saved.id ? saved : profile))
      : [...profiles.value, saved];
    selectedProfileId.value = saved.id;
    profileDrawerOpen.value = false;
    message.value = editing ? '工资档案已更新。' : '工资档案已创建，可以录入本月工资了。';
    await load();
  } catch (cause) {
    profileError.value = cause instanceof Error ? cause.message : '工资档案保存失败';
  } finally {
    profileBusy.value = false;
  }
}

onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <main class="business-page salary-home">
    <AppPageHeader title="工资" back-label="账号" @back="router.push('/account')">
      <button
        v-if="selectedProfile?.canEdit"
        type="button"
        class="header-action"
        @click="openProfile(selectedProfile)"
      >
        设置
      </button>
    </AppPageHeader>
    <section v-if="loading" class="state-panel" aria-live="polite">正在加载工资档案和统计…</section>
    <AppErrorState
      v-else-if="fatal"
      title="工资加载失败"
      :message="fatal"
      retry-label="重试"
      @retry="load"
    />
    <template v-else>
      <p v-if="message" class="inline-success" role="status">{{ message }}</p>
      <AppEmpty
        v-if="!profiles.length"
        title="先建立工资档案"
        description="设置发薪日和常用工资项目，之后每月只需核对金额。工资、社保、医保、公积金和个税记录仅本人可见。"
      >
        <button type="button" class="primary-button" @click="openProfile()">建立工资档案</button>
      </AppEmpty>
      <template v-else>
        <label v-if="profiles.length > 1" class="profile-switcher">
          工资档案
          <select v-model="selectedProfileId">
            <option v-for="profile in profiles" :key="profile.id" :value="profile.id">
              {{ profile.name }}
            </option>
          </select>
        </label>
        <SalaryBalanceCard v-if="balance" :balance="balance" />
        <section class="surface-card current-card">
          <div class="section-heading">
            <div>
              <small>本月工资</small>
              <h2>{{ salaryMonthLabel(salaryMonthDate(currentYear, currentMonth)) }}</h2>
            </div>
            <span
              v-if="currentRecord"
              class="status-pill"
              :class="currentRecord.paymentStatus.toLowerCase()"
            >
              {{ currentRecord.paymentStatus === 'PAID' ? '已到账' : '待到账' }}
            </span>
          </div>
          <strong class="current-amount">{{
            currentRecord ? formatSalaryCent(currentRecord.netCent) : '尚未录入'
          }}</strong>
          <RouterLink
            class="primary-button block-action"
            :to="{
              name: 'salary-month',
              params: { year: String(currentYear), month: String(currentMonth).padStart(2, '0') },
            }"
          >
            {{ currentRecord ? '查看本月明细' : '录入本月工资' }}
          </RouterLink>
        </section>
        <section v-if="summary" class="surface-card annual-card">
          <div class="section-heading">
            <div>
              <small>{{ currentYear }} 年</small>
              <h2>年度工资统计</h2>
            </div>
            <RouterLink :to="{ name: 'salary-year', params: { year: String(currentYear) } }"
              >查看全年</RouterLink
            >
          </div>
          <div class="annual-grid">
            <div>
              <small>累计实发</small><strong>{{ formatSalaryCent(summary.netCent) }}</strong>
            </div>
            <div>
              <small>月均实发</small
              ><strong>{{ formatSalaryCent(summary.averageMonthlyNetCent) }}</strong>
            </div>
            <div>
              <small>累计应发</small><strong>{{ formatSalaryCent(summary.grossCent) }}</strong>
            </div>
            <div>
              <small>累计扣除</small><strong>{{ formatSalaryCent(summary.deductionCent) }}</strong>
            </div>
          </div>
          <SalaryAnnualChart v-if="summary.recordCount > 0" :items="summary.items" />
          <p v-else class="muted-copy">今年还没有工资记录，录入后才会显示趋势。</p>
        </section>
      </template>
    </template>

    <AppDrawer
      :open="profileDrawerOpen"
      :title="selectedProfile ? '编辑工资档案' : '建立工资档案'"
      :busy="profileBusy"
      @close="profileDrawerOpen = false"
    >
      <form class="field-stack profile-form" @submit.prevent="saveProfile">
        <label>档案名称<input v-model="profileName" maxlength="100" autocomplete="off" /></label>
        <label
          >单位名称（可选）<input
            v-model="employerName"
            maxlength="100"
            autocomplete="organization"
        /></label>
        <label
          >每月发薪日<input
            v-model.number="payDay"
            type="number"
            inputmode="numeric"
            min="1"
            max="31"
        /></label>
        <label class="check-row"
          ><input v-model="defaultSyncEntry" type="checkbox" />到账时默认同步为收入账目</label
        >
        <div>
          <p class="field-label">常用工资项目</p>
          <SalaryItemEditor
            :items="profileItems"
            allow-zero
            @update:items="profileItems = $event"
          />
        </div>
        <p class="muted-copy">模板金额可以为 0；录入月度工资时，每个保留项目都必须大于 0。</p>
        <p v-if="profileError" class="inline-error" role="alert">{{ profileError }}</p>
        <button class="primary-button" type="submit" :disabled="profileBusy">
          {{ profileBusy ? '正在保存…' : '保存工资档案' }}
        </button>
      </form>
    </AppDrawer>
  </main>
</template>

<style scoped>
.salary-home {
  display: grid;
  align-content: start;
  gap: 16px;
}
.header-action {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--siyu-primary);
}
.profile-switcher {
  display: grid;
  gap: 6px;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.profile-switcher select {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 10px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.section-heading h2 {
  margin: 4px 0 0;
  font-size: 18px;
}
.section-heading small,
.annual-grid small {
  color: var(--siyu-text-secondary);
}
.section-heading a {
  min-height: 44px;
  color: var(--siyu-primary);
  text-decoration: none;
}
.current-amount {
  display: block;
  margin: 22px 0;
  font-size: 28px;
  overflow-wrap: anywhere;
}
.status-pill {
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 12px;
}
.status-pill.paid {
  background: color-mix(in srgb, var(--siyu-income) 14%, transparent);
  color: var(--siyu-income);
}
.status-pill.unpaid {
  background: color-mix(in srgb, var(--siyu-primary) 12%, transparent);
  color: var(--siyu-primary);
}
.block-action {
  width: 100%;
  text-decoration: none;
}
.annual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 12px;
  margin: 22px 0;
}
.annual-grid div {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.annual-grid strong {
  overflow-wrap: anywhere;
}
.profile-form {
  padding-bottom: 18px;
}
.check-row {
  grid-template-columns: 44px 1fr;
  align-items: center;
}
.check-row input {
  width: 22px;
  min-height: 22px;
}
</style>
