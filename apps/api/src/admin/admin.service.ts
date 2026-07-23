import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { dateOnly } from '../recurring/recurring.dates';
import { RecurringService } from '../recurring/recurring.service';
import type {
  AdminAuditQueryDto,
  AdminLedgersQueryDto,
  AdminRunsQueryDto,
  AdminUsersQueryDto,
  AdminUserStatusDto,
} from './admin.dto';

function page<T>(items: T[], total: number, input: { page: number; pageSize: number }) {
  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    total,
    hasNext: input.page * input.pageSize < total,
  };
}

function maskEmail(email?: string | null): string | null {
  if (!email) return null;
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RecurringService) private readonly recurring: RecurringService,
  ) {}

  async overview(): Promise<object> {
    const [activeUsers, disabledUsers, activeLedgers, failedRuns, activeSessions] =
      await Promise.all([
        this.prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        this.prisma.user.count({ where: { status: 'DISABLED', deletedAt: null } }),
        this.prisma.ledger.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        this.prisma.recurringRun.count({ where: { status: 'FAILED' } }),
        this.prisma.authSession.count({
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
        }),
      ]);
    return { activeUsers, disabledUsers, activeLedgers, failedRuns, activeSessions };
  }

  async listUsers(input: AdminUsersQueryDto): Promise<object> {
    const search = input.search?.trim();
    const searchById = search?.match(/^[0-9a-f-]{36}$/i) ? [{ id: search }] : [];
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
      ...(search
        ? {
            OR: [
              ...searchById,
              { nickname: { contains: search, mode: 'insensitive' } },
              { credential: { emailNormalized: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { credential: true, userRoles: { include: { role: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return page(
      items.map((item) => ({
        id: item.id,
        nickname: item.nickname,
        emailMasked: maskEmail(item.credential?.emailNormalized),
        status: item.status,
        roles: item.userRoles.map(({ role }) => role.code).sort(),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total,
      input,
    );
  }

  async setUserStatus(
    actorUserId: string,
    userId: string,
    input: AdminUserStatusDto,
    requestId: string,
  ): Promise<object> {
    if (actorUserId === userId && input.status === 'DISABLED') {
      throw new ConflictException({
        code: 'ADMIN_SELF_DISABLE_FORBIDDEN',
        message: '不能停用当前管理员账号',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('siyu:admin-user-status', 0))`;
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`siyu:admin-user:${userId}`}, 0))`;
      const user = await tx.user.findFirst({ where: { id: userId, deletedAt: null } });
      if (!user) throw new NotFoundException('用户不存在');
      if (input.status === 'DISABLED') {
        const targetIsAdmin = await tx.userRole.findUnique({
          where: {
            userId_roleId: {
              userId,
              roleId: '10000000-0000-0000-0000-000000000002',
            },
          },
        });
        if (targetIsAdmin) {
          const activeAdminCount = await tx.user.count({
            where: {
              status: 'ACTIVE',
              deletedAt: null,
              userRoles: {
                some: { roleId: '10000000-0000-0000-0000-000000000002' },
              },
            },
          });
          if (activeAdminCount <= 1) {
            throw new ConflictException({
              code: 'ADMIN_LAST_ACTIVE_FORBIDDEN',
              message: '不能停用最后一个活跃管理员',
            });
          }
        }
      }
      const now = new Date();
      if (input.status === 'DISABLED') {
        await tx.refreshToken.updateMany({
          where: { session: { userId }, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.authSession.updateMany({
          where: { userId, status: 'ACTIVE' },
          data: { status: 'REVOKED', revokedAt: now, revokeReason: 'ADMIN_USER_DISABLED' },
        });
      }
      const updated =
        user.status === input.status
          ? user
          : await tx.user.update({ where: { id: userId }, data: { status: input.status } });
      await tx.auditLog.create({
        data: {
          actorUserId,
          actorType: 'USER',
          action: 'ADMIN_USER_STATUS_CHANGED',
          targetType: 'USER',
          targetId: userId,
          requestId,
          beforeJson: { status: user.status },
          afterJson: { status: updated.status, reason: input.reason.trim() },
        },
      });
      return { id: updated.id, status: updated.status, changed: user.status !== updated.status };
    });
  }

  async listLedgers(input: AdminLedgersQueryDto): Promise<object> {
    const where: Prisma.LedgerWhereInput = {
      deletedAt: null,
      ...(input.type ? { type: input.type } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.ledger.findMany({
        where,
        include: {
          members: {
            include: { user: { include: { credential: true } } },
            orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.ledger.count({ where }),
    ]);
    return page(
      items.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        status: item.status,
        createdAt: item.createdAt,
        members: item.members.map((member) => ({
          userId: member.userId,
          nickname: member.user.nickname,
          emailMasked: maskEmail(member.user.credential?.emailNormalized),
          userStatus: member.user.status,
          role: member.role,
          status: member.status,
          joinedAt: member.joinedAt,
        })),
      })),
      total,
      input,
    );
  }

  async listRuns(input: AdminRunsQueryDto): Promise<object> {
    const where: Prisma.RecurringRunWhereInput = input.status ? { status: input.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.recurringRun.findMany({
        where,
        include: { rule: { include: { owner: true, ledger: true } } },
        orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.recurringRun.count({ where }),
    ]);
    return page(
      items.map((item) => ({
        id: item.id,
        ruleId: item.ruleId,
        ruleName: item.rule.name,
        ownerUserId: item.rule.ownerUserId,
        ownerNickname: item.rule.owner.nickname,
        ledgerId: item.rule.ledgerId,
        ledgerType: item.rule.ledger.type,
        scheduledDate: dateOnly(item.scheduledDate),
        status: item.status,
        attempts: item.attempts,
        lastError: item.lastError,
        lastAttemptAt: item.lastAttemptAt,
        createdAt: item.createdAt,
      })),
      total,
      input,
    );
  }

  async retryRun(
    actorUserId: string,
    runId: string,
    reason: string,
    requestId: string,
  ): Promise<object> {
    const run = await this.prisma.recurringRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException('周期任务不存在');
    if (run.status !== 'FAILED') {
      throw new ConflictException({
        code: 'ADMIN_RETRY_STATE_CONFLICT',
        message: '只有失败任务可以人工重试',
      });
    }
    try {
      const result = await this.recurring.materializeScheduledRule(
        run.ruleId,
        dateOnly(run.scheduledDate),
      );
      if (!result) {
        throw new ConflictException({
          code: 'ADMIN_RETRY_STATE_CONFLICT',
          message: '规则当前状态不允许重试该任务',
        });
      }
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          actorType: 'USER',
          action: 'ADMIN_RECURRING_RUN_RETRIED',
          targetType: 'RECURRING_RUN',
          targetId: runId,
          requestId,
          afterJson: { reason: reason.trim(), result: 'SUCCEEDED' },
        },
      });
      const updated = await this.prisma.recurringRun.findUniqueOrThrow({ where: { id: runId } });
      return { id: updated.id, status: updated.status, attempts: updated.attempts };
    } catch (error) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          actorType: 'USER',
          action: 'ADMIN_RECURRING_RUN_RETRY_FAILED',
          targetType: 'RECURRING_RUN',
          targetId: runId,
          requestId,
          afterJson: { reason: reason.trim(), result: 'FAILED' },
        },
      });
      throw error;
    }
  }

  async listAudit(
    actorUserId: string,
    input: AdminAuditQueryDto,
    requestId: string,
  ): Promise<object> {
    return this.prisma.$transaction(async (tx) => {
      const where: Prisma.AuditLogWhereInput = input.action
        ? { action: { contains: input.action.trim(), mode: 'insensitive' } }
        : {};
      const [items, total] = await Promise.all([
        tx.auditLog.findMany({
          where,
          include: { actor: { include: { credential: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        tx.auditLog.count({ where }),
      ]);
      await tx.auditLog.create({
        data: {
          actorUserId,
          actorType: 'USER',
          action: 'ADMIN_AUDIT_LIST_VIEWED',
          targetType: 'AUDIT_LOG',
          targetId: actorUserId,
          requestId,
          afterJson: {
            page: input.page,
            pageSize: input.pageSize,
            filtered: Boolean(input.action),
          },
        },
      });
      return page(
        items.map((item) => ({
          id: item.id,
          actorType: item.actorType,
          actor: item.actor
            ? {
                id: item.actor.id,
                nickname: item.actor.nickname,
                emailMasked: maskEmail(item.actor.credential?.emailNormalized),
              }
            : null,
          action: item.action,
          targetType: item.targetType,
          targetId: item.targetId,
          requestId: item.requestId,
          createdAt: item.createdAt,
        })),
        total,
        input,
      );
    });
  }
}
