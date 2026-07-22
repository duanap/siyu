<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { isRequestCancelled } from '../api';
import AppEmpty from '../components/AppEmpty.vue';
import AppErrorState from '../components/AppErrorState.vue';
import AppPageHeader from '../components/AppPageHeader.vue';
import NotificationItem from '../components/NotificationItem.vue';
import { createNotificationsApi, type Notification } from '../notifications';
import { useApiSession } from '../use-api-session';

const router = useRouter();
const api = createNotificationsApi(useApiSession());
const notifications = ref<Notification[]>([]);
const unreadCount = ref(0);
const loading = ref(true);
const busy = ref(false);
const activeId = ref('');
const fatal = ref('');
const actionError = ref('');
let controller: AbortController | undefined;

const unreadIds = computed(() =>
  notifications.value
    .filter((notification) => !notification.readAt)
    .map((notification) => notification.id),
);

async function loadNotifications(initial = false) {
  controller?.abort();
  controller = new AbortController();
  if (initial) loading.value = true;
  fatal.value = '';
  try {
    const result = await api.listAll(controller.signal);
    notifications.value = result.items;
    unreadCount.value = result.unreadCount;
  } catch (cause) {
    if (!isRequestCancelled(cause))
      fatal.value = cause instanceof Error ? cause.message : '消息中心加载失败';
  } finally {
    loading.value = false;
  }
}

async function markIds(ids: string[], id = ''): Promise<boolean> {
  if (busy.value || ids.length === 0) return false;
  busy.value = true;
  activeId.value = id;
  actionError.value = '';
  try {
    await api.markAllRead(ids);
    await loadNotifications();
    return true;
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '标记已读失败';
    await loadNotifications();
    return false;
  } finally {
    busy.value = false;
    activeId.value = '';
  }
}

async function openNotification(notification: Notification) {
  if (!notification.readAt) await markIds([notification.id], notification.id);
  if (
    notification.type === 'RECURRING_CONFIRMATION_DUE' &&
    notification.relatedType === 'RECURRING_RUN'
  ) {
    await router.push('/recurring');
  }
}

onMounted(() => loadNotifications(true));
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <main class="business-page notifications-page">
    <AppPageHeader title="消息中心" back-label="返回" @back="router.push('/account')">
      <button
        v-if="unreadCount > 0 && !loading && !fatal"
        type="button"
        class="read-all"
        :disabled="busy"
        @click="markIds(unreadIds)"
      >
        {{ busy && !activeId ? '处理中' : '全部已读' }}
      </button>
    </AppPageHeader>
    <section v-if="loading" class="state-panel" aria-live="polite">正在加载消息…</section>
    <AppErrorState
      v-else-if="fatal"
      title="消息中心加载失败"
      :message="fatal"
      retry-label="重试"
      @retry="loadNotifications(true)"
    />
    <template v-else>
      <section class="notification-summary" aria-live="polite">
        <strong>{{ unreadCount ? `${unreadCount} 条未读` : '消息均已读' }}</strong>
        <span>仅展示属于你的站内通知</span>
      </section>
      <p v-if="actionError" class="inline-error" role="alert">{{ actionError }}</p>
      <AppEmpty
        v-if="!notifications.length"
        title="暂时没有消息"
        description="周期账目需要确认时，会在这里提醒你。"
      />
      <section v-else class="notification-list" aria-label="站内通知列表">
        <NotificationItem
          v-for="notification in notifications"
          :key="notification.id"
          :notification="notification"
          :busy="busy && (activeId === notification.id || !activeId)"
          @read="markIds([notification.id], notification.id)"
          @open="openNotification(notification)"
        />
      </section>
      <p class="scope-copy">通知关联只用于导航，目标页面仍会重新校验当前权限。</p>
    </template>
  </main>
</template>

<style scoped>
.notifications-page {
  display: grid;
  align-content: start;
  gap: 16px;
}
.read-all {
  min-width: 68px;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--siyu-primary);
}
.read-all:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.notification-summary {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  background: var(--siyu-primary-soft);
}
.notification-summary strong {
  color: var(--siyu-primary);
  font-size: 18px;
}
.notification-summary span,
.scope-copy {
  color: var(--siyu-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.notification-list {
  display: grid;
  gap: 12px;
}
.scope-copy {
  margin: 0;
  text-align: center;
}
@media (max-width: 350px) {
  .notification-summary {
    display: grid;
  }
}
</style>
