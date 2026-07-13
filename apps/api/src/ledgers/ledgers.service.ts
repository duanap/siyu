import { createHash, createHmac } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { readConfig } from '../config';
import { LedgersRepository } from './ledgers.repository';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function businessConflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function businessForbidden(code: string, message: string): ForbiddenException {
  return new ForbiddenException({ code, message });
}

function invisible(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: '账本不存在' });
}

interface LedgerRecord {
  id: string;
  type: string;
  name: string;
  ownerUserId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  members: Array<{
    userId: string;
    role: string;
    joinedAt: Date;
    user: { nickname: string; avatarUrl: string | null };
  }>;
}

interface InvitationRecord {
  id: string;
  ledgerId: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
}

function ledgerView(ledger: LedgerRecord): object {
  return {
    id: ledger.id,
    type: ledger.type,
    name: ledger.name,
    ownerUserId: ledger.ownerUserId,
    status: ledger.status,
    createdAt: ledger.createdAt,
    updatedAt: ledger.updatedAt,
    members: ledger.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      nickname: member.user.nickname,
      avatarUrl: member.user.avatarUrl,
    })),
  };
}

function invitationView(invitation: InvitationRecord): object {
  return {
    id: invitation.id,
    ledgerId: invitation.ledgerId,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
  };
}

@Injectable()
export class LedgersService {
  private readonly config = readConfig();

  constructor(@Inject(LedgersRepository) private readonly repository: LedgersRepository) {}

  private invitationToken(userId: string, ledgerId: string, idempotencyKey: string): string {
    return createHmac('sha256', this.config.jwtSecret)
      .update(`couple-invitation:${userId}:${ledgerId}:${idempotencyKey}`)
      .digest('base64url');
  }

  async list(userId: string): Promise<unknown[]> {
    return (await this.repository.listVisible(userId)).map(ledgerView);
  }

  async detail(userId: string, ledgerId: string): Promise<unknown> {
    const ledger = await this.repository.findVisible(userId, ledgerId);
    if (!ledger) throw invisible();
    return ledgerView(ledger);
  }

