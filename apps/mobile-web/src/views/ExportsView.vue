<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import AppEmpty from '../components/AppEmpty.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import type { Ledger } from '../entry';
import { listLedgers } from '../entry-resources';
import { createExportsApi } from '../exports';
import { useApiSession } from '../use-api-session';

const router = useRouter();
const session = useApiSession();
const api = createExportsApi(session);
const now = new Date();
const year = now.getFullYear();
const ledgers = ref<Ledger[]>([]);
const ledgerId = ref('');
const startDate = ref(`${year}-01-01`);
const endDate = ref(`${year}-12-31`);
const salaryYear = ref(year);
const loading = ref(true);
const fatal = ref('');
const busy = ref<'entries' | 'salary' | ''>('');
const actionError = ref('');
const success = ref('');

const selectedLedger = computed(() => ledgers.value.find((ledger) => ledger.id === ledgerId.value));

async function load(): Promise<void> {
  loading.value = true;
  fatal.value = '';
  try {
    ledgers.value = await listLedgers(session);
    ledgerId.value = ledgers.value[0]?.id ?? '';
  } catch (cause) {
    fatal.value = cause instanceof Error ? cause.message : '账本加载失败';
  } finally {
    loading.value = false;
  }
}

async function downloadEntries(): Promise<void> {
  if (busy.value || !ledgerId.value) return;
  busy.value = 'entries';
  actionError.value = '';
  success.value = '';
  try {
    const filename = await api.entries({
      ledgerId: ledgerId.value,
      startDate: startDate.value,
      endDate: endDate.value,
    });
    success.value = `已下载 ${filename}`;
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '账目导出失败';
  } finally {
    busy.value = '';
  }
}

async function downloadSalary(): Promise<void> {
  if (busy.value) return;
  busy.value = 'salary';
  actionError.value = '';
  success.value = '';
  try {
    const filename = await api.salary(salaryYear.value);
    success.value = `已下载 ${filename}`;
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '工资导出失败';
  } finally {
    busy.value = '';
  }
}

onMounted(load);
</script>

<template>
  <main class="business-page exports-page">
    <AppPageHeader title="数据导出" back-label="返回" @back="router.push('/account')" />
    <section v-if="loading" class="state-panel" aria-live="polite">正在加载可导出范围…</section>
    <AppErrorState
      v-else-if="fatal"
      title="导出功能加载失败"
      :message="fatal"
      retry-label="重试"
      @retry="load"
    />
    <template v-else>
      <p class="scope-copy">文件只包含你当前有权访问的数据，导出成功会留下脱敏安全记录。</p>
      <p v-if="actionError" class="inline-error" role="alert">{{ actionError }}</p>
      <p v-if="success" class="success-copy" role="status">{{ success }}</p>

      <AppEmpty
        v-if="!ledgers.length"
        title="暂无可导出的账本"
        description="创建个人账本或加入有效的朝暮同笺后再试。"
      />
      <section v-else class="export-panel" aria-labelledby="entry-export-title">
        <div>
          <h2 id="entry-export-title">账目 CSV</h2>
          <p>导出一个账本中最多 366 天的未删除账目。</p>
        </div>
        <label>
          <span>账本</span>
          <select v-model="ledgerId" :disabled="Boolean(busy)">
            <option v-for="ledger in ledgers" :key="ledger.id" :value="ledger.id">
              {{ ledger.name }}{{ ledger.type === 'COUPLE' ? ' · 朝暮同笺' : ' · 个人' }}
            </option>
          </select>
        </label>
        <div class="date-grid">
          <label>
            <span>开始日期</span>
            <input v-model="startDate" type="date" :disabled="Boolean(busy)" />
          </label>
          <label>
            <span>结束日期</span>
            <input v-model="endDate" type="date" :disabled="Boolean(busy)" />
          </label>
        </div>
        <p class="selection-copy">当前范围：{{ selectedLedger?.name }}</p>
        <button type="button" :disabled="Boolean(busy)" @click="downloadEntries">
          {{ busy === 'entries' ? '正在生成…' : '下载账目 CSV' }}
        </button>
      </section>

      <section class="export-panel" aria-labelledby="salary-export-title">
        <div>
          <h2 id="salary-export-title">工资 CSV</h2>
          <p>只导出本人指定年份的工资记录和项目，不包含伴侣私有数据。</p>
        </div>
        <label>
          <span>工资年份</span>
          <input
            v-model.number="salaryYear"
            type="number"
            min="2000"
            max="9999"
            :disabled="Boolean(busy)"
          />
        </label>
        <button type="button" :disabled="Boolean(busy)" @click="downloadSalary">
          {{ busy === 'salary' ? '正在生成…' : '下载工资 CSV' }}
        </button>
      </section>
    </template>
  </main>
</template>

<style scoped>
.exports-page {
  display: grid;
  align-content: start;
  gap: 16px;
}
.scope-copy,
.selection-copy,
.export-panel p {
  margin: 0;
  color: var(--siyu-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.success-copy {
  margin: 0;
  color: var(--siyu-primary);
}
.export-panel {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--siyu-border);
  border-radius: 16px;
  background: var(--siyu-surface);
}
.export-panel h2 {
  margin: 0 0 4px;
  font-size: 18px;
}
.export-panel label {
  display: grid;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
.export-panel input,
.export-panel select,
.export-panel button {
  min-width: 0;
  min-height: 44px;
  border-radius: 12px;
  font: inherit;
}
.export-panel input,
.export-panel select {
  width: 100%;
  padding: 0 12px;
  border: 1px solid var(--siyu-border);
  background: var(--siyu-surface);
  color: var(--siyu-text);
}
.export-panel button {
  border: 0;
  background: var(--siyu-primary);
  color: #fff;
  font-weight: 700;
}
.export-panel button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.date-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 350px) {
  .date-grid {
    grid-template-columns: 1fr;
  }
}
</style>
