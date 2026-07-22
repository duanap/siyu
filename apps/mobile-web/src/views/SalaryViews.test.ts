import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/SalaryAnnualChart.vue', () => ({
  default: { template: '<div class="mock-salary-chart">chart</div>' },
}));
vi.mock('../components/AppDrawer.vue', () => ({
  default: {
    template: '<section v-if="open" class="mock-drawer"><slot /></section>',
    props: ['open'],
  },
}));
vi.mock('../components/AppDialog.vue', () => ({
  default: {
    template:
      '<section v-if="open" class="mock-dialog"><slot /><button class="dialog-confirm" @click="$emit(\'confirm\')">confirm</button></section>',
    props: ['open'],
  },
}));

import { useAuthStore } from '../auth';
import type { SalaryAnnualSummary, SalaryBalance, SalaryProfile, SalaryRecord } from '../salary';
import SalaryHomeView from './SalaryHomeView.vue';
import SalaryMonthView from './SalaryMonthView.vue';
import SalaryYearView from './SalaryYearView.vue';

const userId = '11111111-1111-4111-8111-111111111111';
const profile: SalaryProfile = {
  id: '22222222-2222-4222-8222-222222222222',
  name: '我的工资',
  employerName: '很长的测试单位名称用于验证移动端文字换行',
  payDay: 10,
  defaultSyncEntry: true,
  status: 'ACTIVE',
  defaultItems: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      itemType: 'EARNING',
      itemCode: 'base_salary',
      itemName: '基本工资',
      amountCent: 500_000,
      sortOrder: 0,
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      itemType: 'DEDUCTION',
      itemCode: 'income_tax',
      itemName: '个人所得税',
      amountCent: 10_000,
      sortOrder: 1,
    },
  ],
  canEdit: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const record: SalaryRecord = {
  id: '55555555-5555-4555-8555-555555555555',
  profileId: profile.id,
  profile: { id: profile.id, name: profile.name, employerName: profile.employerName, payDay: 10 },
  salaryMonth: '2026-07-01',
  grossCent: 500_000,
  deductionCent: 10_000,
  netCent: 490_000,
  paymentStatus: 'UNPAID',
  paidDate: null,
  entryId: null,
  items: profile.defaultItems.map((item) => ({ ...item })),
  canEdit: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const months = Array.from({ length: 12 }, (_, index) => ({
  month: `2026-${String(index + 1).padStart(2, '0')}`,
  grossCent: index === 6 ? 500_000 : 0,
  deductionCent: index === 6 ? 10_000 : 0,
  netCent: index === 6 ? 490_000 : 0,
  bonusCent: 0,
  pensionInsuranceCent: 0,
  medicalInsuranceCent: 0,
  unemploymentInsuranceCent: 0,
  housingProvidentFundCent: 0,
  incomeTaxCent: index === 6 ? 10_000 : 0,
}));

const summary: SalaryAnnualSummary = {
  year: 2026,
  recordCount: 1,
  recordedMonthCount: 1,
  grossCent: 500_000,
  deductionCent: 10_000,
  netCent: 490_000,
  averageMonthlyNetCent: 490_000,
  bonusCent: 0,
  pensionInsuranceCent: 0,
  medicalInsuranceCent: 0,
  unemploymentInsuranceCent: 0,
  housingProvidentFundCent: 0,
  incomeTaxCent: 10_000,
  items: months,
  officialBalanceDisclaimer: true,
};

const balance: SalaryBalance = {
  available: true,
  asOfDate: '2026-07-22',
  salaryRecordId: record.id,
  profileId: profile.id,
  salaryMonth: record.salaryMonth,
  paidDate: '2026-07-10',
  nextExpectedPayDate: '2026-08-10',
  periodStartDate: '2026-07-10',
  periodEndDate: '2026-08-09',
  netSalaryCent: 490_000,
  fixedExpenseCent: 100_000,
  dailyExpenseCent: 20_000,
  totalExpenseCent: 120_000,
  remainingCent: 370_000,
  remainingDays: 19,
  dailyAvailableCent: 19_473,
};

function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'request-1' }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function list(items: unknown[]) {
  return { items, page: 1, pageSize: 100, total: items.length, hasNext: false };
}

function prepareAuth() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const auth = useAuthStore();
  auth.accessToken = 'token';
  auth.user = {
    id: userId,
    nickname: '测试用户',
    email: 'user@example.com',
    avatarUrl: null,
    timezone: 'Asia/Shanghai',
    status: 'ACTIVE',
    roles: ['USER'],
    permissions: [],
  };
  return pinia;
}

function salaryRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/salary', name: 'salary', component: SalaryHomeView },
      { path: '/salary/year/:year', name: 'salary-year', component: SalaryYearView },
      { path: '/salary/:year/:month', name: 'salary-month', component: SalaryMonthView },
      { path: '/account', name: 'account', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  });
}

