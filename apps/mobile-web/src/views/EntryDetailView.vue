<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '../api';
import { useAuthStore } from '../auth';
import { categoryApi, categoryGlyph, type Category, type CategoryType } from '../category';
import AppBottomNav from '../components/AppBottomNav.vue';
import {
  amountTextToCent,
  centToAmountText,
  entryApi,
  formatCent,
  paymentMethodLabel,
  PAYMENT_METHODS,
  type Entry,
  type EntryPaymentMethod,
} from '../entry';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const entry = ref<Entry>();
const categories = ref<Category[]>([]);
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const editing = ref(false);
const noAccess = ref(false);
const error = ref('');
const success = ref('');
const form = reactive({
  type: 'EXPENSE' as CategoryType,
  amount: '',
  categoryId: '',
  businessDate: '',
  note: '',
  paymentMethod: '' as EntryPaymentMethod | '',
});

const entryId = computed(() => String(route.params.id ?? ''));
const selectableCategories = computed(() =>
  categories.value.filter(
    (category) => category.isEnabled || category.id === entry.value?.category.id,
  ),
);

function fillForm(value: Entry): void {
  form.type = value.type;
  form.amount = centToAmountText(value.amountCent);
  form.categoryId = value.category.id;
  form.businessDate = value.businessDate;
  form.note = value.note ?? '';
  form.paymentMethod = value.paymentMethod ?? '';
}

function explainFailure(caught: unknown): string {
  if (caught instanceof ApiError) {
    if (caught.code === 'ENTRY_VERSION_CONFLICT') return '账目已在别处更新，已重新加载最新内容';
    if (caught.code === 'ENTRY_SOURCE_MANAGED') return '这笔账由其他业务生成，请到对应模块修改';
    if (caught.code === 'CATEGORY_DISABLED') return '所选分类已停用，请重新选择';
    return caught.message;
  }
  return '请求失败，请检查网络后重试';
}

async function loadCategories(): Promise<void> {
  if (!entry.value) return;
  try {
    const result = await categoryApi.list(entry.value.ledgerId, form.type, true, auth.accessToken);
    categories.value = result.items;
    if (!selectableCategories.value.some((category) => category.id === form.categoryId)) {
      form.categoryId = selectableCategories.value[0]?.id ?? '';
    }
  } catch (caught) {
    error.value = explainFailure(caught);
  }
}

async function loadEntry(): Promise<void> {
  loading.value = true;
  error.value = '';
  success.value = '';
  noAccess.value = false;
  try {
    const loaded = await entryApi.get(entryId.value, auth.accessToken);
    entry.value = loaded;
    fillForm(loaded);
    await loadCategories();
  } catch (caught) {
    if (caught instanceof ApiError && [403, 404].includes(caught.status)) noAccess.value = true;
    error.value = explainFailure(caught);
  } finally {
    loading.value = false;
  }
}

function beginEdit(): void {
  if (!entry.value?.canEdit) return;
  fillForm(entry.value);
  error.value = '';
  success.value = '';
  editing.value = true;
}

function cancelEdit(): void {
  if (entry.value) fillForm(entry.value);
  editing.value = false;
  error.value = '';
}

async function save(): Promise<void> {
  if (!entry.value || saving.value) return;
  const amountCent = amountTextToCent(form.amount);
  if (amountCent === null) {
    error.value = '请输入大于 0、最多两位小数的金额';
    return;
  }
  if (!form.categoryId) {
    error.value = '请选择分类';
    return;
  }
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    const updated = await entryApi.update(
      entry.value.id,
      {
        ledgerId: entry.value.ledgerId,
        type: form.type,
        amountCent,
        categoryId: form.categoryId,
        businessDate: form.businessDate,
        note: form.note.trim() || null,
        paymentMethod: form.paymentMethod || null,
        expectedVersion: entry.value.version,
      },
      auth.accessToken,
    );
    entry.value = updated;
    fillForm(updated);
    editing.value = false;
    success.value = '账目已更新';
  } catch (caught) {
    error.value = explainFailure(caught);
    if (caught instanceof ApiError && caught.code === 'ENTRY_VERSION_CONFLICT') {
      await loadEntry();
      error.value = '账目已在别处更新，请确认最新内容后重试';
      editing.value = true;
    }
  } finally {
    saving.value = false;
  }
}

async function remove(): Promise<void> {
  if (!entry.value?.canDelete || deleting.value) return;
  if (!window.confirm('确定删除这笔账目吗？删除后将不再出现在明细和统计中。')) return;
  deleting.value = true;
  error.value = '';
  try {
    await entryApi.delete(entry.value.id, entry.value.version, auth.accessToken);
    await router.replace({
      path: '/entries',
      query: { ledgerId: entry.value.ledgerId, month: entry.value.businessDate.slice(0, 7) },
    });
  } catch (caught) {
    error.value = explainFailure(caught);
    if (caught instanceof ApiError && caught.code === 'ENTRY_VERSION_CONFLICT') await loadEntry();
  } finally {
    deleting.value = false;
  }
}

watch(
  () => form.type,
  async (next, previous) => {
    if (!editing.value || next === previous) return;
    form.categoryId = '';
    await loadCategories();
  },
);
onMounted(loadEntry);
</script>

