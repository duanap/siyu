import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, SavingGoalStatus, UserStatus } from '@prisma/client';

import type {
  CreateSavingContributionDto,
  CreateSavingGoalDto,
  ListSavingGoalsDto,
  UpdateSavingContributionDto,
  UpdateSavingGoalDto,
} from './saving-goals.dto';
import {
  SavingGoalsRepository,
  type SavingContributionRecord,
  type SavingGoalRecord,
} from './saving-goals.repository';

type Actor = { id: string; status: UserStatus };

function goalNotFound(): NotFoundException {
  return new NotFoundException({ code: 'SAVING_GOAL_NOT_FOUND', message: '攒钱目标不存在' });
}

function ledgerNotFound(): NotFoundException {
  return new NotFoundException({ code: 'SAVING_LEDGER_NOT_FOUND', message: '目标账本不存在' });
}

function contributionNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'SAVING_CONTRIBUTION_NOT_FOUND',
    message: '存入记录不存在',
  });
}

function forbidden(message = '当前账号不能执行该攒钱操作'): ForbiddenException {
  return new ForbiddenException({ code: 'SAVING_PERMISSION_DENIED', message });
}

function invalid(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function parseBusinessDate(value: string, code: string, label: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw invalid(code, `${label}必须是有效业务日期`);
  }
  return parsed;
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function safeCent(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new InternalServerErrorException({
      code: 'SAVING_AMOUNT_OVERFLOW',
      message: '攒钱金额超出安全返回范围',
    });
  }
  return Number(value);
}

export function savingGoalStatus(savedCent: bigint, targetCent: bigint): SavingGoalStatus {
  return savedCent >= targetCent ? 'COMPLETED' : 'ACTIVE';
}

export function savingProgressBasisPoints(savedCent: bigint, targetCent: bigint): number {
  if (targetCent <= 0n) return 0;
  return Number(
    (savedCent * 10_000n) / targetCent > 10_000n ? 10_000n : (savedCent * 10_000n) / targetCent,
  );
}

export function savingGoalCreateRequestHash(input: CreateSavingGoalDto): string {
  return requestHash({
    contractVersion: 1,
    ledgerId: input.ledgerId,
    name: input.name,
    targetCent: String(input.targetCent),
    initialCent: String(input.initialCent),
    targetDate: input.targetDate ?? null,
    coverUrl: input.coverUrl ?? null,
    note: input.note ?? null,
  });
}

export function savingContributionCreateRequestHash(
  goalId: string,
  input: CreateSavingContributionDto,
): string {
  return requestHash({
    contractVersion: 1,
    goalId,
    amountCent: String(input.amountCent),
    businessDate: input.businessDate,
    note: input.note ?? null,
  });
}

function contributionView(actor: Actor, contribution: SavingContributionRecord) {
  const editable = actor.status === 'ACTIVE' && contribution.userId === actor.id;
  return {
    id: contribution.id,
    goalId: contribution.goalId,
    userId: contribution.userId,
    contributorName: contribution.user.nickname,
    amountCent: safeCent(contribution.amountCent),
    businessDate: dateOnly(contribution.businessDate),
    note: contribution.note,
    canEdit: editable,
    canDelete: editable,
    createdAt: contribution.createdAt,
    updatedAt: contribution.updatedAt,
  };
}

function contributorSummaries(goal: SavingGoalRecord) {
  const contributors = new Map<
    string,
    { userId: string; contributorName: string; amountCent: bigint }
  >();
  for (const member of goal.ledger.members) {
    contributors.set(member.userId, {
      userId: member.userId,
      contributorName: member.user.nickname,
      amountCent: 0n,
    });
  }
  if (!contributors.has(goal.creatorUserId)) {
    contributors.set(goal.creatorUserId, {
      userId: goal.creatorUserId,
      contributorName: goal.creator.nickname,
      amountCent: 0n,
    });
  }
  contributors.get(goal.creatorUserId)!.amountCent += goal.initialCent;
  for (const contribution of goal.contributions) {
    const summary = contributors.get(contribution.userId) ?? {
      userId: contribution.userId,
      contributorName: contribution.user.nickname,
      amountCent: 0n,
    };
    summary.amountCent += contribution.amountCent;
    contributors.set(contribution.userId, summary);
  }
  return [...contributors.values()]
    .sort((left, right) => {
      if (left.amountCent !== right.amountCent) return left.amountCent > right.amountCent ? -1 : 1;
      return left.userId.localeCompare(right.userId);
    })
    .map((item) => ({ ...item, amountCent: safeCent(item.amountCent) }));
}

