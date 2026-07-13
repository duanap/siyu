import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

const ledgerInclude = {
  members: {
    where: { status: 'ACTIVE' as const },
    orderBy: { joinedAt: 'asc' as const },
    select: {
      id: true,
      userId: true,
      role: true,
      joinedAt: true,
      user: { select: { nickname: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.LedgerInclude;

type Tx = Prisma.TransactionClient;

@Injectable()
export class LedgersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }

  async lock(tx: Tx, keys: string[]): Promise<void> {
    for (const key of [...new Set(keys)].sort()) {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
    }
  }

  listVisible(userId: string) {
    return this.prisma.ledger.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        members: { some: { userId, status: 'ACTIVE' } },
      },
      include: ledgerInclude,
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findVisible(userId: string, ledgerId: string) {
    return this.prisma.ledger.findFirst({
      where: {
        id: ledgerId,
        status: 'ACTIVE',
        deletedAt: null,
        members: { some: { userId, status: 'ACTIVE' } },
      },
      include: ledgerInclude,
    });
  }

  findVisibleInTransaction(tx: Tx, userId: string, ledgerId: string) {
    return tx.ledger.findFirst({
      where: {
        id: ledgerId,
        status: 'ACTIVE',
        deletedAt: null,
        members: { some: { userId, status: 'ACTIVE' } },
      },
      include: ledgerInclude,
    });
  }

  findOwnedCouple(tx: Tx, userId: string, ledgerId: string) {
    return tx.ledger.findFirst({
      where: {
        id: ledgerId,
        type: 'COUPLE',
        ownerUserId: userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: ledgerInclude,
    });
  }

  findActiveCoupleForUser(tx: Tx, userId: string) {
    return tx.ledgerMember.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        ledger: { type: 'COUPLE', status: 'ACTIVE', deletedAt: null },
      },
      include: { ledger: true },
    });
  }

  findLedgerByIdempotency(tx: Tx, userId: string, idempotencyKey: string) {
    return tx.ledger.findFirst({
      where: { ownerUserId: userId, idempotencyKey },
      include: ledgerInclude,
    });
  }

  createCouple(tx: Tx, userId: string, name: string, idempotencyKey: string) {
    return tx.ledger.create({
      data: {
        type: 'COUPLE',
        name,
        ownerUserId: userId,
        idempotencyKey,
        members: { create: { userId, role: 'OWNER' } },
      },
      include: ledgerInclude,
    });
  }

  updateName(tx: Tx, ledgerId: string, name: string) {
    return tx.ledger.update({ where: { id: ledgerId }, data: { name }, include: ledgerInclude });
  }

  findInvitationByIdempotency(tx: Tx, userId: string, idempotencyKey: string) {
    return tx.ledgerInvitation.findFirst({ where: { inviterUserId: userId, idempotencyKey } });
  }

  revokePendingInvitations(tx: Tx, ledgerId: string) {
    return tx.ledgerInvitation.updateMany({
      where: { ledgerId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
  }

  createInvitation(
    tx: Tx,
    input: {
      ledgerId: string;
      inviterUserId: string;
      tokenHash: string;
      idempotencyKey: string;
      expiresAt: Date;
    },
  ) {
    return tx.ledgerInvitation.create({ data: input });
  }

  findInvitationByHash(tx: Tx, tokenHash: string) {
    return tx.ledgerInvitation.findUnique({
      where: { tokenHash },
      include: { ledger: { include: ledgerInclude } },
    });
  }

  findMembership(tx: Tx, ledgerId: string, userId: string) {
    return tx.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId, userId } },
      include: { ledger: true },
    });
  }

  activateMember(tx: Tx, ledgerId: string, userId: string) {
    return tx.ledgerMember.upsert({
      where: { ledgerId_userId: { ledgerId, userId } },
      create: { ledgerId, userId, role: 'MEMBER' },
      update: { role: 'MEMBER', status: 'ACTIVE', joinedAt: new Date(), leftAt: null },
    });
  }

  acceptInvitation(tx: Tx, invitationId: string, userId: string) {
    return tx.ledgerInvitation.update({
      where: { id: invitationId },
      data: { status: 'ACCEPTED', acceptedByUserId: userId, acceptedAt: new Date() },
    });
  }

  leaveMember(tx: Tx, memberId: string) {
    return tx.ledgerMember.update({
      where: { id: memberId },
      data: { status: 'LEFT', leftAt: new Date() },
    });
  }

  async transferOwnership(
    tx: Tx,
    ledgerId: string,
    ownerMemberId: string,
    targetMemberId: string,
    targetUserId: string,
  ): Promise<void> {
    await tx.ledgerMember.update({ where: { id: ownerMemberId }, data: { role: 'MEMBER' } });
    await tx.ledgerMember.update({ where: { id: targetMemberId }, data: { role: 'OWNER' } });
    await tx.ledger.update({ where: { id: ledgerId }, data: { ownerUserId: targetUserId } });
  }

  async dissolve(tx: Tx, ledgerId: string): Promise<void> {
    const now = new Date();
    await tx.ledger.update({
      where: { id: ledgerId },
      data: { status: 'DISSOLVED', deletedAt: now },
    });
    await tx.ledgerMember.updateMany({
      where: { ledgerId, status: 'ACTIVE' },
      data: { status: 'LEFT', leftAt: now },
    });
    await tx.ledgerInvitation.updateMany({
      where: { ledgerId, status: 'PENDING' },
      data: { status: 'REVOKED' },
    });
  }

  audit(
    tx: Tx,
    input: {
      actorUserId: string;
      action: string;
      targetType: string;
      targetId: string;
      requestId?: string;
      beforeJson?: Prisma.InputJsonValue;
      afterJson?: Prisma.InputJsonValue;
    },
  ) {
    return tx.auditLog.create({ data: { actorType: 'USER', ...input } });
  }
}
