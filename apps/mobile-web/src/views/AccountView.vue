<script setup lang="ts">
import {
  BellOutlined,
  BgColorsOutlined,
  DollarOutlined,
  DownloadOutlined,
  FlagOutlined,
  HeartOutlined,
  LogoutOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
  TagsOutlined,
  WalletOutlined,
} from '@ant-design/icons-vue';
import { Switch as AntSwitch } from 'ant-design-vue';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '../auth';
import AppBottomNav from '../components/AppBottomNav.vue';
import { listLedgers } from '../entry-resources';
import { createNotificationsApi } from '../notifications';
import { useAmountPrivacy } from '../privacy';
import { readThemePreference, setThemePreference, type ThemePreference } from '../theme';
import { useApiSession } from '../use-api-session';

const auth = useAuthStore();
const router = useRouter();
const session = useApiSession();
const notificationsApi = createNotificationsApi(session);
const { amountHidden, setAmountHidden } = useAmountPrivacy();
const themePreference = ref<ThemePreference>(readThemePreference());
const hasCoupleLedger = ref(false);
const unreadCount = ref(0);
const supportLoading = ref(true);
const supportError = ref('');
const logoutBusy = ref(false);

const initials = computed(() => auth.user?.nickname?.trim().slice(0, 1).toUpperCase() || '余');
const maskedEmail = computed(() => {
  const email = auth.user?.email;
  if (!email) return 'QQ 账号';
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${name.length > 2 ? '***' : '*'}@${domain}`;
});

const groups = computed(() => [
  {
    title: '共同生活',
    items: [
      {
        label: '朝暮同笺',
        description: hasCoupleLedger.value ? '已连接共同账本' : '邀请伴侣建立共同账本',
        to: '/couple/invite',
        icon: HeartOutlined,
      },
      {
        label: '收支分类',
        description: '管理个人与共同账本分类',
        to: '/categories',
        icon: TagsOutlined,
      },
    ],
  },
  {
    title: '财务计划',
    items: [
      {
        label: '个人借贷',
        description: '负债、待收款与到期记录',
        to: '/debts',
        icon: WalletOutlined,
      },
      {
        label: '周期记账',
        description: '房租、话费和固定收支',
        to: '/recurring',
        icon: SyncOutlined,
      },
      {
        label: '工资记录',
        description: '工资、社保、公积金与个税',
        to: '/salary',
        icon: DollarOutlined,
      },
      {
        label: '攒钱目标',
        description: '个人与共同目标进度',
        to: '/saving-goals',
        icon: FlagOutlined,
      },
    ],
  },
  {
    title: '数据与安全',
    items: [
      {
        label: '消息中心',
        description: unreadCount.value ? `${unreadCount.value} 条未读` : '周期账目与站内提醒',
        to: '/notifications',
        icon: BellOutlined,
        badge: unreadCount.value,
      },
      {
        label: '数据导出',
        description: '导出可见账目与本人工资 CSV',
        to: '/exports',
        icon: DownloadOutlined,
      },
    ],
  },
]);

async function loadSupportingData(): Promise<void> {
  supportLoading.value = true;
  supportError.value = '';
  const [ledgerResult, notificationResult] = await Promise.allSettled([
    listLedgers(session),
    notificationsApi.list(1, 1),
  ]);
  let failed = 0;
  if (ledgerResult.status === 'fulfilled')
    hasCoupleLedger.value = ledgerResult.value.some((ledger) => ledger.type === 'COUPLE');
  else failed += 1;
  if (notificationResult.status === 'fulfilled')
    unreadCount.value = notificationResult.value.unreadCount;
  else failed += 1;
  supportError.value = failed ? '部分账号状态暂时无法读取' : '';
  supportLoading.value = false;
}

function selectTheme(preference: ThemePreference): void {
  themePreference.value = preference;
  setThemePreference(preference);
}

function updateAmountHidden(checked: boolean | string | number): void {
  setAmountHidden(checked === true);
}

async function logout(): Promise<void> {
  if (logoutBusy.value) return;
  logoutBusy.value = true;
  try {
    await auth.logout();
    await router.replace('/login');
  } finally {
    logoutBusy.value = false;
  }
}

onMounted(loadSupportingData);
</script>

<template>
  <main class="business-page account-page">
    <header class="account-header">
      <p class="eyebrow">我的</p>
      <h1>安心管理每一项生活记录</h1>
    </header>

    <section class="profile-card surface-card" aria-label="当前账号资料">
      <img
        v-if="auth.user?.avatarUrl"
        class="avatar"
        :src="auth.user.avatarUrl"
        :alt="`${auth.user.nickname}的头像`"
      />
      <span v-else class="avatar avatar-fallback" aria-hidden="true">{{ initials }}</span>
      <div>
        <h2>{{ auth.user?.nickname || '四时有余用户' }}</h2>
        <p>{{ maskedEmail }}</p>
        <small>{{ hasCoupleLedger ? '朝暮同笺已连接' : '个人账本已就绪' }}</small>
      </div>
    </section>

    <p v-if="supportLoading" class="support-state" aria-live="polite">正在同步账号状态…</p>
    <p v-else-if="supportError" class="support-state warning" role="status">
      {{ supportError }}
      <button type="button" @click="loadSupportingData">重试</button>
    </p>

    <section v-for="group in groups" :key="group.title" class="settings-section">
      <h2>{{ group.title }}</h2>
      <div class="settings-list surface-card">
        <RouterLink v-for="item in group.items" :key="item.label" :to="item.to">
          <span class="setting-icon" aria-hidden="true"><component :is="item.icon" /></span>
          <span class="setting-copy">
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </span>
          <span v-if="item.badge" class="unread-badge" :aria-label="`${item.badge}条未读`">{{
            item.badge > 99 ? '99+' : item.badge
          }}</span>
          <RightOutlined class="setting-arrow" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>

    <section class="settings-section" aria-labelledby="appearance-title">
      <h2 id="appearance-title">外观与隐私</h2>
      <div class="appearance-card surface-card">
        <div class="appearance-heading">
          <span class="setting-icon" aria-hidden="true"><BgColorsOutlined /></span>
          <span>
            <strong>主题外观</strong>
            <small>选择最适合当前环境的显示方式</small>
          </span>
        </div>
        <div class="theme-options" aria-label="主题模式">
          <button
            v-for="item in [
              { value: 'light', label: '日间' },
              { value: 'dark', label: '夜间' },
              { value: 'system', label: '跟随系统' },
            ] as const"
            :key="item.value"
            type="button"
            :aria-pressed="themePreference === item.value"
            @click="selectTheme(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
        <div class="privacy-row">
          <span class="setting-icon" aria-hidden="true"><SafetyCertificateOutlined /></span>
          <span class="setting-copy">
            <strong>默认隐藏金额</strong>
            <small>首页金额将在这台设备上保持隐藏</small>
          </span>
          <AntSwitch
            :checked="amountHidden"
            aria-label="默认隐藏首页金额"
            @change="updateAmountHidden"
          />
        </div>
      </div>
    </section>

    <button class="logout-button" type="button" :disabled="logoutBusy" @click="logout">
      <LogoutOutlined aria-hidden="true" />
      {{ logoutBusy ? '正在退出…' : '退出登录' }}
    </button>
    <p class="account-footnote">个人工资、社保、医保、公积金和借贷仅本人可见。</p>
  </main>
  <AppBottomNav active="profile" />
</template>

<style scoped>
.account-page {
  padding-top: max(20px, env(safe-area-inset-top));
}
.account-header {
  margin-bottom: 18px;
}
.account-header .eyebrow {
  margin: 0;
  color: var(--siyu-primary);
  font-size: 13px;
  font-weight: 700;
}
.account-header h1 {
  margin: 6px 0 0;
  font-size: 24px;
  line-height: 1.3;
}
.profile-card {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  min-height: 104px;
}
.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-fallback {
  display: grid;
  place-items: center;
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-size: 24px;
  font-weight: 800;
}
.profile-card h2,
.profile-card p {
  margin: 0;
}
.profile-card h2 {
  overflow: hidden;
  font-size: 19px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-card p,
.profile-card small {
  display: block;
  margin-top: 5px;
  overflow-wrap: anywhere;
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.support-state {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 4px 0 -8px;
  color: var(--siyu-text-tertiary);
  font-size: 12px;
}
.support-state.warning {
  color: var(--siyu-warning);
}
.support-state button {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--siyu-primary);
}
.settings-section {
  margin-top: 24px;
}
.settings-section > h2 {
  margin: 0 4px 10px;
  color: var(--siyu-text-secondary);
  font-size: 13px;
  font-weight: 600;
}
.settings-list {
  padding-top: 0;
  padding-bottom: 0;
}
.settings-list > a {
  display: grid;
  min-height: 68px;
  grid-template-columns: 40px minmax(0, 1fr) auto 16px;
  align-items: center;
  gap: 12px;
  color: var(--siyu-text);
  text-decoration: none;
}
.settings-list > a + a {
  border-top: 1px solid var(--siyu-border);
}
.setting-icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--siyu-primary-soft);
  color: var(--siyu-primary);
  font-size: 20px;
}
.setting-copy {
  min-width: 0;
}
.setting-copy strong,
.setting-copy small {
  display: block;
}
.setting-copy strong {
  font-size: 14px;
}
.setting-copy small {
  margin-top: 4px;
  overflow: hidden;
  color: var(--siyu-text-secondary);
  font-size: 11px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.setting-arrow {
  color: var(--siyu-text-tertiary);
  font-size: 13px;
}
.unread-badge {
  display: grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--siyu-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.appearance-card {
  display: grid;
  gap: 18px;
}
.appearance-heading,
.privacy-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}
.appearance-heading > span:last-child strong,
.appearance-heading > span:last-child small {
  display: block;
}
.appearance-heading small {
  margin-top: 4px;
  color: var(--siyu-text-secondary);
  font-size: 11px;
}
.theme-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border-radius: 12px;
  background: var(--siyu-secondary-bg);
}
.theme-options button {
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--siyu-text-secondary);
  font-size: 12px;
}
.theme-options button[aria-pressed='true'] {
  background: var(--siyu-surface);
  color: var(--siyu-primary);
  font-weight: 700;
}
.privacy-row {
  padding-top: 18px;
  border-top: 1px solid var(--siyu-border);
}
.privacy-row :deep(.ant-switch) {
  min-width: 52px;
  height: 44px;
}
.privacy-row :deep(.ant-switch-handle) {
  top: 11px;
  inset-inline-start: 8px;
  width: 20px;
  height: 20px;
}
.privacy-row :deep(.ant-switch-checked .ant-switch-handle) {
  inset-inline-start: calc(100% - 28px);
}
.logout-button {
  display: flex;
  width: 100%;
  min-height: 52px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 28px;
  border: 1px solid var(--siyu-border);
  border-radius: 14px;
  background: var(--siyu-surface);
  color: var(--siyu-danger);
  font-weight: 700;
}
.logout-button:disabled {
  opacity: 0.55;
}
.account-footnote {
  margin: 16px 4px 0;
  color: var(--siyu-text-tertiary);
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}
@media (max-width: 340px) {
  .account-header h1 {
    font-size: 22px;
  }
  .profile-card {
    grid-template-columns: 56px minmax(0, 1fr);
  }
  .avatar {
    width: 56px;
    height: 56px;
  }
  .settings-list > a {
    grid-template-columns: 36px minmax(0, 1fr) auto 12px;
    gap: 9px;
  }
  .setting-icon {
    width: 36px;
    height: 36px;
  }
  .theme-options button {
    padding-inline: 4px;
    font-size: 11px;
  }
}
</style>
