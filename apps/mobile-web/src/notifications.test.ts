import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiSession } from './api';
import {
  createNotificationsApi,
  formatNotificationTime,
  notificationIsActionable,
  notificationTypeLabel,
  type Notification,
} from './notifications';

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, requestId: 'request-1' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const session: ApiSession = {
  accessToken: () => 'token',
  refresh: vi.fn(),
  expire: vi.fn(),
};

function notification(id: string): Notification {
  return {
    id,
    type: 'RECURRING_CONFIRMATION_DUE',
    title: '周期账目待确认',
    content: '房租已到期，请确认本期账目。',
    relatedType: 'RECURRING_RUN',
    relatedId: '00000000-0000-4000-8000-000000000099',
    readAt: null,
    createdAt: '2026-07-22T08:00:00.000Z',
  };
}

describe('notifications client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads every stable page, removes duplicates and keeps the server unread total', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        return Promise.resolve(
          ok(
            url.includes('page=1')
              ? {
                  items: [notification('00000000-0000-4000-8000-000000000001')],
                  page: 1,
                  pageSize: 100,
                  total: 2,
                  hasNext: true,
                  unreadCount: 2,
                }
              : {
                  items: [
                    notification('00000000-0000-4000-8000-000000000001'),
                    notification('00000000-0000-4000-8000-000000000002'),
                  ],
                  page: 2,
                  pageSize: 100,
                  total: 2,
                  hasNext: false,
                  unreadCount: 2,
                },
          ),
        );
      }),
    );

    const result = await createNotificationsApi(session).listAll();

    expect(result.items.map((item) => item.id)).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    ]);
    expect(result.unreadCount).toBe(2);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('page=2');
  });

  it('marks more than 100 unread notifications in bounded unique batches', async () => {
    const bodies: Array<{ ids: string[] }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { ids: string[] };
        bodies.push(body);
        return Promise.resolve(
          ok({ markedCount: body.ids.length, unreadCount: 101 - body.ids.length }),
        );
      }),
    );
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );

    const result = await createNotificationsApi(session).markAllRead([...ids, ids[0]!]);

    expect(bodies.map((body) => body.ids.length)).toEqual([100, 1]);
    expect(result.markedCount).toBe(101);
  });

  it('maps only approved recurring notifications to an action and safely formats unknown types', () => {
    const recurring = notification('00000000-0000-4000-8000-000000000001');
    expect(notificationIsActionable(recurring)).toBe(true);
    expect(notificationIsActionable({ ...recurring, type: 'UNKNOWN' })).toBe(false);
    expect(notificationTypeLabel('UNKNOWN')).toBe('站内通知');
    expect(formatNotificationTime('invalid')).toBe('时间未知');
  });
});