function goalSummaryView(actor: Actor, goal: SavingGoalRecord) {
  const currentMember = goal.ledger.members.some((member) => member.userId === actor.id);
  const canWrite = actor.status === 'ACTIVE' && currentMember;
  const remainingCent = goal.targetCent > goal.savedCent ? goal.targetCent - goal.savedCent : 0n;
  return {
    id: goal.id,
    ledgerId: goal.ledgerId,
    ledgerName: goal.ledger.name,
    ledgerType: goal.ledger.type,
    creatorUserId: goal.creatorUserId,
    creatorName: goal.creator.nickname,
    name: goal.name,
    targetCent: safeCent(goal.targetCent),
    initialCent: safeCent(goal.initialCent),
    savedCent: safeCent(goal.savedCent),
    remainingCent: safeCent(remainingCent),
    progressBasisPoints: savingProgressBasisPoints(goal.savedCent, goal.targetCent),
    targetDate: goal.targetDate ? dateOnly(goal.targetDate) : null,
    status: goal.status,
    coverUrl: goal.coverUrl,
    note: goal.note,
    contributorSummaries: contributorSummaries(goal),
    canManage: canWrite && goal.ledger.ownerUserId === actor.id,
    canContribute: canWrite,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
}

function goalDetailView(actor: Actor, goal: SavingGoalRecord) {
  return {
    ...goalSummaryView(actor, goal),
    contributions: goal.contributions.map((item) => contributionView(actor, item)),
  };
}

function requireNonEmptyUpdate(input: object): void {
  if (Object.keys(input).length === 0) {
    throw invalid('SAVING_UPDATE_EMPTY', '至少提供一个需要更新的字段');
  }
}

@Injectable()
export class SavingGoalsService {
  constructor(@Inject(SavingGoalsRepository) private readonly repository: SavingGoalsRepository) {}

  private async requireActor(tx: Prisma.TransactionClient, userId: string): Promise<Actor> {
    const actor = await this.repository.findActor(tx, userId);
    if (!actor) throw goalNotFound();
    return actor;
  }

  private requireActiveActor(actor: Actor): void {
    if (actor.status !== 'ACTIVE') throw forbidden('当前账号不能写入攒钱数据');
  }

  private async refreshGoal(
    tx: Prisma.TransactionClient,
    goal: Pick<SavingGoalRecord, 'id' | 'initialCent' | 'targetCent'>,
  ): Promise<SavingGoalRecord> {
    const savedCent =
      goal.initialCent + (await this.repository.sumActiveContributions(tx, goal.id));
    if (savedCent > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw invalid('SAVING_AMOUNT_OVERFLOW', '目标累计金额超过安全金额范围');
    }
    return this.repository.updateGoal(tx, goal.id, {
      savedCent,
      status: savingGoalStatus(savedCent, goal.targetCent),
    });
  }

  async list(userId: string, input: ListSavingGoalsDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.requireActor(tx, userId);
      const result = await this.repository.list(tx, userId, input);
      return {
        items: result.items.map((goal) => goalSummaryView(actor, goal)),
        total: result.total,
        page: input.page,
        pageSize: input.pageSize,
        hasNext: input.page * input.pageSize < result.total,
      };
    });
  }

  async create(userId: string, input: CreateSavingGoalDto): Promise<object> {
    const hash = savingGoalCreateRequestHash(input);
    const targetDate = input.targetDate
      ? parseBusinessDate(input.targetDate, 'SAVING_TARGET_DATE_INVALID', '目标日期')
      : null;
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:saving-goal-create:${userId}:${input.idempotencyKey}`]);
      const actor = await this.requireActor(tx, userId);
      this.requireActiveActor(actor);
      const ledger = await this.repository.findVisibleLedger(tx, userId, input.ledgerId);
      if (!ledger) throw ledgerNotFound();

      const replay = await this.repository.findGoalByIdempotency(tx, userId, input.idempotencyKey);
      if (replay) {
        if (replay.createRequestHash !== hash) {
          throw conflict('IDEMPOTENCY_CONFLICT', '幂等键已用于不同的目标创建请求');
        }
        if (replay.deletedAt) {
          throw conflict('SAVING_GOAL_DELETED', '该幂等键对应的目标已删除');
        }
        return goalSummaryView(actor, replay);
      }

      const initialCent = BigInt(input.initialCent);
      const targetCent = BigInt(input.targetCent);
      const goal = await this.repository.createGoal(tx, {
        ledgerId: ledger.id,
        creatorUserId: userId,
        name: input.name,
        targetCent,
        initialCent,
        savedCent: initialCent,
        targetDate,
        status: savingGoalStatus(initialCent, targetCent),
        coverUrl: input.coverUrl ?? null,
        note: input.note ?? null,
        idempotencyKey: input.idempotencyKey,
        createRequestHash: hash,
      });
      return goalSummaryView(actor, goal);
    });
  }

  async get(userId: string, id: string): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.requireActor(tx, userId);
      const goal = await this.repository.findVisibleGoal(tx, userId, id);
      if (!goal) throw goalNotFound();
      return goalDetailView(actor, goal);
    });
  }

  async update(userId: string, id: string, input: UpdateSavingGoalDto): Promise<object> {
    requireNonEmptyUpdate(input);
    const targetDate =
      input.targetDate === undefined
        ? undefined
        : input.targetDate === null
          ? null
          : parseBusinessDate(input.targetDate, 'SAVING_TARGET_DATE_INVALID', '目标日期');
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:saving-goal:${id}`]);
      const actor = await this.requireActor(tx, userId);
      this.requireActiveActor(actor);
      const goal = await this.repository.findVisibleGoal(tx, userId, id);
      if (!goal) throw goalNotFound();
      if (goal.ledger.ownerUserId !== userId) throw forbidden('只有账本所有者可以管理目标');

      const targetCent =
        input.targetCent === undefined ? goal.targetCent : BigInt(input.targetCent);
      return goalDetailView(
        actor,
        await this.repository.updateGoal(tx, id, {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.targetCent !== undefined ? { targetCent } : {}),
          ...(targetDate !== undefined ? { targetDate } : {}),
          ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          status: savingGoalStatus(goal.savedCent, targetCent),
        }),
      );
    });
  }

  async delete(userId: string, id: string, requestId: string): Promise<object> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:saving-goal:${id}`]);
      const actor = await this.requireActor(tx, userId);
      this.requireActiveActor(actor);
      const goal = await this.repository.findVisibleGoal(tx, userId, id);
      if (!goal) throw goalNotFound();
      if (goal.ledger.ownerUserId !== userId) throw forbidden('只有账本所有者可以删除目标');

      const deletedAt = new Date();
      await this.repository.updateGoal(tx, id, { status: 'CANCELLED', deletedAt });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'SAVING_GOAL_DELETE',
        targetType: 'SAVING_GOAL',
        targetId: id,
        requestId,
        beforeJson: { status: goal.status, deleted: false },
        afterJson: { status: 'CANCELLED', deleted: true },
      });
      return { id, deleted: true };
    });
  }

  async createContribution(
    userId: string,
    goalId: string,
    input: CreateSavingContributionDto,
  ): Promise<object> {
    const hash = savingContributionCreateRequestHash(goalId, input);
    const businessDate = parseBusinessDate(
      input.businessDate,
      'SAVING_BUSINESS_DATE_INVALID',
      '存入日期',
    );
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [
        `siyu:saving-goal:${goalId}`,
        `siyu:saving-contribution-create:${userId}:${input.idempotencyKey}`,
      ]);
      const actor = await this.requireActor(tx, userId);
      this.requireActiveActor(actor);
      const goal = await this.repository.findVisibleGoal(tx, userId, goalId);
      if (!goal) throw goalNotFound();

      const replay = await this.repository.findContributionByIdempotency(
        tx,
        userId,
        input.idempotencyKey,
      );
      if (replay) {
        if (replay.createRequestHash !== hash) {
          throw conflict('IDEMPOTENCY_CONFLICT', '幂等键已用于不同的存入请求');
        }
        if (replay.deletedAt) {
          throw conflict('SAVING_CONTRIBUTION_DELETED', '该幂等键对应的存入记录已删除');
        }
        return contributionView(actor, replay);
      }

      const contribution = await this.repository.createContribution(tx, {
        goalId,
        userId,
        amountCent: BigInt(input.amountCent),
        businessDate,
        note: input.note ?? null,
        idempotencyKey: input.idempotencyKey,
        createRequestHash: hash,
      });
      await this.refreshGoal(tx, goal);
      return contributionView(actor, contribution);
    });
  }

  async updateContribution(
    userId: string,
    goalId: string,
    contributionId: string,
    input: UpdateSavingContributionDto,
  ): Promise<object> {
    requireNonEmptyUpdate(input);
    const businessDate = input.businessDate
      ? parseBusinessDate(input.businessDate, 'SAVING_BUSINESS_DATE_INVALID', '存入日期')
      : undefined;
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:saving-goal:${goalId}`]);
      const actor = await this.requireActor(tx, userId);
      this.requireActiveActor(actor);
      const goal = await this.repository.findVisibleGoal(tx, userId, goalId);
      if (!goal) throw goalNotFound();
      const contribution = await this.repository.findOwnedContribution(
        tx,
        goalId,
        contributionId,
        userId,
      );
      if (!contribution) throw contributionNotFound();

      const updated = await this.repository.updateContribution(tx, contributionId, {
        ...(input.amountCent !== undefined ? { amountCent: BigInt(input.amountCent) } : {}),
        ...(businessDate ? { businessDate } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      });
      await this.refreshGoal(tx, goal);
      return contributionView(actor, updated);
    });
  }

  async deleteContribution(
    userId: string,
    goalId: string,
    contributionId: string,
    requestId: string,
  ): Promise<object> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:saving-goal:${goalId}`]);
      const actor = await this.requireActor(tx, userId);
      this.requireActiveActor(actor);
      const goal = await this.repository.findVisibleGoal(tx, userId, goalId);
      if (!goal) throw goalNotFound();
      const contribution = await this.repository.findOwnedContribution(
        tx,
        goalId,
        contributionId,
        userId,
        true,
      );
      if (!contribution) throw contributionNotFound();
      if (contribution.deletedAt) return { id: contributionId, deleted: true };

      await this.repository.updateContribution(tx, contributionId, { deletedAt: new Date() });
      await this.refreshGoal(tx, goal);
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'SAVING_CONTRIBUTION_DELETE',
        targetType: 'SAVING_CONTRIBUTION',
        targetId: contributionId,
        requestId,
        beforeJson: { goalId, deleted: false },
        afterJson: { goalId, deleted: true },
      });
      return { id: contributionId, deleted: true };
    });
  }
}
