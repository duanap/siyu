<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { ApiError } from '../api';
import { useAuthStore } from '../auth';
import { coupleLedgerApi, type Ledger } from '../couple-ledger';

const auth = useAuthStore();
const route = useRoute();
const ledger = ref<Ledger>();
const loading = ref(true);
const submitting = ref(false);
const forbidden = ref(false);
const error = ref('');
const success = ref('');
const name = ref('朝暮同笺');
const inviteToken = ref('');
const invitationToken = ref(String(route.query.token || ''));

const isOwner = computed(() => ledger.value?.ownerUserId === auth.user?.id);
const partner = computed(() =>
  ledger.value?.members.find((member) => member.userId !== auth.user?.id),
);

function handleError(cause: unknown): void {
  if (cause instanceof ApiError && cause.status === 403) forbidden.value = true;
  error.value = cause instanceof Error ? cause.message : '请求失败，请稍后重试';
}

async function load(): Promise<void> {
  loading.value = true;
  forbidden.value = false;
  error.value = '';
  try {
    ledger.value = (await coupleLedgerApi.list(auth.accessToken)).find(
      (item) => item.type === 'COUPLE',
    );
    if (ledger.value) name.value = ledger.value.name;
  } catch (cause) {
    handleError(cause);
  } finally {
    loading.value = false;
  }
}

async function run(action: () => Promise<void>): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  error.value = '';
  success.value = '';
  try {
    await action();
  } catch (cause) {
    handleError(cause);
  } finally {
    submitting.value = false;
  }
}

async function createLedger(): Promise<void> {
  await run(async () => {
    ledger.value = await coupleLedgerApi.create(name.value, auth.accessToken);
    success.value = '情侣账本已创建。';
  });
}

async function acceptInvitation(): Promise<void> {
  await run(async () => {
    ledger.value = await coupleLedgerApi.accept(invitationToken.value.trim(), auth.accessToken);
    name.value = ledger.value.name;
    invitationToken.value = '';
    success.value = '已加入情侣账本。';
  });
}

async function saveName(): Promise<void> {
  if (!ledger.value) return;
  await run(async () => {
    ledger.value = await coupleLedgerApi.update(ledger.value!.id, name.value, auth.accessToken);
    success.value = '账本名称已更新。';
  });
}

async function createInvitation(): Promise<void> {
  if (!ledger.value) return;
  await run(async () => {
    const result = await coupleLedgerApi.invite(ledger.value!.id, auth.accessToken);
    inviteToken.value = result.token;
    success.value = '邀请已生成，7 天内有效。';
  });
}

async function copyInvitation(): Promise<void> {
  if (!inviteToken.value) return;
  await navigator.clipboard.writeText(inviteToken.value);
  success.value = '邀请码已复制。';
}

async function transferOwnership(): Promise<void> {
  if (!ledger.value || !partner.value) return;
  if (!window.confirm(`确认将所有权转移给“${partner.value.nickname}”吗？`)) return;
  await run(async () => {
    ledger.value = await coupleLedgerApi.transfer(
      ledger.value!.id,
      partner.value!.userId,
      auth.accessToken,
    );
    success.value = '所有权已转移。';
  });
}

async function leave(): Promise<void> {
  if (!ledger.value || !window.confirm('确认退出朝暮同笺？退出后将无法查看共同账本。')) return;
  await run(async () => {
    await coupleLedgerApi.leave(ledger.value!.id, auth.accessToken);
    ledger.value = undefined;
    success.value = '已退出情侣账本。';
  });
}

async function dissolve(): Promise<void> {
  if (!ledger.value || !window.confirm('确认解散朝暮同笺？双方将立即失去访问权限。')) return;
  await run(async () => {
    await coupleLedgerApi.dissolve(ledger.value!.id, auth.accessToken);
    ledger.value = undefined;
    inviteToken.value = '';
    success.value = '情侣账本已解散。';
  });
}

onMounted(load);
</script>

