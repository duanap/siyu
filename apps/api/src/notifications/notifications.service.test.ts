import { describe, expect, it, vi } from 'vitest';

import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

const userId = '00000000-0000-4000-8000-000000000001';
const notificationId = '00000000-0000-4000-8000-000000000010';

function repositoryMock() {
  return {
    transaction: vi.fn(async (work: (tx: object) => Promise<unknown>) => work({})),
    findActor: vi.fn(async () => ({ id: userId, status: 'ACTIVE' })),
    list: vi.fn(async () => ({
      items: [
        {
          id: notificationId,
          userId,
          type: 'RECURRING_CONFIRMATION_DUE',
          title: '周期账目待确认',
          content: '房租已到期，请确认本期账目。',
          relatedType: 'RECURRING_RUN',
          relatedId: '00000000-0000-4000-8000-000000000020',
          readAt: null,
          createdAt: new Date('2026-07-22T08:00:00.000Z'),
        },
      ],
      total: 3,
      unreadCount: 2,
    })),
    markRead: vi.fn(async () => ({ count: 1 })),
    unreadCount: vi.fn(async () => 1),
  };
}

describe('TASK-021 notifications', () => {
  it('returns stable pagination metadata and the cross-page unread total', async () => {
    const repository = repositoryMock();
    const service = new NotificationsService(repository as unknown as NotificationsRepository);

    await expect(service.list(userId, { page: 1, pageSize: 2 })).resolves.toEqual({
      items: [
        {
          id: notificationId,
          type: 'RECURRING_CONFIRMATION_DUE',
          title: '周期账目待确认',
          content: '房租已到期，请确认本期账目。',
          relatedType: 'RECURRING_RUN',
          relatedId: '00000000-0000-4000-8000-000000000020',
          readAt: null,
          createdAt: '2026-07-22T08:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 2,
      total: 3,
      hasNext: true,
      unreadCount: 2,
    });
    expect(repository.list).toHaveBeenCalledWith({}, userId, { page: 1, pageSize: 2 });
  });

  it('marks only repository-authorized unread rows and returns the remaining unread count', async () => {
    const repository = repositoryMock();
    const service = new NotificationsService(repository as unknown as NotificationsRepository);
    const ids = [notificationId, '00000000-0000-4000-8000-000000000099'];

    await expect(service.markRead(userId, { ids })).resolves.toEqual({
      markedCount: 1,
      unreadCount: 1,
    });
    expect(repository.markRead).toHaveBeenCalledWith({}, userId, ids, expect.any(Date));
  });

  it('rejects notification access for an inactive actor', async () => {
    const repository = repositoryMock();
    repository.findActor.mockResolvedValue({ id: userId, status: 'DISABLED' });
    const service = new NotificationsService(repository as unknown as NotificationsRepository);

    await expect(service.list(userId, { page: 1, pageSize: 20 })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NOTIFICATION_PERMISSION_DENIED' }),
    });
    expect(repository.list).not.toHaveBeenCalled();
  });
});
