import type { OpenApiComponents } from '@siyu/shared-types';

import { sessionApiRequest, type ApiSession } from './api';

export type Notification = OpenApiComponents['schemas']['Notification'];
export type NotificationListResult =
  OpenApiComponents['schemas']['NotificationListResponse']['data'];
export type MarkNotificationsReadRequest =
  OpenApiComponents['schemas']['MarkNotificationsReadRequest'];
export type MarkNotificationsReadResult =
  OpenApiComponents['schemas']['MarkNotificationsReadResponse']['data'];

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const READ_BATCH_SIZE = 100;

export function notificationTypeLabel(type: string): string {
  if (type === 'RECURRING_CONFIRMATION_DUE') return '周期提醒';
  return '站内通知';
}

export function notificationIsActionable(notification: Notification): boolean {
  return (
    notification.type === 'RECURRING_CONFIRMATION_DUE' &&
    notification.relatedType === 'RECURRING_RUN' &&
    Boolean(notification.relatedId)
  );
}

export function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function createNotificationsApi(session: ApiSession) {
  const api = {
    list(page = 1, pageSize = PAGE_SIZE, signal?: AbortSignal): Promise<NotificationListResult> {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      return sessionApiRequest(`/notifications?${query}`, session, signal ? { signal } : {});
    },
    async listAll(signal?: AbortSignal): Promise<{ items: Notification[]; unreadCount: number }> {
      const items: Notification[] = [];
      const seen = new Set<string>();
      let unreadCount = 0;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const result = await api.list(page, PAGE_SIZE, signal);
        if (page === 1) unreadCount = result.unreadCount;
        for (const item of result.items) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          items.push(item);
        }
        if (!result.hasNext) return { items, unreadCount };
      }
      throw new Error('通知过多，无法完整加载');
    },
    markRead(ids: string[]): Promise<MarkNotificationsReadResult> {
      return sessionApiRequest('/notifications/read', session, {
        method: 'POST',
        body: JSON.stringify({ ids } satisfies MarkNotificationsReadRequest),
      });
    },
    async markAllRead(ids: string[]): Promise<MarkNotificationsReadResult> {
      const uniqueIds = [...new Set(ids)];
      let markedCount = 0;
      let unreadCount = uniqueIds.length;
      for (let index = 0; index < uniqueIds.length; index += READ_BATCH_SIZE) {
        const result = await api.markRead(uniqueIds.slice(index, index + READ_BATCH_SIZE));
        markedCount += result.markedCount;
        unreadCount = result.unreadCount;
      }
      return { markedCount, unreadCount };
    },
  };
  return api;
}
