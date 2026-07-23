<script setup lang="ts">
import {
  Alert as AAlert,
  Button as AButton,
  Card as ACard,
  Empty as AEmpty,
  Input as AInput,
  Modal as AModal,
  Spin as ASpin,
  Statistic as AStatistic,
  Tag as ATag,
} from 'ant-design-vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  adminRequest,
  type AdminAudit,
  type AdminLedger,
  type AdminOverview,
  type AdminRun,
  type AdminUser,
  type PageResult,
} from '../admin-api';
import { useAuthStore } from '../auth';

type Section = 'overview' | 'users' | 'ledgers' | 'tasks' | 'audit';
type PendingAction =
  | { kind: 'user'; item: AdminUser; nextStatus: 'ACTIVE' | 'DISABLED' }
  | { kind: 'retry'; item: AdminRun };

const auth = useAuthStore();
const router = useRouter();
const section = ref<Section>('overview');
const loading = ref(true);
const error = ref('');
const overview = ref<AdminOverview>();
const users = ref<AdminUser[]>([]);
const ledgers = ref<AdminLedger[]>([]);
const runs = ref<AdminRun[]>([]);
const audits = ref<AdminAudit[]>([]);
const pending = ref<PendingAction>();
const reason = ref('');
const submitting = ref(false);

const token = computed(() => auth.accessToken ?? '');
const modalTitle = computed(() =>
  pending.value?.kind === 'retry'
    ? '确认人工重试'
    : pending.value?.nextStatus === 'DISABLED'
      ? '确认停用用户'
      : '确认启用用户',
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [summary, userPage, ledgerPage, runPage, auditPage] = await Promise.all([
      adminRequest<AdminOverview>(token.value, '/overview'),
      adminRequest<PageResult<AdminUser>>(token.value, '/users?pageSize=50'),
      adminRequest<PageResult<AdminLedger>>(token.value, '/ledgers?pageSize=50'),
      adminRequest<PageResult<AdminRun>>(token.value, '/recurring-runs?pageSize=50'),
      adminRequest<PageResult<AdminAudit>>(token.value, '/audit-logs?pageSize=50'),
    ]);
    overview.value = summary;
    users.value = userPage.items;
    ledgers.value = ledgerPage.items;
    runs.value = runPage.items;
    audits.value = auditPage.items;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '管理数据加载失败';
  } finally {
    loading.value = false;
  }
}

function openUser(item: AdminUser): void {
  pending.value = {
    kind: 'user',
    item,
    nextStatus: item.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
  };
  reason.value = '';
}

function openRetry(item: AdminRun): void {
  pending.value = { kind: 'retry', item };
  reason.value = '';
}

