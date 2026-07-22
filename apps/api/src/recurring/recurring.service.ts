import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EntryType, MemberRole, RecurringRuleStatus, UserStatus } from '@prisma/client';

import type {
  ConfirmRecurringRunDto,
  CreateRecurringRuleDto,
  ListRecurringRulesDto,
  ListRecurringRunsDto,
  UpdateRecurringRuleDto,
} from './recurring.dto';
import {
  businessToday,
  dateOnly,
  nextOccurrenceAfter,
  nextOccurrenceOnOrAfter,
  parseBusinessDate,
} from './recurring.dates';
import {
  RecurringRepository,
  type RecurringRuleRecord,
  type RecurringRunRecord,
} from './recurring.repository';

type Actor = { id: string; status: UserStatus; timezone: string };
type Membership = { userId: string; role: MemberRole; status: string };

function invisible(kind: 'rule' | 'run'): NotFoundException {
  return new NotFoundException({
    code: kind === 'rule' ? 'RECURRING_RULE_NOT_FOUND' : 'RECURRING_RUN_NOT_FOUND',
    message: kind === 'rule' ? '周期规则不存在' : '周期实例不存在',
  });
}

function forbidden(message = '无权操作该周期记录'): ForbiddenException {
  return new ForbiddenException({ code: 'RECURRING_PERMISSION_DENIED', message });
}

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function badRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}

function parseDate(value: string): Date {
  try {
    return parseBusinessDate(value);
  } catch {
    throw badRequest('VALIDATION_FAILED', '业务日期无效');
  }
}

function membershipFor(userId: string, rule: RecurringRuleRecord): Membership | undefined {
  return rule.ledger.members.find((member) => member.userId === userId);
}

function canManage(userId: string, actor: Actor, rule: RecurringRuleRecord): boolean {
  const membership = membershipFor(userId, rule);
  return Boolean(
    actor.status === 'ACTIVE' &&
    membership &&
    (rule.ownerUserId === userId || membership.role === 'OWNER'),
  );
}

function categoryView(rule: RecurringRuleRecord): object {
  return {
    id: rule.category.id,
    name: rule.category.name,
    icon: rule.category.icon,
    color: rule.category.color,
    isEnabled: rule.category.isEnabled,
  };
}

function ruleView(userId: string, actor: Actor, rule: RecurringRuleRecord): object {
  const manageable = canManage(userId, actor, rule);
  return {
    id: rule.id,
    ownerUserId: rule.ownerUserId,
    ledgerId: rule.ledgerId,
    name: rule.name,
    entryType: rule.entryType,
    amountCent: Number(rule.amountCent),
    categoryId: rule.categoryId,
    category: categoryView(rule),
    frequency: rule.frequency,
    intervalValue: rule.intervalValue,
    startDate: dateOnly(rule.startDate),
    endDate: rule.endDate ? dateOnly(rule.endDate) : null,
    totalOccurrences: rule.totalOccurrences,
    completedOccurrences: rule.completedOccurrences,
    nextRunDate: rule.nextRunDate ? dateOnly(rule.nextRunDate) : null,
    generationMode: rule.generationMode,
    status: rule.status,
    reminderDaysBefore: rule.reminderDaysBefore,
    canEdit: manageable && (rule.status === 'ACTIVE' || rule.status === 'PAUSED'),
    canPause: manageable && rule.status === 'ACTIVE',
    canResume: manageable && rule.status === 'PAUSED',
    canDelete: manageable,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };
}

