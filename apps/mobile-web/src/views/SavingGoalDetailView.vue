<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ApiError, isRequestCancelled } from '../api';
import { useAuthStore } from '../auth';
import AppDialog from '../components/AppDialog.vue';
import AppDrawer from '../components/AppDrawer.vue';
import AppEmpty from '../components/AppEmpty.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import SavingGoalForm, { type SavingGoalFormModel } from '../components/SavingGoalForm.vue';
import { amountInputFromCent } from '../entry-money';
import { localBusinessDate } from '../ledger-context';
import {
  createSavingGoalsApi,
  formatSavingCent,
  formatSavingProgress,
  parseSavingAmount,
  savingGoalStatusLabel,
  type SavingContribution,
  type SavingGoalDetail,
} from '../saving-goals';
import { useApiSession } from '../use-api-session';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const api = createSavingGoalsApi(useApiSession());
const goal = ref<SavingGoalDetail>();
const loading = ref(true);
const restricted = ref(false);
const fatal = ref('');
const message = ref('');
const actionError = ref('');
const busy = ref(false);
const editGoalOpen = ref(false);
const deleteGoalOpen = ref(false);
const contributionOpen = ref(false);
const editingContribution = ref<SavingContribution>();
const deletingContribution = ref<SavingContribution>();
const contributionAmount = ref('');
const contributionDate = ref(localBusinessDate(auth.user?.timezone));
const contributionNote = ref('');
const contributionKey = ref(`saving-contribution-${crypto.randomUUID()}`);
const coverFailed = ref(false);
const editForm = ref<SavingGoalFormModel>({
  ledgerId: '',
  name: '',
  targetAmount: '',
  initialAmount: '0',
  targetDate: '',
  coverUrl: '',
  note: '',
});
let controller: AbortController | undefined;

const progressWidth = computed(() =>
  goal.value ? Math.min(100, goal.value.progressBasisPoints / 100) : 0,
);

function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError && cause.code === 'IDEMPOTENCY_CONFLICT')
    return '请求状态冲突，请刷新后核对当前记录。';
  return cause instanceof Error ? cause.message : fallback;
}

async function load() {
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  goal.value = undefined;
  restricted.value = false;
  fatal.value = '';
  coverFailed.value = false;
  try {
    goal.value = await api.get(String(route.params.id), controller.signal);
    if (route.query.created === '1') message.value = '攒钱目标已创建。';
  } catch (cause) {
    if (!isRequestCancelled(cause)) {
      if (cause instanceof ApiError && (cause.status === 403 || cause.status === 404)) {
        restricted.value = true;
        fatal.value = '目标不存在，或当前账号已没有查看权限。';
      } else fatal.value = errorMessage(cause, '目标详情加载失败');
    }
  } finally {
    loading.value = false;
  }
}

async function refreshGoal() {
  goal.value = await api.get(String(route.params.id));
}

function openGoalEditor() {
  if (!goal.value?.canManage) return;
  editForm.value = {
    ledgerId: goal.value.ledgerId,
    name: goal.value.name,
    targetAmount: amountInputFromCent(goal.value.targetCent),
    initialAmount: amountInputFromCent(goal.value.initialCent) || '0',
    targetDate: goal.value.targetDate ?? '',
    coverUrl: goal.value.coverUrl ?? '',
    note: goal.value.note ?? '',
  };
  actionError.value = '';
  editGoalOpen.value = true;
}

async function saveGoal() {
  if (!goal.value?.canManage || busy.value) return;
  actionError.value = '';
  const name = editForm.value.name.trim();
  const target = parseSavingAmount(editForm.value.targetAmount);
  if (!name) {
    actionError.value = '请输入目标名称';
    return;
  }
  if (!target.ok) {
    actionError.value = `目标金额：${target.message}`;
    return;
  }
  busy.value = true;
  try {
    await api.update(goal.value.id, {
      name,
      targetCent: target.amountCent,
      targetDate: editForm.value.targetDate || null,
      coverUrl: editForm.value.coverUrl.trim() || null,
      note: editForm.value.note.trim() || null,
    });
    await refreshGoal();
    editGoalOpen.value = false;
    message.value = '目标信息已更新。';
  } catch (cause) {
    actionError.value = errorMessage(cause, '目标更新失败');
  } finally {
    busy.value = false;
  }
}