  async createCouple(
    userId: string,
    name: string,
    idempotencyKey: string,
    requestId: string,
  ): Promise<unknown> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:couple-user:${userId}`]);
      const replay = await this.repository.findLedgerByIdempotency(tx, userId, idempotencyKey);
      if (replay) {
        if (replay.type === 'COUPLE' && replay.name === name) return ledgerView(replay);
        throw businessConflict('IDEMPOTENCY_CONFLICT', '幂等键已用于不同的创建请求');
      }
      if (await this.repository.findActiveCoupleForUser(tx, userId)) {
        throw businessConflict('COUPLE_ALREADY_JOINED', '当前已加入一个情侣账本');
      }
      const ledger = await this.repository.createCouple(tx, userId, name, idempotencyKey);
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'COUPLE_LEDGER_CREATED',
        targetType: 'LEDGER',
        targetId: ledger.id,
        requestId,
        afterJson: { name },
      });
      return ledgerView(ledger);
    });
  }

  async updateCouple(
    userId: string,
    ledgerId: string,
    name: string,
    requestId: string,
  ): Promise<unknown> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:couple-ledger:${ledgerId}`]);
      const ledger = await this.repository.findOwnedCouple(tx, userId, ledgerId);
      if (!ledger) throw invisible();
      const updated = await this.repository.updateName(tx, ledgerId, name);
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'COUPLE_LEDGER_UPDATED',
        targetType: 'LEDGER',
        targetId: ledgerId,
        requestId,
        beforeJson: { name: ledger.name },
        afterJson: { name },
      });
      return ledgerView(updated);
    });
  }

  async createInvitation(
    userId: string,
    ledgerId: string,
    idempotencyKey: string,
    requestId: string,
  ): Promise<unknown> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:couple-ledger:${ledgerId}`]);
      const ledger = await this.repository.findOwnedCouple(tx, userId, ledgerId);
      if (!ledger) throw invisible();
      if (ledger.members.length >= 2) {
        throw businessConflict('COUPLE_LEDGER_FULL', '情侣账本已有两名成员');
      }
      const token = this.invitationToken(userId, ledgerId, idempotencyKey);
      const replay = await this.repository.findInvitationByIdempotency(tx, userId, idempotencyKey);
      if (replay) {
        if (replay.ledgerId !== ledgerId) {
          throw businessConflict('IDEMPOTENCY_CONFLICT', '幂等键已用于不同的邀请请求');
        }
        return { invitation: invitationView(replay), token };
      }
      await this.repository.revokePendingInvitations(tx, ledgerId);
      const invitation = await this.repository.createInvitation(tx, {
        ledgerId,
        inviterUserId: userId,
        tokenHash: digest(token),
        idempotencyKey,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'COUPLE_INVITATION_CREATED',
        targetType: 'LEDGER_INVITATION',
        targetId: invitation.id,
        requestId,
        afterJson: { ledgerId, expiresAt: invitation.expiresAt.toISOString() },
      });
      return { invitation: invitationView(invitation), token };
    });
  }

  async acceptInvitation(userId: string, token: string, requestId: string): Promise<unknown> {
    const tokenHash = digest(token);
    const outcome = await this.repository.transaction(async (tx) => {
      const initial = await this.repository.findInvitationByHash(tx, tokenHash);
      if (!initial) throw businessConflict('INVITATION_INVALID', '邀请无效');
      await this.repository.lock(tx, [
        `siyu:couple-ledger:${initial.ledgerId}`,
        `siyu:couple-user:${userId}`,
      ]);
      const invitation = await this.repository.findInvitationByHash(tx, tokenHash);
      if (!invitation || invitation.status !== 'PENDING') {
        throw businessConflict('INVITATION_INVALID', '邀请无效');
      }
      if (invitation.expiresAt <= new Date()) {
        await tx.ledgerInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
        return { invitationExpired: true as const };
      }
      if (invitation.ledger.status !== 'ACTIVE' || invitation.ledger.deletedAt) {
        throw businessConflict('INVITATION_INVALID', '邀请无效');
      }
      if (invitation.inviterUserId === userId) {
        throw businessConflict('INVITATION_SELF_ACCEPT', '不能接受自己创建的邀请');
      }
      if (await this.repository.findActiveCoupleForUser(tx, userId)) {
        throw businessConflict('COUPLE_ALREADY_JOINED', '当前已加入一个情侣账本');
      }
      if (invitation.ledger.members.length >= 2) {
        throw businessConflict('COUPLE_LEDGER_FULL', '情侣账本已有两名成员');
      }
      await this.repository.activateMember(tx, invitation.ledgerId, userId);
      await this.repository.acceptInvitation(tx, invitation.id, userId);
      await this.repository.revokePendingInvitations(tx, invitation.ledgerId);
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'COUPLE_INVITATION_ACCEPTED',
        targetType: 'LEDGER_INVITATION',
        targetId: invitation.id,
        requestId,
        afterJson: { ledgerId: invitation.ledgerId },
      });
      const ledger = await this.repository.findVisibleInTransaction(
        tx,
        userId,
        invitation.ledgerId,
      );
      if (!ledger) throw invisible();
      return ledgerView(ledger);
    });
    if ('invitationExpired' in outcome) {
      throw businessConflict('INVITATION_EXPIRED', '邀请已过期');
    }
    return outcome;
  }

  async leave(userId: string, ledgerId: string, requestId: string): Promise<void> {
    await this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [
        `siyu:couple-ledger:${ledgerId}`,
        `siyu:couple-user:${userId}`,
      ]);
      const member = await this.repository.findMembership(tx, ledgerId, userId);
      if (
        !member ||
        member.status !== 'ACTIVE' ||
        member.ledger.type !== 'COUPLE' ||
        member.ledger.status !== 'ACTIVE'
      ) {
        throw invisible();
      }
      if (member.role === 'OWNER') {
        throw businessForbidden(
          'COUPLE_OWNER_MUST_TRANSFER',
          '所有者必须先转移所有权，或直接解散账本',
        );
      }
      await this.repository.leaveMember(tx, member.id);
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'COUPLE_MEMBER_LEFT',
        targetType: 'LEDGER',
        targetId: ledgerId,
        requestId,
      });
    });
  }

  async transferOwnership(
    userId: string,
    ledgerId: string,
    targetUserId: string,
    requestId: string,
  ): Promise<unknown> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [
        `siyu:couple-ledger:${ledgerId}`,
        `siyu:couple-user:${targetUserId}`,
        `siyu:couple-user:${userId}`,
      ]);
      const ledger = await this.repository.findOwnedCouple(tx, userId, ledgerId);
      if (!ledger) throw invisible();
      const owner = ledger.members.find(
        (member) => member.userId === userId && member.role === 'OWNER',
      );
      const target = ledger.members.find(
        (member) => member.userId === targetUserId && member.role === 'MEMBER',
      );
      if (!owner || !target) {
        throw businessConflict('COUPLE_TRANSFER_TARGET_INVALID', '目标用户不是当前有效成员');
      }
      await this.repository.transferOwnership(tx, ledgerId, owner.id, target.id, targetUserId);
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'COUPLE_OWNERSHIP_TRANSFERRED',
        targetType: 'LEDGER',
        targetId: ledgerId,
        requestId,
        beforeJson: { ownerUserId: userId },
        afterJson: { ownerUserId: targetUserId },
      });
      const updated = await this.repository.findVisibleInTransaction(tx, userId, ledgerId);
      if (!updated) throw invisible();
      return ledgerView(updated);
    });
  }

  async dissolve(userId: string, ledgerId: string, requestId: string): Promise<void> {
    await this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:couple-ledger:${ledgerId}`]);
      const ledger = await this.repository.findOwnedCouple(tx, userId, ledgerId);
      if (!ledger) throw invisible();
      await this.repository.dissolve(tx, ledgerId);
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'COUPLE_LEDGER_DISSOLVED',
        targetType: 'LEDGER',
        targetId: ledgerId,
        requestId,
        beforeJson: { status: 'ACTIVE', memberCount: ledger.members.length },
        afterJson: { status: 'DISSOLVED' },
      });
    });
  }
}