<template>
  <main class="business-page">
    <header class="business-header">
      <RouterLink
        :to="
          entry
            ? `/entries?ledgerId=${entry.ledgerId}&month=${entry.businessDate.slice(0, 7)}`
            : '/entries'
        "
        aria-label="返回明细"
      >
        ‹ 返回
      </RouterLink>
      <h1>账目详情</h1>
      <button
        v-if="entry?.canEdit && !editing"
        class="text-action"
        type="button"
        @click="beginEdit"
      >
        编辑
      </button>
      <span v-else class="header-spacer" aria-hidden="true"></span>
    </header>

    <section v-if="loading" class="state-panel" aria-live="polite">
      <strong>正在加载账目</strong>
      <p>请稍候…</p>
    </section>

    <section v-else-if="noAccess || !entry" class="state-panel">
      <strong>无法查看这笔账目</strong>
      <p>{{ error || '账目不存在或你已失去访问权限。' }}</p>
      <RouterLink class="primary-button" to="/entries">返回明细</RouterLink>
    </section>

    <template v-else-if="!editing">
      <section class="entry-hero" :class="entry.type.toLowerCase()">
        <span class="entry-icon" :style="{ '--category-color': entry.category.color }">
          {{ categoryGlyph(entry.category.icon) }}
        </span>
        <p>{{ entry.category.name }}</p>
        <strong>{{ entry.type === 'INCOME' ? '+' : '-' }}{{ formatCent(entry.amountCent) }}</strong>
        <small>{{ entry.type === 'INCOME' ? '收入' : '支出' }} · {{ entry.businessDate }}</small>
      </section>

      <section class="surface-card detail-list">
        <div>
          <span>创建人</span><strong>{{ entry.creator.nickname }}</strong>
        </div>
        <div>
          <span>支付方式</span><strong>{{ paymentMethodLabel(entry.paymentMethod) }}</strong>
        </div>
        <div>
          <span>来源</span
          ><strong>{{ entry.sourceType === 'MANUAL' ? '手工记账' : '业务自动生成' }}</strong>
        </div>
        <div class="note-row">
          <span>备注</span><strong>{{ entry.note || '无备注' }}</strong>
        </div>
      </section>

      <p v-if="!entry.canEdit" class="muted-copy readonly-note">
        {{
          entry.sourceType === 'MANUAL'
            ? '你可以查看这笔账目，但没有修改权限。'
            : '这笔账由其他业务模块维护，仅支持查看。'
        }}
      </p>
      <p v-if="success" class="inline-success" role="status">{{ success }}</p>
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <button
        v-if="entry.canDelete"
        class="danger-button delete-button"
        type="button"
        :disabled="deleting"
        @click="remove"
      >
        {{ deleting ? '正在删除…' : '删除账目' }}
      </button>
    </template>

    <form v-else class="field-stack surface-card" @submit.prevent="save">
      <div class="field-label">
        <span>收支类型</span>
        <div class="segmented-control" role="group" aria-label="收支类型">
          <button
            type="button"
            :class="{ active: form.type === 'EXPENSE' }"
            @click="form.type = 'EXPENSE'"
          >
            支出
          </button>
          <button
            type="button"
            :class="{ active: form.type === 'INCOME' }"
            @click="form.type = 'INCOME'"
          >
            收入
          </button>
        </div>
      </div>
      <label>
        <span>金额</span>
        <input v-model="form.amount" inputmode="decimal" aria-label="金额" required />
      </label>
      <label>
        <span>分类</span>
        <select v-model="form.categoryId" required>
          <option v-for="category in selectableCategories" :key="category.id" :value="category.id">
            {{ category.name }}{{ category.isEnabled ? '' : '（已停用）' }}
          </option>
        </select>
      </label>
      <label>
        <span>业务日期</span>
        <input v-model="form.businessDate" type="date" required />
      </label>
      <label>
        <span>支付方式（选填）</span>
        <select v-model="form.paymentMethod">
          <option value="">未记录</option>
          <option v-for="[value, label] in PAYMENT_METHODS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </label>
      <label>
        <span>备注（选填）</span>
        <textarea v-model="form.note" maxlength="500"></textarea>
      </label>
      <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      <div class="edit-actions">
        <button class="secondary-button" type="button" :disabled="saving" @click="cancelEdit">
          取消
        </button>
        <button class="primary-button" type="submit" :disabled="saving">
          {{ saving ? '正在保存…' : '保存修改' }}
        </button>
      </div>
    </form>
  </main>
  <AppBottomNav active="entries" />
</template>

<style scoped>
.header-spacer {
  width: 44px;
}
.entry-hero {
  display: grid;
  justify-items: center;
  padding: 30px 16px;
  text-align: center;
}
.entry-icon {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: 18px;
  background: color-mix(in srgb, var(--category-color) 14%, var(--siyu-surface));
  color: var(--category-color);
  font-size: 20px;
  font-weight: 700;
}
.entry-hero p {
  margin: 12px 0 5px;
  color: var(--siyu-text-secondary);
}
.entry-hero strong {
  font-size: 34px;
  font-variant-numeric: tabular-nums;
}
.entry-hero.income strong {
  color: var(--siyu-income);
}
.entry-hero.expense strong {
  color: var(--siyu-expense);
}
.entry-hero small {
  margin-top: 8px;
  color: var(--siyu-text-secondary);
}
.detail-list {
  display: grid;
  gap: 0;
}
.detail-list > div {
  display: grid;
  min-height: 52px;
  grid-template-columns: 84px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--siyu-border);
}
.detail-list > div:last-child {
  border-bottom: 0;
}
.detail-list span {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.detail-list strong {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: right;
}
.note-row {
  grid-template-columns: 1fr !important;
  align-items: start !important;
  gap: 8px !important;
  padding: 12px 0;
}
.note-row strong {
  line-height: 1.6;
  text-align: left;
}
.readonly-note {
  margin: 14px 0 0;
}
.delete-button {
  width: 100%;
  margin-top: 22px;
}
.edit-actions {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 10px;
}
</style>