async function deleteGoal() {
  if (!goal.value?.canManage || busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    const ledgerId = goal.value.ledgerId;
    await api.delete(goal.value.id);
    deleteGoalOpen.value = false;
    await router.replace({ name: 'saving-goals', query: { ledgerId, deleted: '1' } });
  } catch (cause) {
    actionError.value = errorMessage(cause, '目标删除失败');
  } finally {
    busy.value = false;
  }
}

function openContributionEditor(contribution?: SavingContribution) {
  if (contribution ? !contribution.canEdit : !goal.value?.canContribute) return;
  editingContribution.value = contribution;
  contributionAmount.value = contribution ? amountInputFromCent(contribution.amountCent) : '';
  contributionDate.value = contribution?.businessDate ?? localBusinessDate(auth.user?.timezone);
  contributionNote.value = contribution?.note ?? '';
  actionError.value = '';
  contributionOpen.value = true;
}

function openGoalDelete() {
  actionError.value = '';
  deleteGoalOpen.value = true;
}

function openContributionDelete(contribution: SavingContribution) {
  if (!contribution.canDelete) return;
  actionError.value = '';
  deletingContribution.value = contribution;
}

async function saveContribution() {
  if (!goal.value || busy.value) return;
  const parsed = parseSavingAmount(contributionAmount.value);
  actionError.value = '';
  if (!parsed.ok) {
    actionError.value = parsed.message;
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contributionDate.value)) {
    actionError.value = '请选择有效的存入日期';
    return;
  }
  busy.value = true;
  try {
    if (editingContribution.value) {
      await api.updateContribution(goal.value.id, editingContribution.value.id, {
        amountCent: parsed.amountCent,
        businessDate: contributionDate.value,
        note: contributionNote.value.trim() || null,
      });
      message.value = '存入记录已更新。';
    } else {
      await api.addContribution(goal.value.id, {
        amountCent: parsed.amountCent,
        businessDate: contributionDate.value,
        note: contributionNote.value.trim() || null,
        idempotencyKey: contributionKey.value,
      });
      contributionKey.value = `saving-contribution-${crypto.randomUUID()}`;
      message.value = '存入记录已添加。';
    }
    await refreshGoal();
    contributionOpen.value = false;
    editingContribution.value = undefined;
  } catch (cause) {
    actionError.value = errorMessage(cause, '存入记录保存失败');
  } finally {
    busy.value = false;
  }
}

async function deleteContribution() {
  const contribution = deletingContribution.value;
  if (!goal.value || !contribution?.canDelete || busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    await api.deleteContribution(goal.value.id, contribution.id);
    await refreshGoal();
    deletingContribution.value = undefined;
    message.value = '存入记录已删除，目标进度已重新计算。';
  } catch (cause) {
    actionError.value = errorMessage(cause, '存入记录删除失败');
  } finally {
    busy.value = false;
  }
}

function backToList() {
  void router.push({
    name: 'saving-goals',
    query: { ledgerId: goal.value?.ledgerId ?? route.query.ledgerId },
  });
}

