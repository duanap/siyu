import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { DebtDirection, DebtStatus, EntryType, UserStatus } from '@prisma/client';

import type {
  CreateDebtDto,
  CreateDebtTransactionDto,
  ListDebtsDto,
  UpdateDebtDto,
} from './debts.dto';
import { DebtsRepository, type DebtRecord } from './debts.repository';

type Actor = { id: string; status: UserStatus; timezone: string };

function invisible(): NotFoundException {
  return new NotFoundException({ code: 'DEBT_NOT_FOUND', message: '借贷记录不存在' });
}

function forbidden(): ForbiddenException {
  return new ForbiddenException({ code: 'DEBT_PERMISSION_DENIED', message: '无权操作该借贷记录' });
}

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function badRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseBusinessDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || dateOnly(date) !== value) {
    throw badRequest('VALIDATION_FAILED', '业务日期无效');
  }
  return date;
}

export function businessToday(timezone: string, now = new Date()): Date {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return parseBusinessDate(`${year}-${month}-${day}`);
}

export function deriveDebtStatus(
  remainingCent: bigint,
  dueDate: Date | null,
  today: Date,
): DebtStatus {
  if (remainingCent === 0n) return 'SETTLED';
  return dueDate && dueDate.getTime() < today.getTime() ? 'OVERDUE' : 'ACTIVE';
}

export function debtOverdueDays(remainingCent: bigint, dueDate: Date | null, today: Date): number {
  if (remainingCent === 0n || !dueDate || dueDate.getTime() >= today.getTime()) return 0;
  return Math.floor((today.getTime() - dueDate.getTime()) / 86_400_000);
}

export function debtTransactionEntryType(direction: DebtDirection): EntryType {
  return direction === 'BORROWED' ? 'EXPENSE' : 'INCOME';
}

function debtCreateHash(input: CreateDebtDto): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        contractVersion: 1,
        direction: input.direction,
        counterpartyName: input.counterpartyName,
        principalCent: String(input.principalCent),
        startDate: input.startDate,
        dueDate: input.dueDate ?? null,
        note: input.note ?? null,
        reminderEnabled: input.reminderEnabled,
      }),
    )
    .digest('hex');
}

function transactionRequestHash(debtId: string, input: CreateDebtTransactionDto): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        contractVersion: 1,
        debtId,
        amountCent: String(input.amountCent),
        businessDate: input.businessDate,
        syncEntry: input.syncEntry,
        note: input.note ?? null,
      }),
    )
    .digest('hex');
}

function sourceEntryHash(input: {
  ledgerId: string;
  type: EntryType;
  amountCent: number;
  categoryId: string;
  businessDate: string;
  note: string | null;
  sourceId: string;
}): string {
  return createHash('sha256')
    .update(JSON.stringify({ contractVersion: 1, ...input, amountCent: String(input.amountCent) }))
    .digest('hex');
}

function transactionView(transaction: DebtRecord['transactions'][number]): object {
  return {
    id: transaction.id,
    debtId: transaction.debtId,
    userId: transaction.userId,
    amountCent: Number(transaction.amountCent),
    businessDate: dateOnly(transaction.businessDate),
    syncEntry: transaction.syncEntry,
    entryId: transaction.entryId,
    note: transaction.note,
    createdAt: transaction.createdAt,
  };
}

function debtView(actor: Actor, debt: DebtRecord, includeTransactions: boolean): object {
  const today = businessToday(actor.timezone);
  const synced = debt.transactions.some((transaction) => transaction.syncEntry);
  return {
    id: debt.id,
    direction: debt.direction,
    counterpartyName: debt.counterpartyName,
    principalCent: Number(debt.principalCent),
    processedCent: Number(debt.processedCent),
    remainingCent: Number(debt.remainingCent),
    startDate: dateOnly(debt.startDate),
    dueDate: debt.dueDate ? dateOnly(debt.dueDate) : null,
    status: deriveDebtStatus(debt.remainingCent, debt.dueDate, today),
    overdueDays: debtOverdueDays(debt.remainingCent, debt.dueDate, today),
    note: debt.note,
    reminderEnabled: debt.reminderEnabled,
    createdAt: debt.createdAt,
    updatedAt: debt.updatedAt,
    canEdit: actor.status === 'ACTIVE',
    canDelete: actor.status === 'ACTIVE' && !synced,
    ...(includeTransactions
      ? { transactions: debt.transactions.map((transaction) => transactionView(transaction)) }
      : {}),
  };
}

@Injectable()
export class DebtsService {
  constructor(@Inject(DebtsRepository) private readonly repository: DebtsRepository) {}