function runView(userId: string, actor: Actor, run: RecurringRunRecord): object {
  const manageable = canManage(userId, actor, run.rule);
  const actionable =
    manageable && run.status === 'PENDING' && run.rule.generationMode === 'CONFIRM';
  return {
    id: run.id,
    ruleId: run.ruleId,
    scheduledDate: dateOnly(run.scheduledDate),
    amountCent: Number(run.amountCent),
    status: run.status,
    entryId: run.entryId,
    attempts: run.attempts,
    lastError: run.lastError,
    lastAttemptAt: run.lastAttemptAt,
    confirmedAt: run.confirmedAt,
    canConfirm: actionable,
    canSkip: actionable,
    rule: {
      id: run.rule.id,
      ledgerId: run.rule.ledgerId,
      ownerUserId: run.rule.ownerUserId,
      name: run.rule.name,
      entryType: run.rule.entryType,
      generationMode: run.rule.generationMode,
    },
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

function ruleCreateHash(input: CreateRecurringRuleDto): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        contractVersion: 1,
        ledgerId: input.ledgerId,
        name: input.name,
        entryType: input.entryType,
        amountCent: String(input.amountCent),
        categoryId: input.categoryId,
        frequency: input.frequency,
        intervalValue: input.intervalValue,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        totalOccurrences: input.totalOccurrences ?? null,
        generationMode: input.generationMode,
        reminderDaysBefore: input.reminderDaysBefore,
      }),
    )
    .digest('hex');
}

function confirmationHash(runId: string, amountCent: number): string {
  return createHash('sha256')
    .update(JSON.stringify({ contractVersion: 1, runId, amountCent: String(amountCent) }))
    .digest('hex');
}

function sourceEntryHash(input: {
  ledgerId: string;
  creatorUserId: string;
  type: EntryType;
  amountCent: bigint;
  categoryId: string;
  businessDate: Date;
  note: string;
  sourceId: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        contractVersion: 1,
        ...input,
        amountCent: String(input.amountCent),
        businessDate: dateOnly(input.businessDate),
      }),
    )
    .digest('hex');
}

function validateSchedule(input: {
  startDate: Date;
  endDate: Date | null;
  totalOccurrences: number | null;
  completedOccurrences?: number;
}): void {
  if (input.endDate && input.endDate.getTime() < input.startDate.getTime()) {
    throw badRequest('RECURRING_DATE_INVALID', '结束日期不能早于开始日期');
  }
  if (input.endDate && input.totalOccurrences !== null) {
    throw badRequest('RECURRING_END_CONDITION_CONFLICT', '结束日期和总期数只能选择一种');
  }
  if (
    input.totalOccurrences !== null &&
    input.totalOccurrences < (input.completedOccurrences ?? 0)
  ) {
    throw conflict('RECURRING_TOTAL_BELOW_COMPLETED', '总期数不能小于已物化期数');
  }
}

function nextStateAfterRun(
  rule: RecurringRuleRecord,
  scheduledDate: Date,
): {
  completedOccurrences: number;
  nextRunDate: Date | null;
  status: 'ACTIVE' | 'COMPLETED';
} {
  const completedOccurrences = rule.completedOccurrences + 1;
  if (rule.totalOccurrences !== null && completedOccurrences >= rule.totalOccurrences) {
    return { completedOccurrences, nextRunDate: null, status: 'COMPLETED' };
  }
  const candidate = nextOccurrenceAfter(
    rule.startDate,
    rule.frequency,
    rule.intervalValue,
    scheduledDate,
  );
  if (rule.endDate && candidate.getTime() > rule.endDate.getTime()) {
    return { completedOccurrences, nextRunDate: null, status: 'COMPLETED' };
  }
  return { completedOccurrences, nextRunDate: candidate, status: 'ACTIVE' };
}

@Injectable()
export class RecurringService {
  constructor(@Inject(RecurringRepository) private readonly repository: RecurringRepository) {}