watch(() => route.params.id, load);
onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <main class="business-page saving-detail-page">
    <AppPageHeader :title="goal?.name || '攒钱目标'" back-label="返回" @back="backToList">
      <button
        v-if="goal?.canManage"
        type="button"
        class="header-action edit-goal-action"
        @click="openGoalEditor"
      >
        编辑
      </button>
    </AppPageHeader>
    <section v-if="loading" class="state-panel" aria-live="polite">正在加载目标详情…</section>
    <AppErrorState
      v-else-if="fatal"
      :title="restricted ? '无法访问此目标' : '目标详情加载失败'"
      :message="fatal"
      :retry-label="restricted ? '' : '重试'"
      @retry="load"
    >
      <button v-if="restricted" type="button" class="secondary-button" @click="backToList">
        返回目标列表
      </button>
    </AppErrorState>
    <template v-else-if="goal">
      <p v-if="message" class="inline-success" role="status">{{ message }}</p>
      <section class="goal-hero">
        <img
          v-if="goal.coverUrl && !coverFailed"
          :src="goal.coverUrl"
          :alt="`${goal.name}封面`"
          referrerpolicy="no-referrer"
          @error="coverFailed = true"
        />
        <div class="hero-heading">
          <small>已存金额 · {{ savingGoalStatusLabel(goal.status) }}</small>
          <strong>{{ formatSavingCent(goal.savedCent) }}</strong>
          <span>目标 {{ formatSavingCent(goal.targetCent) }}</span>
        </div>
        <div class="progress-track" aria-hidden="true">
          <span :style="{ width: `${progressWidth}%` }" />
        </div>
        <div class="progress-copy">
          <span>还差 {{ formatSavingCent(goal.remainingCent) }}</span>
          <strong>{{ formatSavingProgress(goal.progressBasisPoints) }}</strong>
        </div>
      </section>

      <section class="goal-facts surface-card">
        <div>
          <small>所属账本</small><strong>{{ goal.ledgerName }}</strong>
        </div>
        <div>
          <small>目标日期</small><strong>{{ goal.targetDate || '未设置' }}</strong>
        </div>
        <div>
          <small>初始已存</small><strong>{{ formatSavingCent(goal.initialCent) }}</strong>
        </div>
        <div>
          <small>创建者</small><strong>{{ goal.creatorName }}</strong>
        </div>
      </section>
      <section v-if="goal.note" class="surface-card note-card">
        <small>目标备注</small>
        <p>{{ goal.note }}</p>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div>
            <small>贡献汇总</small>
            <h2>{{ goal.ledgerType === 'COUPLE' ? '我们一起攒' : '我的积累' }}</h2>
          </div>
          <span>{{ goal.contributorSummaries.length }} 人</span>
        </div>
        <div class="contributor-grid">
          <article v-for="summary in goal.contributorSummaries" :key="summary.userId">
            <small>{{ summary.contributorName }}</small>
            <strong>{{ formatSavingCent(summary.amountCent) }}</strong>
          </article>
        </div>
      </section>

      <button
        v-if="goal.canContribute"
        type="button"
        class="primary-button add-contribution"
        :disabled="busy"
        @click="openContributionEditor()"
      >
        添加一笔存入
      </button>
      <AppEmpty
        v-else
        title="当前只能查看目标"
        description="存入与管理权限由服务端按当前账本成员状态返回。"
      />

      <section class="section-block">
        <div class="section-heading">
          <div>
            <small>存入记录</small>
            <h2>每一笔积累</h2>
          </div>
          <span>{{ goal.contributions.length }} 笔</span>
        </div>
        <AppEmpty
          v-if="!goal.contributions.length"
          title="还没有存入记录"
          description="初始金额只计入贡献汇总，不会伪造成一条存入记录。"
        />
        <div v-else class="contribution-list">
          <article v-for="contribution in goal.contributions" :key="contribution.id">
            <div class="contribution-main">
              <span
                ><strong>{{ contribution.contributorName }}</strong
                ><small>{{ contribution.businessDate }}</small></span
              >
              <strong>{{ formatSavingCent(contribution.amountCent) }}</strong>
            </div>
            <p v-if="contribution.note">{{ contribution.note }}</p>
            <div v-if="contribution.canEdit || contribution.canDelete" class="contribution-actions">
              <button
                v-if="contribution.canEdit"
                type="button"
                :disabled="busy"
                @click="openContributionEditor(contribution)"
              >
                编辑
              </button>
              <button
                v-if="contribution.canDelete"
                type="button"
                :disabled="busy"
                class="danger-text"
                @click="openContributionDelete(contribution)"
              >
                删除
              </button>
            </div>
          </article>
        </div>
      </section>

      <section v-if="goal.canManage" class="management-zone surface-card">
        <strong>目标管理</strong>
        <p>删除后目标不再可见，历史存入事实保留且不能继续修改。</p>
        <button type="button" class="danger-button" :disabled="busy" @click="openGoalDelete">
          删除目标
        </button>
      </section>
    </template>

    <AppDrawer :open="editGoalOpen" title="编辑攒钱目标" :busy="busy" @close="editGoalOpen = false">
      <SavingGoalForm v-model="editForm" edit :busy="busy" @submit="saveGoal" />
      <p v-if="actionError" class="inline-error" role="alert">{{ actionError }}</p>
    </AppDrawer>

    <AppDrawer
      :open="contributionOpen"
      :title="editingContribution ? '编辑存入记录' : '添加一笔存入'"
      :busy="busy"
      @close="contributionOpen = false"
    >
      <form class="field-stack contribution-form" @submit.prevent="saveContribution">
        <label
          >存入金额（元）<input
            v-model="contributionAmount"
            inputmode="decimal"
            autocomplete="off"
            placeholder="0.00"
        /></label>
        <label>存入日期<input v-model="contributionDate" type="date" /></label>
        <label
          >备注（可选）<textarea
            v-model="contributionNote"
            maxlength="500"
            placeholder="例如：本月结余"
          />
        </label>
        <p v-if="actionError" class="inline-error" role="alert">{{ actionError }}</p>
        <button class="primary-button" type="submit" :disabled="busy">
          {{ busy ? '正在保存…' : '保存存入记录' }}
        </button>
      </form>
    </AppDrawer>

    <AppDialog
      :open="deleteGoalOpen"
      title="删除攒钱目标"
      confirm-text="确认删除"
      danger
      :busy="busy"
      @confirm="deleteGoal"
      @cancel="deleteGoalOpen = false"
    >
      删除后目标将进入已取消状态并从列表隐藏，已有存入记录不会被级联删除。
      <p v-if="actionError" class="inline-error" role="alert">{{ actionError }}</p>
    </AppDialog>
    <AppDialog
      :open="Boolean(deletingContribution)"
      title="删除这笔存入"
      confirm-text="确认删除"
      danger
      :busy="busy"
      @confirm="deleteContribution"
      @cancel="deletingContribution = undefined"
    >
      删除后目标进度和完成状态会由服务端重新计算。
      <p v-if="actionError" class="inline-error" role="alert">{{ actionError }}</p>
    </AppDialog>
  </main>
