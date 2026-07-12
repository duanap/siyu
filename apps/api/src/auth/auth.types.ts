import type { Request } from 'express';

export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  auth: AuthPrincipal;
  requestId: string;
}

export interface AuthTokenData {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    nickname: string;
    avatarUrl: string | null;
    timezone: string;
    status: string;
    email: string | null;
    roles: string[];
    permissions: string[];
  };
}
