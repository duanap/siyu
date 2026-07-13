import { apiRequest } from './api';

export interface LedgerMember {
  userId: string;
  role: 'OWNER' | 'MEMBER';
  joinedAt: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface Ledger {
  id: string;
  type: 'PERSONAL' | 'COUPLE';
  name: string;
  ownerUserId: string;
  status: 'ACTIVE' | 'DISSOLVED';
  members: LedgerMember[];
}

interface LedgerList {
  items: Ledger[];
}

interface InvitationResult {
  invitation: { id: string; ledgerId: string; status: string; expiresAt: string };
  token: string;
}

function idempotencyKey(scope: string): string {
  return `${scope}-${crypto.randomUUID()}`;
}

export const coupleLedgerApi = {
  async list(accessToken?: string): Promise<Ledger[]> {
    return (await apiRequest<LedgerList>('/ledgers', accessToken)).items;
  },

  create(name: string, accessToken?: string): Promise<Ledger> {
    return apiRequest('/couple-ledgers', accessToken, {
      method: 'POST',
      body: JSON.stringify({ name, idempotencyKey: idempotencyKey('ledger') }),
    });
  },

  update(id: string, name: string, accessToken?: string): Promise<Ledger> {
    return apiRequest(`/couple-ledgers/${id}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  invite(id: string, accessToken?: string): Promise<InvitationResult> {
    return apiRequest(`/couple-ledgers/${id}/invitations`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey: idempotencyKey('invitation') }),
    });
  },

  accept(token: string, accessToken?: string): Promise<Ledger> {
    return apiRequest('/couple-invitations/accept', accessToken, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  transfer(id: string, targetUserId: string, accessToken?: string): Promise<Ledger> {
    return apiRequest(`/couple-ledgers/${id}/transfer-ownership`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  leave(id: string, accessToken?: string): Promise<void> {
    return apiRequest(`/couple-ledgers/${id}/leave`, accessToken, { method: 'POST' });
  },

  dissolve(id: string, accessToken?: string): Promise<void> {
    return apiRequest(`/couple-ledgers/${id}`, accessToken, { method: 'DELETE' });
  },
};
