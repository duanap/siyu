<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError } from '../api';
import { useAuthStore } from '../auth';
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  categoryApi,
  categoryGlyph,
  type Category,
  type CategoryIcon,
  type CategoryList,
  type CategoryType,
} from '../category';
import { coupleLedgerApi, type Ledger } from '../couple-ledger';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const ledgers = ref<Ledger[]>([]);
const selectedLedgerId = ref(typeof route.query.ledgerId === 'string' ? route.query.ledgerId : '');
const selectedType = ref<CategoryType>(route.query.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
const result = ref<CategoryList>({
  items: [],
  permissions: { canCreate: false, canReorder: false },
});
const loading = ref(true);
const loadFailed = ref(false);
const forbidden = ref(false);
const submitting = ref(false);
const error = ref('');
const success = ref('');
const editorOpen = ref(false);
const editing = ref<Category>();
const formName = ref('');
const formIcon = ref<CategoryIcon>('other');
const formColor = ref<string>('#64748B');

const enabled = computed(() => result.value.items.filter((item) => item.isEnabled));
const disabled = computed(() => result.value.items.filter((item) => !item.isEnabled));
const selectedLedger = computed(() =>
  ledgers.value.find((ledger) => ledger.id === selectedLedgerId.value),
);

function setError(cause: unknown): void {
  forbidden.value = cause instanceof ApiError && cause.status === 404;
  error.value = cause instanceof Error ? cause.message : '请求失败，请稍后重试';
}

async function syncQuery(): Promise<void> {
  await router.replace({
    query: { ledgerId: selectedLedgerId.value, type: selectedType.value },
  });
}

async function loadCategories(): Promise<void> {
  if (!selectedLedgerId.value) return;
  loading.value = true;
  loadFailed.value = false;
  forbidden.value = false;
  error.value = '';
  try {
    result.value = await categoryApi.list(
      selectedLedgerId.value,
      selectedType.value,
      true,
      auth.accessToken,
    );
  } catch (cause) {
    setError(cause);
    loadFailed.value = !forbidden.value;
  } finally {
    loading.value = false;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  loadFailed.value = false;
  try {
    ledgers.value = await coupleLedgerApi.list(auth.accessToken);
    if (!ledgers.value.some((ledger) => ledger.id === selectedLedgerId.value)) {
      selectedLedgerId.value = ledgers.value[0]?.id ?? '';
    }
    await syncQuery();
    await loadCategories();
  } catch (cause) {
    setError(cause);
    loadFailed.value = !forbidden.value;
    loading.value = false;
  }
}

async function selectLedger(): Promise<void> {
  await syncQuery();
  await loadCategories();
}

async function selectType(type: CategoryType): Promise<void> {
  if (selectedType.value === type) return;
  selectedType.value = type;
  await syncQuery();
  await loadCategories();
}

function openCreate(): void {
  error.value = '';
  editing.value = undefined;
  formName.value = '';
  formIcon.value = selectedType.value === 'INCOME' ? 'salary' : 'other';
  formColor.value = selectedType.value === 'INCOME' ? '#22A06B' : '#E85D5D';
  editorOpen.value = true;
}

function openEdit(category: Category): void {
  if (!category.canEdit) return;
  error.value = '';
  editing.value = category;
  formName.value = category.name;
  formIcon.value = category.icon;
  formColor.value = category.color;
  editorOpen.value = true;
}

function closeEditor(): void {
  if (!submitting.value) {
    editorOpen.value = false;
    error.value = '';
  }
}

async function save(): Promise<void> {
  if (submitting.value || !formName.value.trim()) return;
  submitting.value = true;
  error.value = '';
  success.value = '';
  try {
    if (editing.value) {
      await categoryApi.update(
        editing.value.id,
        { name: formName.value.trim(), icon: formIcon.value, color: formColor.value },
        auth.accessToken,
      );
      success.value = '分类已更新。';
    } else {
      await categoryApi.create(
        {
          ledgerId: selectedLedgerId.value,
          type: selectedType.value,
          name: formName.value.trim(),
          icon: formIcon.value,
          color: formColor.value,
        },
        auth.accessToken,
      );
      success.value = '分类已创建。';
    }
    editorOpen.value = false;
    await loadCategories();
  } catch (cause) {
    setError(cause);
  } finally {
    submitting.value = false;
  }
}

async function toggle(category: Category): Promise<void> {
  if (submitting.value || !category.canToggle) return;
  if (
    category.isEnabled &&
    !window.confirm(`确认停用“${category.name}”吗？历史账目仍会保留该分类。`)
  )
    return;
  submitting.value = true;
  error.value = '';
  success.value = '';
  try {
    await categoryApi.setEnabled(category.id, !category.isEnabled, auth.accessToken);
    success.value = category.isEnabled ? '分类已停用。' : '分类已重新启用。';
    await loadCategories();
  } catch (cause) {
    setError(cause);
  } finally {
    submitting.value = false;
  }
}

function canMove(category: Category, direction: -1 | 1): boolean {
  const group = category.isEnabled ? enabled.value : disabled.value;
  const index = group.findIndex((item) => item.id === category.id);
  return (
    result.value.permissions.canReorder &&
    index + direction >= 0 &&
    index + direction < group.length
  );
}

async function move(category: Category, direction: -1 | 1): Promise<void> {
  if (submitting.value || !canMove(category, direction)) return;
  const group = category.isEnabled ? enabled.value : disabled.value;
  const groupIndex = group.findIndex((item) => item.id === category.id);
  const target = group[groupIndex + direction];
  if (!target) return;
  const ordered = [...result.value.items];
  const from = ordered.findIndex((item) => item.id === category.id);
  const to = ordered.findIndex((item) => item.id === target.id);
  [ordered[from], ordered[to]] = [ordered[to]!, ordered[from]!];
  submitting.value = true;
  error.value = '';
  try {
    result.value = await categoryApi.reorder(
      selectedLedgerId.value,
      selectedType.value,
      ordered.map((item) => item.id),
      auth.accessToken,
    );
    success.value = '分类顺序已更新。';
  } catch (cause) {
    setError(cause);
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <main class="category-shell">
    <header>
      <RouterLink to="/account">返回账号</RouterLink>
      <strong>分类管理</strong>
    </header>

    <section class="controls" aria-label="分类筛选">
      <label>
        <span>当前账本</span>
        <select v-model="selectedLedgerId" :disabled="loading" @change="selectLedger">
          <option v-for="ledger in ledgers" :key="ledger.id" :value="ledger.id">
            {{ ledger.name }}（{{ ledger.type === 'PERSONAL' ? '个人' : '情侣' }}）
          </option>
        </select>
      </label>
      <div class="type-switch" role="tablist" aria-label="收支类型">
        <button
          :aria-selected="selectedType === 'EXPENSE'"
          :class="{ active: selectedType === 'EXPENSE' }"
          role="tab"
          type="button"
          @click="selectType('EXPENSE')"
        >
          支出分类
        </button>
        <button
          :aria-selected="selectedType === 'INCOME'"
          :class="{ active: selectedType === 'INCOME' }"
          role="tab"
          type="button"
          @click="selectType('INCOME')"
        >
          收入分类
        </button>
      </div>
    </section>

    <section v-if="loading" class="state" aria-live="polite">
      <strong>正在加载分类…</strong>
      <p>正在同步账本与成员权限。</p>
    </section>
    <section v-else-if="forbidden" class="state">
      <strong>无法访问这个账本</strong>
      <p>{{ error }}</p>
      <button type="button" @click="load">重新检查</button>
    </section>
    <section v-else-if="loadFailed" class="state">
      <strong>分类加载失败</strong>
      <p role="alert">{{ error }}</p>
      <button type="button" @click="load">重试</button>
    </section>

    <template v-else>
      <section class="summary">
        <div>
          <p>{{ selectedLedger?.type === 'COUPLE' ? '共同账本分类' : '个人账本分类' }}</p>
          <h1>{{ selectedType === 'EXPENSE' ? '支出怎么花' : '收入从哪来' }}</h1>
        </div>
        <button
          v-if="result.permissions.canCreate"
          class="primary"
          type="button"
          :disabled="submitting"
          @click="openCreate"
        >
          新增分类
        </button>
      </section>

      <p v-if="!result.permissions.canReorder" class="permission-note">
        你可以管理自己创建的分类；系统分类、他人分类和全局排序由账本所有者管理。
      </p>

      <section v-if="enabled.length" class="category-group">
        <div class="group-heading">
          <h2>正在使用</h2>
          <span>{{ enabled.length }} 项</span>
        </div>
        <ul>
          <li v-for="category in enabled" :key="category.id">
            <span class="icon" :style="{ '--category-color': category.color }" aria-hidden="true">
              {{ categoryGlyph(category.icon) }}
            </span>
            <span class="category-name">
              <strong>{{ category.name }}</strong>
              <small>{{ category.isSystem ? '系统分类' : '自定义分类' }}</small>
            </span>
            <span class="actions">
              <button
                v-if="result.permissions.canReorder"
                aria-label="上移分类"
                type="button"
                :disabled="submitting || !canMove(category, -1)"
                @click="move(category, -1)"
              >
                ↑
              </button>
              <button
                v-if="result.permissions.canReorder"
                aria-label="下移分类"
                type="button"
                :disabled="submitting || !canMove(category, 1)"
                @click="move(category, 1)"
              >
                ↓
              </button>
              <button v-if="category.canEdit" type="button" @click="openEdit(category)">
                编辑
              </button>
              <button
                v-if="category.canToggle"
                class="quiet-danger"
                type="button"
                :disabled="submitting"
                @click="toggle(category)"
              >
                停用
              </button>
            </span>
          </li>
        </ul>
      </section>

      <section v-else class="state empty">
        <strong>还没有启用的分类</strong>
        <p>可以重新启用已有分类，或新建一个自定义分类。</p>
      </section>

      <section v-if="disabled.length" class="category-group disabled-group">
        <div class="group-heading">
          <h2>已停用</h2>
          <span>{{ disabled.length }} 项</span>
        </div>
        <ul>
          <li v-for="category in disabled" :key="category.id">
            <span class="icon" :style="{ '--category-color': category.color }" aria-hidden="true">
              {{ categoryGlyph(category.icon) }}
            </span>
            <span class="category-name">
              <strong>{{ category.name }}</strong>
              <small>{{ category.isSystem ? '系统分类' : '自定义分类' }}</small>
            </span>
            <span class="actions">
              <button v-if="category.canEdit" type="button" @click="openEdit(category)">
                编辑
              </button>
              <button
                v-if="category.canToggle"
                type="button"
                :disabled="submitting"
                @click="toggle(category)"
              >
                启用
              </button>
            </span>
          </li>
        </ul>
      </section>
    </template>

    <p v-if="error && !loadFailed && !forbidden" class="message error" role="alert">{{ error }}</p>
    <p v-if="success" class="message success" role="status">{{ success }}</p>

    <div
      v-if="editorOpen"
      class="drawer-backdrop"
      @click.self="closeEditor"
      @keydown.esc="closeEditor"
    >
      <section
        class="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-editor-title"
      >
        <div class="drawer-heading">
          <h2 id="category-editor-title">{{ editing ? '编辑分类' : '新增分类' }}</h2>
          <button aria-label="关闭" type="button" :disabled="submitting" @click="closeEditor">
            ×
          </button>
        </div>
        <form @submit.prevent="save">
          <label>
            <span>分类名称</span>
            <input v-model="formName" autofocus maxlength="50" required placeholder="1–50 个字符" />
          </label>
          <fieldset>
            <legend>选择图标</legend>
            <div class="icon-picker">
              <button
                v-for="icon in CATEGORY_ICONS"
                :key="icon[0]"
                :aria-label="icon[1]"
                :aria-pressed="formIcon === icon[0]"
                :class="{ selected: formIcon === icon[0] }"
                type="button"
                @click="formIcon = icon[0]"
              >
                {{ icon[2] }}
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend>选择颜色</legend>
            <div class="color-picker">
              <button
                v-for="color in CATEGORY_COLORS"
                :key="color"
                :aria-label="`颜色 ${color}`"
                :aria-pressed="formColor === color"
                :class="{ selected: formColor === color }"
                :style="{ '--swatch': color }"
                type="button"
                @click="formColor = color"
              />
            </div>
          </fieldset>
          <p v-if="error" class="drawer-error" role="alert">{{ error }}</p>
          <button class="primary save" type="submit" :disabled="submitting || !formName.trim()">
            {{ submitting ? '保存中…' : '保存分类' }}
          </button>
        </form>
      </section>
    </div>
  </main>
</template>

<style scoped>
.category-shell {
  width: min(100%, 480px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 0 16px 48px;
  overflow-x: clip;
  background: var(--siyu-page-bg);
  color: var(--siyu-text);
}
header {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
}
header a {
  display: grid;
  min-height: 44px;
  place-items: center;
  color: var(--siyu-primary);
  text-decoration: none;
}
.controls,
.category-group,
.state,
.summary {
  border: 1px solid var(--siyu-border);
  border-radius: 18px;
  background: var(--siyu-surface);
}
.controls {
  padding: 14px;
}
label > span,
legend {
  display: block;
  margin-bottom: 7px;
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
select,
input {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 12px;
  background: var(--siyu-page-bg);
  color: var(--siyu-text);
}
select:focus,
input:focus,
button:focus-visible,
a:focus-visible {
  outline: 3px solid var(--siyu-primary-soft);
  outline-offset: 2px;
}
.type-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 12px;
  padding: 4px;
  border-radius: 14px;
  background: var(--siyu-page-bg);
}
.type-switch button {
  border: 0;
  background: transparent;
}
.type-switch button.active {
  background: var(--siyu-surface);
  color: var(--siyu-primary);
  box-shadow: 0 1px 5px color-mix(in srgb, var(--siyu-text) 12%, transparent);
}
button {
  min-width: 44px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 11px;
  background: var(--siyu-surface);
  color: var(--siyu-text);
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 18px;
}
.summary p,
.summary h1,
.group-heading h2,
.state p {
  margin: 0;
}
.summary p {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.summary h1 {
  margin-top: 4px;
  font-size: 21px;
}
.primary {
  border-color: var(--siyu-primary);
  background: var(--siyu-primary);
  color: white;
}
.permission-note {
  margin: 12px 2px;
  color: var(--siyu-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.category-group {
  margin-top: 14px;
  overflow: hidden;
}
.group-heading {
  display: flex;
  min-height: 50px;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  border-bottom: 1px solid var(--siyu-border);
}
.group-heading h2 {
  font-size: 16px;
}
.group-heading span,
.category-name small {
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 72px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--siyu-border);
}
li:last-child {
  border-bottom: 0;
}
.icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--category-color) 17%, var(--siyu-surface));
  color: var(--category-color);
  font-weight: 700;
}
.category-name {
  min-width: 0;
}
.category-name strong,
.category-name small {
  display: block;
  overflow-wrap: anywhere;
}
.category-name small {
  margin-top: 4px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 194px;
}
.actions button {
  padding: 0 9px;
}
.quiet-danger {
  color: var(--siyu-danger);
}
.disabled-group li {
  opacity: 0.72;
}
.state {
  margin-top: 14px;
  padding: 28px 18px;
  text-align: center;
}
.state p {
  margin-top: 8px;
  color: var(--siyu-text-secondary);
}
.state button {
  margin-top: 16px;
}
.message {
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 12px;
  overflow-wrap: anywhere;
}
.message.error {
  background: var(--siyu-primary-soft);
  color: var(--siyu-danger);
}
.message.success {
  background: var(--siyu-primary-soft);
  color: var(--siyu-income);
}
.drawer-backdrop {
  position: fixed;
  z-index: 10;
  inset: 0;
  display: grid;
  align-items: end;
  background: color-mix(in srgb, var(--siyu-text) 48%, transparent);
}
.drawer {
  width: min(100%, 480px);
  max-height: min(92dvh, 760px);
  margin: 0 auto;
  padding: 18px 16px calc(20px + env(safe-area-inset-bottom));
  overflow-y: auto;
  border-radius: 24px 24px 0 0;
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.drawer-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.drawer-heading h2 {
  margin: 0;
  font-size: 20px;
}
.drawer form > label,
.drawer fieldset {
  display: block;
  margin-top: 18px;
}
fieldset {
  min-width: 0;
  margin-inline: 0;
  padding: 0;
  border: 0;
}
.icon-picker,
.color-picker {
  display: grid;
  grid-template-columns: repeat(5, minmax(44px, 1fr));
  gap: 8px;
}
.icon-picker button.selected {
  border-color: var(--siyu-primary);
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
}
.color-picker button {
  position: relative;
  padding: 0;
}
.color-picker button::before {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--swatch);
  content: '';
}
.color-picker button.selected {
  border: 3px solid var(--siyu-primary);
}
.save {
  width: 100%;
  margin-top: 20px;
}
.drawer-error {
  margin: 16px 0 0;
  color: var(--siyu-danger);
  font-size: 13px;
  overflow-wrap: anywhere;
}
@media (max-width: 360px) {
  .category-shell {
    padding-inline: 10px;
  }
  .summary {
    align-items: stretch;
    flex-direction: column;
  }
  li {
    grid-template-columns: 44px minmax(0, 1fr);
  }
  .actions {
    grid-column: 1 / -1;
    max-width: none;
    justify-content: flex-start;
    padding-left: 54px;
  }
  .icon-picker,
  .color-picker {
    grid-template-columns: repeat(5, 1fr);
  }
}
</style>
