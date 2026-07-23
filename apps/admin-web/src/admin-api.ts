export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export async function adminRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/v1/admin${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !body.success || body.data === undefined) {
    throw new Error(body.message || '管理端请求失败');
  }
  return body.data;
}

export interface AdminOverview {
  activeUsers: number;
  disabledUsers: number;
  activeLedgers: number;
  failedRuns: number;
  activeSessions: number;
}

export interface AdminUser {
  id: string;
  nickname: string;
  emailMasked: string | null;
  status: 'ACTIVE' | 'DISABLED';
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminLedger {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  members: Array<{
    userId: string;
    nickname: string;
    emailMasked: string | null;
    userStatus: string;
    role: string;
    status: string;
  }>;
}

export interface AdminRun {
  id: string;
  ruleId: string;
  ruleName: string;
  ownerNickname: string;
  scheduledDate: string;
  status: string;
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
}

export interface AdminAudit {
  id: string;
  actorType: string;
  actor: { id: string; nickname: string; emailMasked: string | null } | null;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string | null;
  createdAt: string;
}
