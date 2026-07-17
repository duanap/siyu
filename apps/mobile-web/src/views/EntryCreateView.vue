<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '../api';
import { useAuthStore } from '../auth';
import { categoryApi, categoryGlyph, type Category, type CategoryType } from '../category';
import AppBottomNav from '../components/AppBottomNav.vue';
import LedgerSwitcher from '../components/LedgerSwitcher.vue';
import { coupleLedgerApi, type Ledger } from '../couple-ledger';
import {
  amountTextToCent,
  currentBusinessDate,
  entryApi,
  newEntryIdempotencyKey,
  PAYMENT_METHODS,
  type EntryPaymentMethod,
} from '../entry';
import { persistLedgerId, resolveLedgerId } from '../ledger-selection';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const ledgers = ref<Ledger[]>([]);
const categories = ref<Category[]>([]);
const selectedLedgerId = ref('');
const loading = ref(true);
const categoriesLoading = ref(false);
const submitting = ref(false);
const noAccess = ref(false);
const error = ref('');
const ready = ref(false);
let idempotencyKey = newEntryIdempotencyKey();

const form = reactive({
  type: (route.query.type === 'INCOME' ? 'INCOME' : 'EXPENSE') as CategoryType,
  amount: '',
  categoryId: '',
  businessDate: currentBusinessDate(auth.user?.timezone),
  note: '',
  paymentMethod: '' as EntryPaymentMethod | '',
});

const selectedLedger = computed(() =>
  ledgers.value.find((ledger) => ledger.id === selectedLedgerId.value),
);

function explainFailure(caught: unknown): string {
  if (caught instanceof ApiError) {
    if (caught.code === 'CATEGORY_DISABLED') return '所选分类已停用，请重新选择';
    if (caught.code === 'IDEMPOTENCY_CONFLICT') return '本次保存状态不明确，请返回明细确认后再试';
    return caught.message;
  }
  return '请求失败，请检查网络后重试';
}

async function loadCategories(): Promise<void> {
  if (!selectedLedgerId.value) return;
  categoriesLoading.value = true;
  error.value = '';
  try {
    const result = await categoryApi.list(
      selectedLedgerId.value,
      form.type,
      false,
      auth.accessToken,
    );
    categories.value = result.items.filter((category) => category.isEnabled);
    if (!categories.value.some((category) => category.id === form.categoryId)) {
      form.categoryId = categories.value[0]?.id ?? '';
    }
  } catch (caught) {
    categories.value = [];
    if (caught instanceof ApiError && [403, 404].includes(caught.status)) noAccess.value = true;
    error.value = explainFailure(caught);
  } finally {
    categoriesLoading.value = false;
  }
}

async function initialize(): Promise<void> {
  loading.value = true;
  error.value = '';
  noAccess.value = false;
  try {
    ledgers.value = await coupleLedgerApi.list(auth.accessToken);
    selectedLedgerId.value = resolveLedgerId(
      ledgers.value,
      typeof route.query.ledgerId === 'string' ? route.query.ledgerId : undefined,
    );
    if (!selectedLedgerId.value) {
      error.value = '当前没有可用账本';
      return;
    }
    persistLedgerId(selectedLedgerId.value);
    await loadCategories();
    ready.value = true;
  } catch (caught) {
    if (caught instanceof ApiError && [403, 404].includes(caught.status)) noAccess.value = true;
    error.value = explainFailure(caught);
  } finally {
    loading.value = false;
  }
}

async function syncSelection(): Promise<void> {
  if (!ready.value) return;
  persistLedgerId(selectedLedgerId.value);
  form.categoryId = '';
  await router.replace({
    query: { ledgerId: selectedLedgerId.value, type: form.type },
  });
  await loadCategories();
}

async function submit(): Promise<void> {
  if (submitting.value) return;
  error.value = '';
  const amountCent = amountTextToCent(form.amount);
  if (amountCent === null) {
    error.value = '请输入大于 0、最多两位小数的金额';
    return;
  }
  if (!form.categoryId) {
    error.value = '请选择分类';
    return;
  }
  submitting.value = true;
  try {
    const entry = await entryApi.create(
      {
        ledgerId: selectedLedgerId.value,
        type: form.type,
        amountCent,
        categoryId: form.categoryId,
        businessDate: form.businessDate,
        note: form.note.trim() || null,
        paymentMethod: form.paymentMethod || null,
      },
      auth.accessToken,
      idempotencyKey,
    );
    idempotencyKey = newEntryIdempotencyKey();
    await router.replace(`/entries/${entry.id}`);
  } catch (caught) {
    error.value = explainFailure(caught);
  } finally {
    submitting.value = false;
  }
}

watch([selectedLedgerId, () => form.type], syncSelection);
onMounted(initialize);
</script>