  async listRules(userId: string, query: ListRecurringRulesDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      if (!actor) throw invisible('rule');
      if (query.ledgerId && !(await this.repository.findMembership(tx, userId, query.ledgerId))) {
        throw invisible('rule');
      }
      const result = await this.repository.listRules(tx, userId, query);
      return {
        items: result.items.map((rule) => ruleView(userId, actor, rule)),
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        hasNext: query.page * query.pageSize < result.total,
      };
    });
  }

  async getRule(userId: string, id: string): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      const rule = await this.repository.findVisibleRule(tx, userId, id);
      if (!actor || !rule) throw invisible('rule');
      return ruleView(userId, actor, rule);
    });
  }

  async createRule(
    userId: string,
    input: CreateRecurringRuleDto,
    requestId: string,
  ): Promise<object> {
    const startDate = parseDate(input.startDate);
    const endDate = input.endDate ? parseDate(input.endDate) : null;
    const totalOccurrences = input.totalOccurrences ?? null;
    validateSchedule({ startDate, endDate, totalOccurrences });
    const hash = ruleCreateHash(input);
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:recurring-create:${userId}:${input.idempotencyKey}`]);
      const actor = await this.repository.findActor(tx, userId);
      const membership = await this.repository.findMembership(tx, userId, input.ledgerId);
      if (!actor || !membership) throw invisible('rule');
      if (actor.status !== 'ACTIVE') throw forbidden();
      const replay = await this.repository.findRuleByIdempotency(tx, userId, input.idempotencyKey);
      if (replay) {
        if (replay.deletedAt === null && replay.createRequestHash === hash) {
          return ruleView(userId, actor, replay);
        }
        throw conflict('IDEMPOTENCY_CONFLICT', '幂等键已消费或用于不同的周期规则');
      }
      const category = await this.repository.findCategory(tx, input.categoryId);
      if (
        !category ||
        !category.isEnabled ||
        category.ledgerId !== input.ledgerId ||
        category.type !== input.entryType
      ) {
        throw badRequest('RECURRING_CATEGORY_INVALID', '分类必须启用且属于同一账本和收支类型');
      }
      const today = businessToday(actor.timezone);
      const nextRunDate = nextOccurrenceOnOrAfter(
        startDate,
        input.frequency,
        input.intervalValue,
        today,
      ).date;
      if (endDate && nextRunDate.getTime() > endDate.getTime()) {
        throw badRequest('RECURRING_NO_FUTURE_OCCURRENCE', '规则没有可执行的未来账期');
      }
      const rule = await this.repository.createRule(tx, {
        ownerUserId: userId,
        ledgerId: input.ledgerId,
        name: input.name,
        entryType: input.entryType,
        amountCent: BigInt(input.amountCent),
        categoryId: input.categoryId,
        frequency: input.frequency,
        intervalValue: input.intervalValue,
        startDate,
        endDate,
        totalOccurrences,
        nextRunDate,
        generationMode: input.generationMode,
        reminderDaysBefore: input.reminderDaysBefore,
        idempotencyKey: input.idempotencyKey,
        createRequestHash: hash,
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'RECURRING_RULE_CREATED',
        targetType: 'RECURRING_RULE',
        targetId: rule.id,
        requestId,
        afterJson: {
          ledgerId: rule.ledgerId,
          frequency: rule.frequency,
          generationMode: rule.generationMode,
        },
      });
      return ruleView(userId, actor, rule);
    });
  }

  async updateRule(
    userId: string,
    id: string,
    input: UpdateRecurringRuleDto,
    requestId: string,
  ): Promise<object> {
    const editableKeys = [
      'name',
      'entryType',
      'amountCent',
      'categoryId',
      'frequency',
      'intervalValue',
      'startDate',
      'endDate',
      'totalOccurrences',
      'generationMode',
      'reminderDaysBefore',
    ] as const;
    if (!editableKeys.some((key) => input[key] !== undefined)) {
      throw badRequest('VALIDATION_FAILED', '至少提供一个修改字段');
    }
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:recurring-rule:${id}`]);
      const actor = await this.repository.findActor(tx, userId);
      const rule = await this.repository.findVisibleRule(tx, userId, id);
      if (!actor || !rule) throw invisible('rule');
      if (!canManage(userId, actor, rule)) throw forbidden();
      if (rule.status !== 'ACTIVE' && rule.status !== 'PAUSED') {
        throw conflict('RECURRING_RULE_NOT_EDITABLE', '当前状态不能修改周期规则');
      }
      const immutableScheduleChanged =
        (input.entryType !== undefined && input.entryType !== rule.entryType) ||
        (input.categoryId !== undefined && input.categoryId !== rule.categoryId) ||
        (input.frequency !== undefined && input.frequency !== rule.frequency) ||
        (input.intervalValue !== undefined && input.intervalValue !== rule.intervalValue) ||
        (input.startDate !== undefined && input.startDate !== dateOnly(rule.startDate)) ||
        (input.generationMode !== undefined && input.generationMode !== rule.generationMode);
      if (immutableScheduleChanged && (await this.repository.hasRuns(tx, rule.id))) {
        throw conflict(
          'RECURRING_SCHEDULE_LOCKED',
          '已有执行实例后不能修改收支分类、频率、开始日期或生成方式',
        );
      }
      const startDate = input.startDate ? parseDate(input.startDate) : rule.startDate;
      const endDate =
        input.endDate === undefined
          ? rule.endDate
          : input.endDate
            ? parseDate(input.endDate)
            : null;
      const totalOccurrences =
        input.totalOccurrences === undefined ? rule.totalOccurrences : input.totalOccurrences;
      validateSchedule({
        startDate,
        endDate,
        totalOccurrences,
        completedOccurrences: rule.completedOccurrences,
      });
      const entryType = input.entryType ?? rule.entryType;
      const categoryId = input.categoryId ?? rule.categoryId;
      const category = await this.repository.findCategory(tx, categoryId);
      if (
        !category ||
        !category.isEnabled ||
        category.ledgerId !== rule.ledgerId ||
        category.type !== entryType
      ) {
        throw badRequest('RECURRING_CATEGORY_INVALID', '分类必须启用且属于同一账本和收支类型');
      }
      const frequency = input.frequency ?? rule.frequency;
      const intervalValue = input.intervalValue ?? rule.intervalValue;
      let status: RecurringRuleStatus = rule.status;
      let nextRunDate = rule.nextRunDate;
      if (totalOccurrences !== null && rule.completedOccurrences >= totalOccurrences) {
        status = 'COMPLETED';
        nextRunDate = null;
      } else {
        const candidate = nextOccurrenceOnOrAfter(
          startDate,
          frequency,
          intervalValue,
          businessToday(actor.timezone),
          rule.completedOccurrences,
        ).date;
        if (endDate && candidate.getTime() > endDate.getTime()) {
          status = 'COMPLETED';
          nextRunDate = null;
        } else if (status === 'ACTIVE') {
          nextRunDate = candidate;
        }
      }
      const updated = await this.repository.updateRule(tx, id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.entryType !== undefined ? { entryType } : {}),
        ...(input.amountCent !== undefined ? { amountCent: BigInt(input.amountCent) } : {}),
        ...(input.categoryId !== undefined ? { categoryId } : {}),
        ...(input.frequency !== undefined ? { frequency } : {}),
        ...(input.intervalValue !== undefined ? { intervalValue } : {}),
        ...(input.startDate !== undefined ? { startDate } : {}),
        ...(input.endDate !== undefined ? { endDate } : {}),
        ...(input.totalOccurrences !== undefined ? { totalOccurrences } : {}),
        ...(input.generationMode !== undefined ? { generationMode: input.generationMode } : {}),
        ...(input.reminderDaysBefore !== undefined
          ? { reminderDaysBefore: input.reminderDaysBefore }
          : {}),
        status,
        nextRunDate,
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'RECURRING_RULE_UPDATED',
        targetType: 'RECURRING_RULE',
        targetId: id,
        requestId,
        beforeJson: { status: rule.status, nextRunDate: rule.nextRunDate },
        afterJson: { status: updated.status, nextRunDate: updated.nextRunDate },
      });
      return ruleView(userId, actor, updated);
    });
  }

  async pauseRule(userId: string, id: string, requestId: string): Promise<object> {
    return this.setRulePaused(userId, id, true, requestId);
  }

  async resumeRule(userId: string, id: string, requestId: string): Promise<object> {
    return this.setRulePaused(userId, id, false, requestId);
  }

  private async setRulePaused(
    userId: string,
    id: string,
    pause: boolean,
    requestId: string,
  ): Promise<object> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:recurring-rule:${id}`]);
      const actor = await this.repository.findActor(tx, userId);
      const rule = await this.repository.findVisibleRule(tx, userId, id);
      if (!actor || !rule) throw invisible('rule');
      if (!canManage(userId, actor, rule)) throw forbidden();
      if (pause && rule.status === 'PAUSED') return ruleView(userId, actor, rule);
      if (!pause && rule.status === 'ACTIVE') return ruleView(userId, actor, rule);
      if ((pause && rule.status !== 'ACTIVE') || (!pause && rule.status !== 'PAUSED')) {
        throw conflict('RECURRING_RULE_STATE_CONFLICT', '当前状态不能执行该操作');
      }
      let status: 'PAUSED' | 'ACTIVE' | 'COMPLETED' = pause ? 'PAUSED' : 'ACTIVE';
      let nextRunDate: Date | null = null;
      if (!pause) {
        if (rule.totalOccurrences !== null && rule.completedOccurrences >= rule.totalOccurrences) {
          status = 'COMPLETED';
        } else {
          nextRunDate = nextOccurrenceOnOrAfter(
            rule.startDate,
            rule.frequency,
            rule.intervalValue,
            businessToday(actor.timezone),
            rule.completedOccurrences,
          ).date;
          if (rule.endDate && nextRunDate.getTime() > rule.endDate.getTime()) {
            status = 'COMPLETED';
            nextRunDate = null;
          }
        }
      }
      const updated = await this.repository.updateRule(tx, id, { status, nextRunDate });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: pause ? 'RECURRING_RULE_PAUSED' : 'RECURRING_RULE_RESUMED',
        targetType: 'RECURRING_RULE',
        targetId: id,
        requestId,
        beforeJson: { status: rule.status, nextRunDate: rule.nextRunDate },
        afterJson: { status: updated.status, nextRunDate: updated.nextRunDate },
      });
      return ruleView(userId, actor, updated);
    });
  }

  async deleteRule(userId: string, id: string, requestId: string): Promise<object> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:recurring-rule:${id}`]);
      const actor = await this.repository.findActor(tx, userId);
      const rule = await this.repository.findVisibleRule(tx, userId, id, true);
      if (!actor || !rule) throw invisible('rule');
      if (!canManage(userId, actor, rule)) throw forbidden();
      if (rule.deletedAt) return { id, deleted: true };
      await this.repository.updateRule(tx, id, {
        status: 'CANCELLED',
        nextRunDate: null,
        deletedAt: new Date(),
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'RECURRING_RULE_DELETED',
        targetType: 'RECURRING_RULE',
        targetId: id,
        requestId,
        beforeJson: { status: rule.status },
        afterJson: { status: 'CANCELLED' },
      });
      return { id, deleted: true };
    });
  }

  async listRuns(userId: string, query: ListRecurringRunsDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      if (!actor) throw invisible('run');
      const result = await this.repository.listRuns(tx, userId, query);
      return {
        items: result.items.map((run) => runView(userId, actor, run)),
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        hasNext: query.page * query.pageSize < result.total,
      };
    });
  }

  async confirmRun(
    userId: string,
    id: string,
    input: ConfirmRecurringRunDto,
    requestId: string,
  ): Promise<object> {
    const hash = confirmationHash(id, input.amountCent);
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [
        `siyu:recurring-confirm:${userId}:${input.idempotencyKey}`,
        `siyu:recurring-run:${id}`,
      ]);
      const actor = await this.repository.findActor(tx, userId);
      const run = await this.repository.findVisibleRun(tx, userId, id);
      if (!actor || !run) throw invisible('run');
      if (!canManage(userId, actor, run.rule)) throw forbidden();
      const replay = await this.repository.findRunByConfirmationKey(
        tx,
        userId,
        input.idempotencyKey,
      );
      if (replay) {
        if (replay.id === id && replay.confirmationRequestHash === hash) {
          return runView(userId, actor, replay);
        }
        throw conflict('IDEMPOTENCY_CONFLICT', '幂等键已用于不同的周期确认请求');
      }
      if (run.status !== 'PENDING' || run.rule.generationMode !== 'CONFIRM') {
        throw conflict('RECURRING_RUN_STATE_CONFLICT', '只有待确认实例可以确认入账');
      }
      if (!run.rule.category.isEnabled) {
        throw conflict('RECURRING_CATEGORY_DISABLED', '规则分类已停用，无法确认入账');
      }
      const ownerMembership = membershipFor(run.rule.ownerUserId, run.rule);
      if (!ownerMembership) {
        throw conflict('RECURRING_OWNER_INACTIVE', '规则创建人已不是有效账本成员');
      }
      const amountCent = BigInt(input.amountCent);
      const entry = await this.repository.createSourceEntry(tx, {
        ledgerId: run.rule.ledgerId,
        creatorUserId: run.rule.ownerUserId,
        type: run.rule.entryType,
        amountCent,
        categoryId: run.rule.categoryId,
        businessDate: run.scheduledDate,
        note: run.rule.name,
        sourceId: run.id,
        idempotencyKey: `recurring-run:${run.id}`,
        createRequestHash: sourceEntryHash({
          ledgerId: run.rule.ledgerId,
          creatorUserId: run.rule.ownerUserId,
          type: run.rule.entryType,
          amountCent,
          categoryId: run.rule.categoryId,
          businessDate: run.scheduledDate,
          note: run.rule.name,
          sourceId: run.id,
        }),
      });
      const now = new Date();
      const updated = await this.repository.updateRun(tx, id, {
        amountCent,
        status: 'CONFIRMED',
        entryId: entry.id,
        confirmedAt: now,
        confirmationUserId: userId,
        confirmationIdempotencyKey: input.idempotencyKey,
        confirmationRequestHash: hash,
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'RECURRING_RUN_CONFIRMED',
        targetType: 'RECURRING_RUN',
        targetId: id,
        requestId,
        afterJson: { ruleId: run.ruleId, entryId: entry.id },
      });
      return runView(userId, actor, updated);
    });
  }

  async skipRun(userId: string, id: string, requestId: string): Promise<object> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:recurring-run:${id}`]);
      const actor = await this.repository.findActor(tx, userId);
      const run = await this.repository.findVisibleRun(tx, userId, id);
      if (!actor || !run) throw invisible('run');
      if (!canManage(userId, actor, run.rule)) throw forbidden();
      if (run.status === 'SKIPPED') return runView(userId, actor, run);
      if (run.status !== 'PENDING' || run.rule.generationMode !== 'CONFIRM') {
        throw conflict('RECURRING_RUN_STATE_CONFLICT', '只有待确认实例可以跳过');
      }
      const updated = await this.repository.updateRun(tx, id, { status: 'SKIPPED' });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'RECURRING_RUN_SKIPPED',
        targetType: 'RECURRING_RUN',
        targetId: id,
        requestId,
        afterJson: { ruleId: run.ruleId, status: 'SKIPPED' },
      });
      return runView(userId, actor, updated);
    });
  }

  async materializeDueRule(ruleId: string, today: Date): Promise<object | null> {
    try {
      return await this.materializeDueRuleTransaction(ruleId, today);
    } catch (error) {
      await this.recordMaterializationFailure(ruleId, error);
      throw error;
    }
  }

  private async materializeDueRuleTransaction(ruleId: string, today: Date): Promise<object | null> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:recurring-rule:${ruleId}`]);
      const rule = await this.repository.findExecutableRule(tx, ruleId);
      if (!rule || !rule.nextRunDate || rule.nextRunDate.getTime() > today.getTime()) return null;
      if (!rule.category.isEnabled) throw new Error('RECURRING_CATEGORY_DISABLED');
      if (!membershipFor(rule.ownerUserId, rule)) throw new Error('RECURRING_OWNER_INACTIVE');
      const scheduledDate = rule.nextRunDate;
      const existing = await this.repository.findRunByRuleDate(tx, ruleId, scheduledDate);
      if (existing && existing.status !== 'FAILED') return existing;
      const now = new Date();
      const runId = existing?.id ?? randomUUID();
      const attempts = (existing?.attempts ?? 0) + 1;
      let run: RecurringRunRecord;
      if (rule.generationMode === 'CONFIRM') {
        run = existing
          ? await this.repository.updateRun(tx, runId, {
              status: 'PENDING',
              attempts,
              lastError: null,
              lastAttemptAt: now,
            })
          : await this.repository.createRun(tx, {
              id: runId,
              ruleId,
              scheduledDate,
              amountCent: rule.amountCent,
              status: 'PENDING',
              attempts,
              lastAttemptAt: now,
            });
      } else {
        const entry = await this.repository.createSourceEntry(tx, {
          ledgerId: rule.ledgerId,
          creatorUserId: rule.ownerUserId,
          type: rule.entryType,
          amountCent: rule.amountCent,
          categoryId: rule.categoryId,
          businessDate: scheduledDate,
          note: rule.name,
          sourceId: runId,
          idempotencyKey: `recurring-run:${runId}`,
          createRequestHash: sourceEntryHash({
            ledgerId: rule.ledgerId,
            creatorUserId: rule.ownerUserId,
            type: rule.entryType,
            amountCent: rule.amountCent,
            categoryId: rule.categoryId,
            businessDate: scheduledDate,
            note: rule.name,
            sourceId: runId,
          }),
        });
        run = existing
          ? await this.repository.updateRun(tx, runId, {
              status: 'GENERATED',
              entryId: entry.id,
              attempts,
              lastError: null,
              lastAttemptAt: now,
            })
          : await this.repository.createRun(tx, {
              id: runId,
              ruleId,
              scheduledDate,
              amountCent: rule.amountCent,
              status: 'GENERATED',
              entryId: entry.id,
              attempts,
              lastAttemptAt: now,
            });
      }
      const next = nextStateAfterRun(rule, scheduledDate);
      await this.repository.updateRule(tx, ruleId, next);
      await this.repository.audit(tx, {
        action: 'RECURRING_RUN_MATERIALIZED',
        targetType: 'RECURRING_RUN',
        targetId: run.id,
        afterJson: { ruleId, scheduledDate: dateOnly(scheduledDate), status: run.status },
      });
      return run;
    });
  }

  private async recordMaterializationFailure(ruleId: string, error: unknown): Promise<void> {
    const lastError = String(error instanceof Error ? error.message : 'UNKNOWN_RECURRING_FAILURE')
      .slice(0, 500)
      .trim();
    await this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:recurring-rule:${ruleId}`]);
      const rule = await this.repository.findExecutableRule(tx, ruleId);
      if (!rule?.nextRunDate) return;
      const existing = await this.repository.findRunByRuleDate(tx, ruleId, rule.nextRunDate);
      if (existing && existing.status !== 'FAILED') return;
      const now = new Date();
      if (existing) {
        await this.repository.updateRun(tx, existing.id, {
          attempts: existing.attempts + 1,
          lastError: lastError || 'UNKNOWN_RECURRING_FAILURE',
          lastAttemptAt: now,
        });
      } else {
        await this.repository.createRun(tx, {
          id: randomUUID(),
          ruleId,
          scheduledDate: rule.nextRunDate,
          amountCent: rule.amountCent,
          status: 'FAILED',
          attempts: 1,
          lastError: lastError || 'UNKNOWN_RECURRING_FAILURE',
          lastAttemptAt: now,
        });
      }
    });
  }
}