</template>

<style scoped>
.saving-detail-page {
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
.goal-hero {
  display: grid;
  gap: 14px;
  padding: 20px 16px;
  border: 1px solid var(--siyu-border);
  border-radius: 18px;
  background: var(--siyu-surface);
}
.goal-hero img {
  width: 100%;
  max-height: 180px;
  border-radius: 14px;
  object-fit: cover;
}
.hero-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 6px 12px;
}
.hero-heading small {
  grid-column: 1 / -1;
  color: var(--siyu-text-secondary);
}
.hero-heading strong {
  overflow-wrap: anywhere;
  color: var(--siyu-income);
  font-size: clamp(30px, 9vw, 38px);
  font-variant-numeric: tabular-nums;
}
.hero-heading span {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.progress-track {
  height: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--siyu-secondary-bg);
}
.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--siyu-primary);
}
.progress-copy,
.section-heading,
.contribution-main,
.contribution-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.progress-copy {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.progress-copy strong {
  color: var(--siyu-primary);
}
.goal-facts,
.contributor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.goal-facts div,
.contributor-grid article {
  display: grid;
  min-width: 0;
  gap: 6px;
}
.goal-facts small,
.contributor-grid small,
.note-card small,
.section-heading small,
.contribution-main small {
  color: var(--siyu-text-secondary);
}
.goal-facts strong,
.contributor-grid strong {
  overflow-wrap: anywhere;
}
.note-card p,
.management-zone p,
.contribution-list p {
  margin: 8px 0 0;
  color: var(--siyu-text-secondary);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.section-block {
  display: grid;
  gap: 12px;
}
.section-heading h2 {
  margin: 3px 0 0;
  font-size: 18px;
}
.section-heading > span {
  color: var(--siyu-text-secondary);
  font-size: 13px;
}
.contributor-grid article {
  padding: 14px;
  border: 1px solid var(--siyu-border);
  border-radius: 14px;
  background: var(--siyu-surface);
}
.add-contribution {
  width: 100%;
}
.contribution-list {
  display: grid;
  gap: 10px;
}
.contribution-list article {
  padding: 14px;
  border: 1px solid var(--siyu-border);
  border-radius: 14px;
  background: var(--siyu-surface);
}
.contribution-main > span {
  display: grid;
  min-width: 0;
  gap: 4px;
}
.contribution-main > span strong,
.contribution-main > strong {
  overflow-wrap: anywhere;
}
.contribution-actions {
  justify-content: flex-end;
  margin-top: 8px;
}
.contribution-actions button {
  min-width: 56px;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--siyu-primary);
}
.contribution-actions .danger-text {
  color: var(--siyu-danger);
}
.management-zone {
  display: grid;
  gap: 10px;
}
.management-zone p {
  margin: 0;
}
.management-zone .danger-button {
  width: 100%;
}
@media (max-width: 340px) {
  .goal-facts,
  .contributor-grid {
    grid-template-columns: 1fr;
  }
  .hero-heading {
    grid-template-columns: 1fr;
  }
}
</style>