function salaryFetch(
  options: {
    profiles?: SalaryProfile[];
    records?: SalaryRecord[];
    summary?: SalaryAnnualSummary;
  } = {},
) {
  return vi.fn((url: string) => {
    if (url.endsWith('/salary/profiles'))
      return Promise.resolve(ok({ items: options.profiles ?? [profile] }));
    if (url.includes('/salary/records?'))
      return Promise.resolve(ok(list(options.records ?? [record])));
    if (url.includes('/salary/summary/')) return Promise.resolve(ok(options.summary ?? summary));
    if (url.endsWith('/salary/balance')) return Promise.resolve(ok(balance));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

describe('salary views', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the home balance, current month, server totals and trend', async () => {
    vi.stubGlobal('fetch', salaryFetch());
    const pinia = prepareAuth();
    const router = salaryRouter();
    await router.push('/salary');
    await router.isReady();
    const wrapper = mount(SalaryHomeView, { global: { plugins: [pinia, router] } });
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('工资还剩多少');
    expect(wrapper.text()).toContain('¥ 3,700.00');
    expect(wrapper.text()).toContain('年度工资统计');
    expect(wrapper.find('.mock-salary-chart').exists()).toBe(true);
  });

  it('shows a setup state without inventing salary data', async () => {
    vi.stubGlobal('fetch', salaryFetch({ profiles: [], records: [] }));
    const pinia = prepareAuth();
    const router = salaryRouter();
    await router.push('/salary');
    await router.isReady();
    const wrapper = mount(SalaryHomeView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    expect(wrapper.text()).toContain('先建立工资档案');
    expect(wrapper.text()).not.toContain('¥ 4,900.00');
  });

  it('creates a monthly record only once on rapid repeated clicks', async () => {
    const bodies: string[] = [];
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/salary/profiles')) return Promise.resolve(ok({ items: [profile] }));
      if (url.includes('/salary/records?')) return Promise.resolve(ok(list([])));
      if (url.endsWith('/salary/records')) {
        bodies.push(String(init?.body));
        return Promise.resolve(ok(record, 201));
      }
      return Promise.reject(new Error(`unexpected ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    const pinia = prepareAuth();
    const router = salaryRouter();
    await router.push('/salary/2026/07');
    await router.isReady();
    const wrapper = mount(SalaryMonthView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    const button = wrapper.get('.form-actions .primary-button');
    await Promise.all([button.trigger('click'), button.trigger('click')]);
    await flushPromises();

    expect(bodies).toHaveLength(1);
    const body = JSON.parse(bodies[0]!);
    expect(body.idempotencyKey).toMatch(/^salary-record-/);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemCode: 'base_salary', amountCent: 500_000 }),
      ]),
    );
  });

  it('confirms arrival once and renders the paid record as read-only', async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith('/salary/profiles')) return Promise.resolve(ok({ items: [profile] }));
        if (url.includes('/salary/records?')) return Promise.resolve(ok(list([record])));
        if (url.endsWith('/mark-paid')) {
          bodies.push(String(init?.body));
          return Promise.resolve(
            ok({ ...record, paymentStatus: 'PAID', paidDate: '2026-07-22', canEdit: false }),
          );
        }
        return Promise.reject(new Error(`unexpected ${url}`));
      }),
    );
    const pinia = prepareAuth();
    const router = salaryRouter();
    await router.push('/salary/2026/07');
    await router.isReady();
    const wrapper = mount(SalaryMonthView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    await wrapper.get('.form-actions .secondary-button').trigger('click');
    const confirm = wrapper.get('.dialog-confirm');
    await Promise.all([confirm.trigger('click'), confirm.trigger('click')]);
    await flushPromises();

    expect(bodies).toHaveLength(1);
    expect(JSON.parse(bodies[0]!).idempotencyKey).toMatch(/^salary-paid-/);
    expect(wrapper.text()).toContain('工资到账事实不可修改');
    expect(wrapper.find('.form-actions').exists()).toBe(false);
  });

  it('shows all twelve server months and the mandatory non-official disclaimer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('/salary/summary/')
          ? Promise.resolve(ok(summary))
          : Promise.reject(new Error(`unexpected ${url}`)),
      ),
    );
    const pinia = prepareAuth();
    const router = salaryRouter();
    await router.push('/salary/year/2026');
    await router.isReady();
    const wrapper = mount(SalaryYearView, { global: { plugins: [pinia, router] } });
    await flushPromises();

    expect(wrapper.findAll('.month-list a')).toHaveLength(12);
    expect(wrapper.text()).toContain('数据来自工资记录，不代表官方账户余额');
    expect(wrapper.find('.mock-salary-chart').exists()).toBe(true);
  });
});
