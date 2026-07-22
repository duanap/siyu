<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { isRequestCancelled } from '../api';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import SalaryAnnualChart from '../components/SalaryAnnualChart.vue';
import {
  createSalaryApi,
  formatSalaryCent,
  parseSalaryRoute,
  type SalaryAnnualSummary,
} from '../salary';
import { useApiSession } from '../use-api-session';

const route = useRoute();
const router = useRouter();
const api = createSalaryApi(useApiSession());
const summary = ref<SalaryAnnualSummary>();
const loading = ref(true);
const fatal = ref('');
let controller: AbortController | undefined;

const routeValue = computed(() => parseSalaryRoute(route.params.year));
const year = computed(() => routeValue.value?.year ?? Number(new Date().getFullYear()));

async function load() {
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  fatal.value = '';
  if (!routeValue.value) {
    fatal.value = '统计年份无效，请返回工资首页重新选择。';
    loading.value = false;
    return;
  }
  try {
    summary.value = await api.summary(year.value, controller.signal);
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '年度工资统计加载失败';
  } finally {
    loading.value = false;
  }
}

function changeYear(value: string) {
  if (!/^\d{4}$/.test(value)) return;
  void router.push({ name: 'salary-year', params: { year: value } });
}

watch(() => route.params.year, load);
onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <main class="business-page salary-year">
    <AppPageHeader title="年度工资统计" back-label="工资" @back="router.push('/salary')" />
    <section v-if="loading" class="state-panel" aria-live="polite">正在加载年度工资统计…</section>
    <AppErrorState
      v-else-if="fatal"
      title="年度工资统计加载失败"
      :message="fatal"
      retry-label="重试"
      @retry="load"
    />
    <template v-else-if="summary">
      <label class="year-picker"
        >统计年份<input
          :value="String(year)"
          type="number"
          min="2000"
          max="9999"
          inputmode="numeric"
          @change="changeYear(($event.target as HTMLInputElement).value)"
      /></label>
      <section class="annual-hero">
        <small>{{ summary.year }} 年累计实发</small>
        <strong>{{ formatSalaryCent(summary.netCent) }}</strong>
        <p>
          已记录 {{ summary.recordedMonthCount }} 个月 · 月均
          {{ formatSalaryCent(summary.averageMonthlyNetCent) }}
        </p>
      </section>
      <section class="surface-card total-grid" aria-label="年度工资合计">
        <div>
          <small>累计应发</small><strong>{{ formatSalaryCent(summary.grossCent) }}</strong>
        </div>
        <div>
          <small>累计扣除</small><strong>{{ formatSalaryCent(summary.deductionCent) }}</strong>
        </div>
        <div>
          <small>奖金</small><strong>{{ formatSalaryCent(summary.bonusCent) }}</strong>
        </div>
        <div>
          <small>个人所得税</small><strong>{{ formatSalaryCent(summary.incomeTaxCent) }}</strong>
        </div>
      </section>
      <section class="surface-card chart-card">
        <div class="section-heading">
          <div>
            <small>每月实发</small>
            <h2>年度趋势</h2>
          </div>
          <span>12 个月</span>
        </div>
        <SalaryAnnualChart v-if="summary.recordCount > 0" :items="summary.items" />
        <div v-else class="compact-empty">
          <strong>这一年还没有工资记录</strong>
          <p>录入月度工资后，这里会显示服务端计算的 12 个月趋势。</p>
        </div>
      </section>
      <section class="surface-card special-card">
        <div class="section-heading">
          <div>
            <small>本人扣除</small>
            <h2>社保、公积金与个税</h2>
          </div>
        </div>
        <div class="special-list">
          <div>
            <span>养老保险</span
            ><strong>{{ formatSalaryCent(summary.pensionInsuranceCent) }}</strong>
          </div>
          <div>
            <span>医疗保险</span
            ><strong>{{ formatSalaryCent(summary.medicalInsuranceCent) }}</strong>
          </div>
          <div>
            <span>失业保险</span
            ><strong>{{ formatSalaryCent(summary.unemploymentInsuranceCent) }}</strong>
          </div>
          <div>
            <span>住房公积金</span
            ><strong>{{ formatSalaryCent(summary.housingProvidentFundCent) }}</strong>
          </div>
          <div>
            <span>个人所得税</span><strong>{{ formatSalaryCent(summary.incomeTaxCent) }}</strong>
          </div>
        </div>
        <p class="disclaimer">数据来自工资记录，不代表官方账户余额。</p>
      </section>
      <section class="surface-card month-list">
        <div class="section-heading">
          <div>
            <small>月度明细</small>
            <h2>按月查看</h2>
          </div>
        </div>
        <RouterLink
          v-for="item in summary.items"
          :key="item.month"
          :to="{
            name: 'salary-month',
            params: { year: String(summary.year), month: item.month.slice(-2) },
          }"
        >
          <span>{{ Number(item.month.slice(-2)) }} 月</span>
          <strong>{{
            item.grossCent || item.deductionCent ? formatSalaryCent(item.netCent) : '未记录'
          }}</strong>
        </RouterLink>
      </section>
    </template>
  </main>
</template>

<style scoped>
.salary-year {
  display: grid;
  align-content: start;
  gap: 16px;
}
.year-picker {
  display: grid;
  grid-template-columns: 1fr 120px;
  align-items: center;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.year-picker input {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 10px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.annual-hero {
  padding: 22px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--siyu-primary) 12%, var(--siyu-surface));
  border: 1px solid color-mix(in srgb, var(--siyu-primary) 28%, var(--siyu-border));
}
.annual-hero small,
.annual-hero p,
.total-grid small,
.section-heading small {
  color: var(--siyu-text-secondary);
}
.annual-hero strong {
  display: block;
  margin: 10px 0;
  font-size: 30px;
  overflow-wrap: anywhere;
}
.annual-hero p {
  margin: 0;
}
.total-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 12px;
}
.total-grid div {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.total-grid strong {
  overflow-wrap: anywhere;
}
.section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.section-heading h2 {
  margin: 4px 0 0;
  font-size: 18px;
}
.section-heading span {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.compact-empty {
  padding: 34px 12px;
  text-align: center;
}
.compact-empty p {
  color: var(--siyu-text-secondary);
  line-height: 1.6;
}
.special-list {
  display: grid;
}
.special-list div,
.month-list a {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--siyu-border);
}
.special-list div:last-child,
.month-list a:last-child {
  border-bottom: 0;
}
.special-list strong,
.month-list strong {
  overflow-wrap: anywhere;
  text-align: right;
}
.disclaimer {
  margin: 16px 0 0;
  padding: 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--siyu-primary) 8%, transparent);
  color: var(--siyu-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.month-list a {
  color: var(--siyu-text);
  text-decoration: none;
}
</style>