<template>
  <main class="couple-shell">
    <header>
      <RouterLink to="/account">返回账号</RouterLink>
      <span>朝暮同笺</span>
    </header>

    <section v-if="loading" class="state" aria-live="polite">
      <strong>正在加载情侣账本…</strong>
      <p>正在确认成员关系与权限。</p>
    </section>

    <section v-else-if="forbidden" class="state">
      <strong>无权访问</strong>
      <p>你的成员关系可能已退出或账本已解散。</p>
      <button type="button" @click="load">重新检查</button>
    </section>

    <section v-else-if="error && !ledger" class="state">
      <strong>加载失败</strong>
      <p role="alert">{{ error }}</p>
      <button type="button" @click="load">重试</button>
    </section>

    <template v-else-if="ledger">
      <section class="hero-card">
        <p>共同记录</p>
        <h1>{{ ledger.name }}</h1>
        <span>{{ ledger.members.length }}/2 位成员</span>
      </section>

      <section class="card">
        <h2>成员</h2>
        <ul>
          <li v-for="member in ledger.members" :key="member.userId">
            <span class="avatar">{{ member.nickname.slice(0, 1) }}</span>
            <span
              ><strong>{{ member.nickname }}</strong
              ><small>{{ member.role === 'OWNER' ? '所有者' : '成员' }}</small></span
            >
          </li>
        </ul>
      </section>

      <section v-if="isOwner" class="card">
        <h2>账本设置</h2>
        <form @submit.prevent="saveName">
          <label>账本名称<input v-model.trim="name" maxlength="100" required /></label>
          <button :disabled="submitting" type="submit">保存名称</button>
        </form>
      </section>

      <section v-if="isOwner && !partner" class="card">
        <h2>邀请另一半</h2>
        <p>邀请有效期为 7 天，新邀请会使旧邀请失效。</p>
        <button :disabled="submitting" type="button" @click="createInvitation">生成邀请</button>
        <div v-if="inviteToken" class="token-box">
          <code>{{ inviteToken }}</code>
          <button type="button" @click="copyInvitation">复制</button>
        </div>
      </section>

      <section class="card danger-zone">
        <h2>成员关系</h2>
        <template v-if="isOwner">
          <button v-if="partner" :disabled="submitting" type="button" @click="transferOwnership">
            转移所有权
          </button>
          <button class="danger" :disabled="submitting" type="button" @click="dissolve">
            解散情侣账本
          </button>
        </template>
        <button v-else class="danger" :disabled="submitting" type="button" @click="leave">
          退出情侣账本
        </button>
      </section>
    </template>

    <section v-else class="empty-state">
      <p class="eyebrow">尚未加入朝暮同笺</p>
      <h1>从共同记录开始</h1>
      <p>创建一个情侣账本，或输入另一半发来的邀请码。</p>
      <form @submit.prevent="createLedger">
        <label>账本名称<input v-model.trim="name" maxlength="100" required /></label>
        <button :disabled="submitting" type="submit">创建情侣账本</button>
      </form>
      <div class="divider"><span>或</span></div>
      <form @submit.prevent="acceptInvitation">
        <label
          >邀请码<input v-model.trim="invitationToken" minlength="32" maxlength="256" required
        /></label>
        <button :disabled="submitting" type="submit">接受邀请</button>
      </form>
    </section>

    <p v-if="error && ledger" class="message error" role="alert">{{ error }}</p>
    <p v-if="success" class="message success" role="status">{{ success }}</p>
  </main>
</template>

<style scoped>
.couple-shell {
  width: min(100%, 480px);
  min-height: 100dvh;
  margin: 0 auto;
  padding: 0 16px 40px;
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
  color: var(--siyu-primary);
  text-decoration: none;
}
.hero-card,
.card,
.empty-state,
.state {
  padding: 20px;
  border: 1px solid var(--siyu-border);
  border-radius: 16px;
  background: var(--siyu-surface);
}
.hero-card {
  background: var(--siyu-primary);
  color: #fff;
}
.hero-card p,
.hero-card h1 {
  margin: 0 0 8px;
}
.hero-card span {
  color: rgb(255 255 255 / 78%);
}
.card {
  margin-top: 12px;
}
h2 {
  margin: 0 0 16px;
  font-size: 17px;
}
ul {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  align-items: center;
  gap: 12px;
}
li > span:last-child {
  display: grid;
  gap: 3px;
}
small,
.card p,
.state p,
.empty-state > p {
  color: var(--siyu-text-secondary);
}
.avatar {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 50%;
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
}
form {
  display: grid;
  gap: 12px;
}
label {
  display: grid;
  gap: 7px;
  font-weight: 600;
}
input {
  min-width: 0;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--siyu-border);
  border-radius: 10px;
  background: var(--siyu-page-bg);
  color: var(--siyu-text);
  font: inherit;
}
button {
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 12px;
  background: var(--siyu-primary);
  color: #fff;
  font: inherit;
  font-weight: 600;
}
button:disabled {
  opacity: 0.6;
}
.danger-zone {
  display: grid;
  gap: 10px;
}
.danger {
  background: var(--siyu-danger);
}
.token-box {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
code {
  overflow-wrap: anywhere;
  padding: 12px;
  border-radius: 10px;
  background: var(--siyu-page-bg);
}
.empty-state,
.state {
  margin-top: 16px;
}
.empty-state h1 {
  margin: 8px 0;
}
.eyebrow {
  color: var(--siyu-primary) !important;
  font-weight: 700;
}
.divider {
  display: flex;
  align-items: center;
  margin: 20px 0;
  color: var(--siyu-text-secondary);
}
.divider::before,
.divider::after {
  height: 1px;
  flex: 1;
  background: var(--siyu-border);
  content: '';
}
.divider span {
  padding: 0 12px;
}
.message {
  margin: 12px 0 0;
  padding: 12px;
  border-radius: 10px;
}
.error {
  color: var(--siyu-danger);
  background: var(--siyu-danger-soft, var(--siyu-primary-soft));
}
.success {
  color: var(--siyu-income);
  background: var(--siyu-primary-soft);
}
@media (max-width: 340px) {
  .couple-shell {
    padding-inline: 12px;
  }
  .hero-card,
  .card,
  .empty-state,
  .state {
    padding: 16px;
  }
}
</style>