  async list(userId: string, query: ListDebtsDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      if (!actor) throw invisible();
      const today = businessToday(actor.timezone);
      await this.repository.markOverdue(tx, userId, today);
      const result = await this.repository.list(tx, userId, query.page, query.pageSize);
      return {
        items: result.items.map((debt) => debtView(actor, debt, false)),
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        hasNext: query.page * query.pageSize < result.total,
      };
    });
  }

  async get(userId: string, id: string): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      if (!actor) throw invisible();
      await this.repository.markOverdue(tx, userId, businessToday(actor.timezone));
      const debt = await this.repository.findOwnedById(tx, userId, id);
      if (!debt) throw invisible();
      return debtView(actor, debt, true);
    });
  }

  async create(userId: string, input: CreateDebtDto, requestId: string): Promise<object> {
    const startDate = parseBusinessDate(input.startDate);
    const dueDate = input.dueDate ? parseBusinessDate(input.dueDate) : null;
    if (dueDate && dueDate.getTime() < startDate.getTime()) {
      throw badRequest('DEBT_DATE_INVALID', '到期日期不能早于开始日期');
    }
    const hash = debtCreateHash(input);
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:debt-create:${userId}:${input.idempotencyKey}`]);
      const actor = await this.repository.findActor(tx, userId);
      if (!actor) throw invisible();
      if (actor.status !== 'ACTIVE') throw forbidden();
      const replay = await this.repository.findByIdempotency(tx, userId, input.idempotencyKey);
      if (replay) {
        if (replay.deletedAt === null && replay.createRequestHash === hash) {
          return debtView(actor, replay, true);
        }
        throw conflict('IDEMPOTENCY_CONFLICT', '幂等键已消费或用于不同的借贷创建请求');
      }
      const principalCent = BigInt(input.principalCent);
      const debt = await this.repository.create(tx, {
        userId,
        direction: input.direction,
        counterpartyName: input.counterpartyName,
        principalCent,
        remainingCent: principalCent,
        startDate,
        dueDate,
        status: deriveDebtStatus(principalCent, dueDate, businessToday(actor.timezone)),
        note: input.note ?? null,
        reminderEnabled: input.reminderEnabled,
        idempotencyKey: input.idempotencyKey,
        createRequestHash: hash,
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'DEBT_CREATED',
        targetType: 'DEBT',
        targetId: debt.id,
        requestId,
        afterJson: { direction: debt.direction, status: debt.status },
      });
      return debtView(actor, debt, true);
    });
  }

  async update(
    userId: string,
    id: string,
    input: UpdateDebtDto,
    requestId: string,
  ): Promise<object> {
    const editableKeys = ['counterpartyName', 'dueDate', 'note', 'reminderEnabled'] as const;
    if (!editableKeys.some((key) => input[key] !== undefined)) {
      throw badRequest('VALIDATION_FAILED', '至少提供一个修改字段');
    }
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:debt:${id}`]);
      const actor = await this.repository.findActor(tx, userId);
      const debt = await this.repository.findOwnedById(tx, userId, id);
      if (!actor || !debt) throw invisible();
      if (actor.status !== 'ACTIVE') throw forbidden();
      const dueDate =
        input.dueDate === undefined
          ? debt.dueDate
          : input.dueDate
            ? parseBusinessDate(input.dueDate)
            : null;
      if (dueDate && dueDate.getTime() < debt.startDate.getTime()) {
        throw badRequest('DEBT_DATE_INVALID', '到期日期不能早于开始日期');
      }
      const changedFields = editableKeys.filter((key) => {
        if (input[key] === undefined) return false;
        if (key === 'dueDate')
          return (dueDate?.getTime() ?? null) !== (debt.dueDate?.getTime() ?? null);
        return input[key] !== debt[key];
      });
      if (changedFields.length === 0) return debtView(actor, debt, true);
      const updated = await this.repository.update(tx, id, {
        ...(input.counterpartyName !== undefined
          ? { counterpartyName: input.counterpartyName }
          : {}),
        ...(input.dueDate !== undefined ? { dueDate } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.reminderEnabled !== undefined ? { reminderEnabled: input.reminderEnabled } : {}),
        status: deriveDebtStatus(debt.remainingCent, dueDate, businessToday(actor.timezone)),
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'DEBT_UPDATED',
        targetType: 'DEBT',
        targetId: id,
        requestId,
        beforeJson: { status: debt.status },
        afterJson: { status: updated.status, changedFields },
      });
      return debtView(actor, updated, true);
    });
  }

  async delete(userId: string, id: string, requestId: string): Promise<object> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:debt:${id}`]);
      const actor = await this.repository.findActor(tx, userId);
      const debt = await this.repository.findOwnedById(tx, userId, id, true);
      if (!actor || !debt) throw invisible();
      if (actor.status !== 'ACTIVE') throw forbidden();
      if (debt.deletedAt) return { id, deleted: true };
      if (debt.transactions.some((transaction) => transaction.syncEntry)) {
        throw conflict('DEBT_HAS_SYNCED_ENTRY', '存在已同步账目的处理记录，不能删除该借贷');
      }
      const deletedAt = new Date();
      await this.repository.softDeleteTransactions(tx, id, deletedAt);
      await this.repository.update(tx, id, { deletedAt, status: 'CANCELLED' });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'DEBT_DELETED',
        targetType: 'DEBT',
        targetId: id,
        requestId,
        beforeJson: { status: debt.status },
        afterJson: { status: 'CANCELLED', changedFields: ['deletedAt'] },
      });
      return { id, deleted: true };
    });
  }

  async createTransaction(
    userId: string,
    debtId: string,
    input: CreateDebtTransactionDto,
    requestId: string,
  ): Promise<object> {
    const businessDate = parseBusinessDate(input.businessDate);
    const hash = transactionRequestHash(debtId, input);
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [
        `siyu:debt:${debtId}`,
        `siyu:debt-transaction:${userId}:${input.idempotencyKey}`,
      ]);
      const actor = await this.repository.findActor(tx, userId);
      const debt = await this.repository.findOwnedById(tx, userId, debtId);
      if (!actor || !debt) throw invisible();
      if (actor.status !== 'ACTIVE') throw forbidden();

      const replay = await this.repository.findTransactionByIdempotency(
        tx,
        userId,
        input.idempotencyKey,
      );
      if (replay) {
        if (replay.debtId === debtId && replay.deletedAt === null && replay.requestHash === hash) {
          return { debt: debtView(actor, debt, false), transaction: transactionView(replay) };
        }
        throw conflict('IDEMPOTENCY_CONFLICT', '幂等键已消费或用于不同的借贷处理请求');
      }

      const amountCent = BigInt(input.amountCent);
      if (amountCent > debt.remainingCent) {
        throw conflict('DEBT_AMOUNT_EXCEEDS_REMAINING', '处理金额不能超过剩余金额');
      }

      const transactionId = randomUUID();
      let entryId: string | null = null;
      if (input.syncEntry) {
        const entryType = debtTransactionEntryType(debt.direction);
        const ledger = await this.repository.findPersonalLedger(tx, userId);
        if (!ledger) throw conflict('DEBT_SYNC_LEDGER_UNAVAILABLE', '个人账本不可用，无法同步账目');
        const category = await this.repository.findDefaultCategory(tx, ledger.id, entryType);
        if (!category) {
          throw conflict('DEBT_SYNC_CATEGORY_UNAVAILABLE', '默认其他分类已停用，无法同步账目');
        }
        const entry = await this.repository.createSourceEntry(tx, {
          ledgerId: ledger.id,
          creatorUserId: userId,
          type: entryType,
          amountCent,
          categoryId: category.id,
          businessDate,
          note: input.note ?? null,
          sourceId: transactionId,
          idempotencyKey: `debt-transaction:${transactionId}`,
          createRequestHash: sourceEntryHash({
            ledgerId: ledger.id,
            type: entryType,
            amountCent: input.amountCent,
            categoryId: category.id,
            businessDate: input.businessDate,
            note: input.note ?? null,
            sourceId: transactionId,
          }),
        });
        entryId = entry.id;
      }

      const transaction = await this.repository.createTransaction(tx, {
        id: transactionId,
        debtId,
        userId,
        amountCent,
        businessDate,
        syncEntry: input.syncEntry,
        entryId,
        idempotencyKey: input.idempotencyKey,
        requestHash: hash,
        note: input.note ?? null,
      });
      const processedCent = debt.processedCent + amountCent;
      const remainingCent = debt.remainingCent - amountCent;
      const updated = await this.repository.update(tx, debtId, {
        processedCent,
        remainingCent,
        status: deriveDebtStatus(remainingCent, debt.dueDate, businessToday(actor.timezone)),
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'DEBT_TRANSACTION_CREATED',
        targetType: 'DEBT_TRANSACTION',
        targetId: transaction.id,
        requestId,
        afterJson: {
          debtId,
          syncEntry: input.syncEntry,
          status: updated.status,
          changedFields: ['processedCent', 'remainingCent', 'status'],
        },
      });
      return { debt: debtView(actor, updated, false), transaction: transactionView(transaction) };
    });
  }
}