<template>
  <main class="business-page">
    <header class="business-header">
      <RouterLink to="/entries" aria-label="返回明细">‹ 返回</RouterLink>
      <h1>记一笔</h1>
      <span class="header-spacer" aria-hidden="true"></span>
    </header>

    <section v-if="loading" class="state-panel" aria-live="polite">
      <strong>正在准备记账</strong>
      <p>加载账本和分类…</p>
    </section>

    <section v-else-if="noAccess" class="state-panel">
      <strong>无法访问这个账本</strong>
      <p>{{ error }}</p>
      <RouterLink class="primary-button" to="/entries">返回明细</RouterLink>
    </section>

    <section v-else-if="!selectedLedgerId" class="state-panel">
      <strong>还没有可用账本</strong>
      <p>{{ error || '请重新登录或稍后重试。' }}</p>
      <button class="secondary-button" type="button" @click="initialize">重试</button>
    </section>

    <form v-else class="entry-form" @submit.prevent="submit">
      <div class="surface-card field-stack">
        <LedgerSwitcher v-model="selectedLedgerId" :ledgers="ledgers" :disabled="submitting" />

        <div class="field-label">
          <span>收支类型</span>
          <div class="segmented-control" role="group" aria-label="收支类型">
            <button
              type="button"
              :class="{ active: form.type === 'EXPENSE' }"
              :aria-pressed="form.type === 'EXPENSE'"
              @click="form.type = 'EXPENSE'"
            >
              支出
            </button>
            <button
              type="button"
              :class="{ active: form.type === 'INCOME' }"
              :aria-pressed="form.type === 'INCOME'"
              @click="form.type = 'INCOME'"
            >
              收入
            </button>
          </div>
        </div>

        <label class="amount-field">
          <span>金额</span>
          <span class="amount-input"
            ><b>¥</b
            ><input
              v-model="form.amount"
              inputmode="decimal"
              autocomplete="off"
              placeholder="0.00"
              aria-label="金额"
              :disabled="submitting"
          /></span>
        </label>

        <div class="field-label">
          <span>分类</span>
          <p v-if="categoriesLoading" class="muted-copy">正在加载分类…</p>
          <div v-else-if="categories.length" class="category-grid">
            <button
              v-for="category in categories"
              :key="category.id"
              type="button"
              :class="{ selected: form.categoryId === category.id }"
              :aria-pressed="form.categoryId === category.id"
              @click="form.categoryId = category.id"
            >
              <span :style="{ '--category-color': category.color }">
                {{ categoryGlyph(category.icon) }}
              </span>
              <small>{{ category.name }}</small>
            </button>
          </div>
          <div v-else class="empty-categories">
            <span>当前类型没有可用分类</span>
            <RouterLink :to="`/categories?ledgerId=${selectedLedgerId}&type=${form.type}`">
              管理分类
            </RouterLink>
          </div>
        </div>

        <label>
          <span>业务日期</span>
          <input v-model="form.businessDate" type="date" required :disabled="submitting" />
        </label>

        <label>
          <span>支付方式（选填）</span>
          <select v-model="form.paymentMethod" :disabled="submitting">
            <option value="">未记录</option>
            <option v-for="[value, label] in PAYMENT_METHODS" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </label>

        <label>
          <span>备注（选填）</span>
          <textarea
            v-model="form.note"
            maxlength="500"
            placeholder="写下这笔收支的说明"
            :disabled="submitting"
          ></textarea>
        </label>
      </div>

      <p v-if="selectedLedger?.type === 'COUPLE'" class="muted-copy">
        这笔账将记录到“{{ selectedLedger.name }}”，双方都可以查看。
      </p>
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button class="primary-button" type="submit" :disabled="submitting || categoriesLoading">
          {{ submitting ? '正在保存…' : '保存账目' }}
        </button>
      </div>
    </form>
  </main>
  <AppBottomNav active="create" />
</template>

<style scoped>
.header-spacer {
  width: 44px;
}
.entry-form {
  display: grid;
  gap: 14px;
}
.amount-input {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid var(--siyu-border);
}
.amount-input b {
  color: var(--siyu-text);
  font-size: 26px;
}
.amount-input input {
  min-width: 0;
  padding: 8px 0;
  border: 0;
  background: transparent;
  font-size: clamp(32px, 12vw, 46px);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.amount-input input:focus {
  box-shadow: none;
}
.category-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 6px;
}
.category-grid button {
  display: grid;
  min-width: 0;
  min-height: 64px;
  place-items: center;
  align-content: center;
  gap: 5px;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--siyu-text-secondary);
}
.category-grid button.selected {
  border-color: var(--siyu-primary);
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
}
.category-grid button > span {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 12px;
  background: color-mix(in srgb, var(--category-color) 14%, var(--siyu-surface));
  color: var(--category-color);
  font-weight: 700;
}
.category-grid small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty-categories {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  background: var(--siyu-primary-soft);
}
.empty-categories a {
  color: var(--siyu-primary);
  white-space: nowrap;
}
@media (max-width: 340px) {
  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