async function confirmAction(): Promise<void> {
  if (!pending.value || reason.value.trim().length < 2) return;
  submitting.value = true;
  error.value = '';
  try {
    if (pending.value.kind === 'user') {
      await adminRequest(token.value, `/users/${pending.value.item.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: pending.value.nextStatus, reason: reason.value.trim() }),
      });
    } else {
      await adminRequest(token.value, `/recurring-runs/${pending.value.item.id}/retry`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.value.trim() }),
      });
    }
    pending.value = undefined;
    await load();
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '操作失败';
  } finally {
    submitting.value = false;
  }
}

async function logout(): Promise<void> {
  await auth.logout();
  await router.replace('/login');
}

onMounted(load);
</script>

<template>
  <main class="admin-shell">
    <header>
      <div>
        <div><small>SIYU ADMIN</small><strong>四时有余管理后台</strong></div>
        <div class="header-actions">
          <span>{{ auth.user?.nickname }}</span>
          <AButton @click="logout">退出</AButton>
        </div>
      </div>
    </header>

    <nav aria-label="管理功能">
      <AButton
        v-for="item in [
          ['overview', '运行概览'],
          ['users', '用户状态'],
          ['ledgers', '账本关系'],
          ['tasks', '周期任务'],
          ['audit', '审计记录'],
        ]"
        :key="item[0]"
        :type="section === item[0] ? 'primary' : 'default'"
        @click="section = item[0] as Section"
      >
        {{ item[1] }}
      </AButton>
    </nav>

    <section class="content" aria-live="polite">
      <AAlert v-if="error" type="error" show-icon :message="error">
        <template #action><AButton @click="load">重试</AButton></template>
      </AAlert>
      <div v-if="loading" class="state"><ASpin size="large" /><span>读取运营事实…</span></div>

      <template v-else-if="section === 'overview' && overview">
        <h1>运行概览</h1>
        <p class="hint">只展示状态汇总，不包含用户财务明细。</p>
        <div class="stats">
          <ACard><AStatistic title="活跃用户" :value="overview.activeUsers" /></ACard>
          <ACard><AStatistic title="停用用户" :value="overview.disabledUsers" /></ACard>
          <ACard><AStatistic title="活跃账本" :value="overview.activeLedgers" /></ACard>
          <ACard><AStatistic title="失败周期任务" :value="overview.failedRuns" /></ACard>
          <ACard><AStatistic title="活跃会话" :value="overview.activeSessions" /></ACard>
        </div>
      </template>

      <template v-else-if="section === 'users'">
        <h1>用户状态</h1>
        <AEmpty v-if="users.length === 0" description="暂无用户" />
        <div v-else class="cards">
          <ACard v-for="item in users" :key="item.id">
            <div class="row">
              <strong>{{ item.nickname }}</strong
              ><ATag>{{ item.status }}</ATag>
            </div>
            <p>{{ item.emailMasked ?? '无邮箱' }} · {{ item.roles.join(' / ') || '无角色' }}</p>
            <code>{{ item.id }}</code>
            <AButton :danger="item.status === 'ACTIVE'" @click="openUser(item)">
              {{ item.status === 'ACTIVE' ? '停用账号' : '启用账号' }}
            </AButton>
          </ACard>
        </div>
      </template>

      <template v-else-if="section === 'ledgers'">
        <h1>账本与成员关系</h1>
        <AEmpty v-if="ledgers.length === 0" description="暂无账本" />
        <div v-else class="cards">
          <ACard v-for="item in ledgers" :key="item.id">
            <div class="row">
              <strong>{{ item.name }}</strong
              ><ATag>{{ item.type }} / {{ item.status }}</ATag>
            </div>
            <ul>
              <li v-for="member in item.members" :key="member.userId">
                {{ member.nickname }} · {{ member.emailMasked ?? '无邮箱' }} · {{ member.role }} /
                {{ member.status }}
              </li>
            </ul>
          </ACard>
        </div>
      </template>

      <template v-else-if="section === 'tasks'">
        <h1>周期任务</h1>
        <AEmpty v-if="runs.length === 0" description="暂无执行记录" />
        <div v-else class="cards">
          <ACard v-for="item in runs" :key="item.id">
            <div class="row">
              <strong>{{ item.ruleName }}</strong
              ><ATag>{{ item.status }}</ATag>
            </div>
            <p>{{ item.scheduledDate }} · {{ item.ownerNickname }} · 尝试 {{ item.attempts }} 次</p>
            <code>{{ item.lastError ?? '无错误' }}</code>
            <AButton v-if="item.status === 'FAILED'" :danger="true" @click="openRetry(item)"
              >人工重试</AButton
            >
          </ACard>
        </div>
      </template>

      <template v-else-if="section === 'audit'">
        <h1>脱敏审计记录</h1>
        <AEmpty v-if="audits.length === 0" description="暂无审计记录" />
        <div v-else class="cards">
          <ACard v-for="item in audits" :key="item.id">
            <div class="row">
              <strong>{{ item.action }}</strong
              ><ATag>{{ item.actorType }}</ATag>
            </div>
            <p>
              {{ item.actor?.nickname ?? '系统' }} · {{ item.targetType }} · {{ item.createdAt }}
            </p>
            <code>{{ item.requestId ?? '无请求 ID' }}</code>
          </ACard>
        </div>
      </template>
    </section>

    <AModal
      :open="Boolean(pending)"
      :title="modalTitle"
      :confirm-loading="submitting"
      :ok-button-props="{ disabled: reason.trim().length < 2, danger: true }"
      ok-text="确认执行"
      cancel-text="取消"
      @ok="confirmAction"
      @cancel="pending = undefined"
    >
      <p>该操作会写入审计，请填写 2 至 200 字操作理由。</p>
      <AInput.TextArea v-model:value="reason" :maxlength="200" :rows="4" />
    </AModal>
  </main>
</template>

<style scoped>
.admin-shell {
  min-height: 100dvh;
  background: var(--siyu-page-bg);
  color: var(--siyu-text);
}
header {
  border-bottom: 1px solid var(--siyu-border);
  background: var(--siyu-surface);
}
header > div {
  display: flex;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 24px;
}
header strong {
  display: block;
  font-size: 18px;
}
header small {
  color: var(--siyu-primary);
  font-weight: 700;
  letter-spacing: 0.14em;
}
.header-actions,
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
nav {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 16px 24px;
  border-bottom: 1px solid var(--siyu-border);
  background: var(--siyu-surface);
}
nav :deep(button) {
  min-height: 44px;
  flex: 0 0 auto;
}
.content {
  max-width: 1180px;
  margin: 0 auto;
  padding: 28px 24px 56px;
}
h1 {
  margin: 0;
  font-size: 26px;
}
.hint,
p {
  color: var(--siyu-text-secondary);
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-top: 24px;
}
.cards {
  display: grid;
  gap: 14px;
  margin-top: 22px;
}
.cards :deep(.ant-card-body) {
  display: grid;
  gap: 12px;
}
.cards p,
.cards ul {
  margin: 0;
}
code {
  overflow-wrap: anywhere;
  color: var(--siyu-text-secondary);
}
.state {
  display: grid;
  min-height: 320px;
  place-content: center;
  justify-items: center;
  gap: 16px;
}
@media (max-width: 600px) {
  header > div {
    align-items: flex-start;
    padding: 14px 16px;
  }
  .header-actions {
    flex-direction: column;
    align-items: flex-end;
  }
  nav {
    padding: 12px 16px;
  }
  .content {
    padding: 22px 16px 44px;
  }
}
</style>
