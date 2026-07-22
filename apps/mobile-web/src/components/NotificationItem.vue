<script setup lang="ts">
import {
  formatNotificationTime,
  notificationIsActionable,
  notificationTypeLabel,
  type Notification,
} from '../notifications';

defineProps<{ notification: Notification; busy?: boolean }>();
defineEmits<{ read: []; open: [] }>();
</script>

<template>
  <article class="notification-item" :class="{ unread: !notification.readAt }">
    <span class="notification-icon" aria-hidden="true">!</span>
    <button
      v-if="notificationIsActionable(notification)"
      type="button"
      class="notification-content actionable"
      :disabled="busy"
      @click="$emit('open')"
    >
      <span class="notification-heading">
        <strong>{{ notification.title }}</strong>
        <time :datetime="notification.createdAt">{{
          formatNotificationTime(notification.createdAt)
        }}</time>
      </span>
      <span class="notification-copy">{{ notification.content }}</span>
      <small>{{ notificationTypeLabel(notification.type) }} · 查看周期记账</small>
    </button>
    <div v-else class="notification-content">
      <span class="notification-heading">
        <strong>{{ notification.title }}</strong>
        <time :datetime="notification.createdAt">{{
          formatNotificationTime(notification.createdAt)
        }}</time>
      </span>
      <span class="notification-copy">{{ notification.content }}</span>
      <small>{{ notificationTypeLabel(notification.type) }}</small>
    </div>
    <button
      v-if="!notification.readAt"
      type="button"
      class="read-action"
      :disabled="busy"
      :aria-label="`标记“${notification.title}”为已读`"
      @click="$emit('read')"
    >
      {{ busy ? '处理中' : '已读' }}
    </button>
    <span v-else class="read-status">已读</span>
  </article>
</template>

<style scoped>
.notification-item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--siyu-border);
  border-radius: 14px;
  background: var(--siyu-surface);
}
.notification-item.unread {
  border-color: color-mix(in srgb, var(--siyu-primary) 42%, var(--siyu-border));
  background: color-mix(in srgb, var(--siyu-primary-soft) 48%, var(--siyu-surface));
}
.notification-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 50%;
  background: var(--siyu-warning);
  color: var(--siyu-surface);
  font-weight: 800;
}
.notification-content {
  display: grid;
  min-width: 0;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--siyu-text);
  text-align: left;
}
.notification-content.actionable {
  min-height: 44px;
  cursor: pointer;
}
.notification-heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.notification-heading strong,
.notification-copy,
.notification-content small {
  overflow-wrap: anywhere;
}
.notification-heading strong {
  font-size: 15px;
  line-height: 1.45;
}
.notification-heading time,
.notification-content small,
.read-status {
  color: var(--siyu-text-tertiary);
  font-size: 11px;
}
.notification-heading time {
  flex: 0 0 auto;
}
.notification-copy {
  color: var(--siyu-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.read-action {
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--siyu-primary);
}
.read-action:disabled,
.notification-content:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.read-status {
  display: grid;
  min-width: 44px;
  min-height: 44px;
  place-items: center;
}
button:focus-visible {
  outline: 3px solid var(--siyu-primary-soft);
  outline-offset: 2px;
}
@media (max-width: 350px) {
  .notification-item {
    grid-template-columns: 36px minmax(0, 1fr);
  }
  .read-action,
  .read-status {
    grid-column: 2;
    justify-self: start;
  }
  .notification-heading {
    display: grid;
  }
}
</style>
