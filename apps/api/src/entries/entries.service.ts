import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Ledger, LedgerMember, UserStatus } from '@prisma/client';

import type { CreateEntryDto, ListEntriesDto, UpdateEntryDto } from './entries.dto';
import { EntriesRepository, type EntryRecord } from './entries.repository';

type Membership = LedgerMember & { ledger: Ledger };
type Actor = { id: string; status: UserStatus; timezone: string };

function invisible(): NotFoundException {
  return new NotFoundException({ code: 'ENTRY_NOT_FOUND', message: '账本或账目不存在' });
}

function forbidden(): ForbiddenException {
  return new ForbiddenException({ code: 'ENTRY_PERMISSION_DENIED', message: '无权操作该账目' });
}

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function badRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}

function validAccess(userId: string, membership: Membership): boolean {
  return membership.ledger.type === 'COUPLE'
    ? true
    : membership.role === 'OWNER' && membership.ledger.ownerUserId === userId;
}

function entryMembership(userId: string, entry: EntryRecord): Membership | undefined {
  const member = entry.ledger.members.find(
    (candidate) => candidate.userId === userId && candidate.status === 'ACTIVE',
  );
  return member ? ({ ...member, ledger: entry.ledger } as Membership) : undefined;
}

function hasWriteOwnership(userId: string, membership: Membership, entry: EntryRecord): boolean {
  return (
    membership.role === 'OWNER' ||
    (membership.ledger.type === 'COUPLE' && entry.creatorUserId === userId)
  );
}

function capabilities(
  userId: string,
  actor: Actor,
  membership: Membership,
  entry: EntryRecord,
): { canEdit: boolean; canDelete: boolean } {
  const allowed =
    actor.status === 'ACTIVE' &&
    entry.deletedAt === null &&
    entry.sourceType === 'MANUAL' &&
    hasWriteOwnership(userId, membership, entry);
  return { canEdit: allowed, canDelete: allowed };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function entryView(
  userId: string,
  actor: Actor,
  membership: Membership,
  entry: EntryRecord,
): object {
  return {
    id: entry.id,
    ledgerId: entry.ledgerId,
    type: entry.type,
    amountCent: Number(entry.amountCent),
    businessDate: dateOnly(entry.businessDate),
    note: entry.note,
    paymentMethod: entry.paymentMethod,
    sourceType: entry.sourceType,
    creator: entry.creator,
    category: entry.category,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    version: entry.version,
    ...capabilities(userId, actor, membership, entry),
  };
}

function parseBusinessDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || dateOnly(date) !== value) {
    throw badRequest('VALIDATION_FAILED', '业务日期无效');
  }
  return date;
}

function currentMonth(timezone: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
  }
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return `${year}-${month}`;
}

function monthRange(month: string): { startDate: Date; endDate: Date } {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return {
    startDate: new Date(Date.UTC(year, monthNumber - 1, 1)),
    endDate: new Date(Date.UTC(year, monthNumber, 1)),
  };
}

function requestHash(input: CreateEntryDto): string {
  const canonical = JSON.stringify({
    contractVersion: 1,
    ledgerId: input.ledgerId,
    type: input.type,
    amountCent: String(input.amountCent),
    categoryId: input.categoryId,
    businessDate: input.businessDate,
    note: input.note ?? null,
    paymentMethod: input.paymentMethod ?? null,
    sourceType: 'MANUAL',
  });
  return createHash('sha256').update(canonical).digest('hex');
}

@Injectable()
export class EntriesService {
  constructor(@Inject(EntriesRepository) private readonly repository: EntriesRepository) {}

  async list(userId: string, query: ListEntriesDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      const membership = await this.repository.findMembership(tx, userId, query.ledgerId);
      if (!actor || !membership || !validAccess(userId, membership)) throw invisible();
      const month = query.month ?? currentMonth(actor.timezone);
      const result = await this.repository.list(tx, {
        ledgerId: query.ledgerId,
        ...monthRange(month),
        ...(query.type ? { type: query.type } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.creatorUserId ? { creatorUserId: query.creatorUserId } : {}),
        ...(query.keyword ? { keyword: query.keyword } : {}),
        page: query.page,
        pageSize: query.pageSize,
      });
      return {
        items: result.items.map((entry) => entryView(userId, actor, membership, entry)),
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
      const entry = await this.repository.findVisibleById(tx, userId, id);
      if (!actor || !entry) throw invisible();
      const membership = entryMembership(userId, entry);
      if (!membership || !validAccess(userId, membership)) throw invisible();
      return entryView(userId, actor, membership, entry);
    });
  }

  async create(userId: string, input: CreateEntryDto, requestId: string): Promise<object> {
    const hash = requestHash(input);
    const businessDate = parseBusinessDate(input.businessDate);
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [
        `siyu:category:${input.categoryId}`,
        `siyu:couple-ledger:${input.ledgerId}`,
        `siyu:entry-create:${userId}:${input.idempotencyKey}`,
      ]);
      const actor = await this.repository.findActor(tx, userId);
      const membership = await this.repository.findMembership(tx, userId, input.ledgerId);
      if (!actor || !membership || !validAccess(userId, membership)) throw invisible();
      if (actor.status !== 'ACTIVE') throw forbidden();

      const replay = await this.repository.findByIdempotency(tx, userId, input.idempotencyKey);
      if (replay) {
        if (replay.createRequestHash === hash && replay.deletedAt === null) {
          return entryView(userId, actor, membership, replay);
        }
        throw conflict('IDEMPOTENCY_CONFLICT', '幂等键已消费或用于不同的创建请求');
      }

      const category = await this.repository.findCategory(tx, input.categoryId);
      if (!category || category.ledgerId !== input.ledgerId || category.type !== input.type) {
        throw badRequest('ENTRY_CATEGORY_INVALID', '分类与账本或账目类型不匹配');
      }
      if (!category.isEnabled) throw conflict('CATEGORY_DISABLED', '分类已停用');

      const entry = await this.repository.create(tx, {
        ledgerId: input.ledgerId,
        creatorUserId: userId,
        type: input.type,
        amountCent: BigInt(input.amountCent),
        categoryId: input.categoryId,
        businessDate,
        note: input.note ?? null,
        paymentMethod: input.paymentMethod ?? null,
        idempotencyKey: input.idempotencyKey,
        createRequestHash: hash,
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'ENTRY_CREATED',
        targetId: entry.id,
        requestId,
        afterJson: {
          ledgerId: entry.ledgerId,
          type: entry.type,
          sourceType: entry.sourceType,
        },
      });
      return entryView(userId, actor, membership, entry);
    });
  }

  async update(
    userId: string,
    id: string,
    input: UpdateEntryDto,
    requestId: string,
  ): Promise<object> {
    const editableKeys = [
      'type',
      'amountCent',
      'categoryId',
      'businessDate',
      'note',
      'paymentMethod',
    ] as const;
    if (!editableKeys.some((key) => input[key] !== undefined)) {
      throw badRequest('VALIDATION_FAILED', '至少提供一个修改字段');
    }

    return this.repository.transaction(async (tx) => {
      const visibleEntry = await this.repository.findVisibleById(tx, userId, id);
      if (!visibleEntry) throw invisible();
      await this.repository.lock(tx, [
        `siyu:couple-ledger:${visibleEntry.ledgerId}`,
        `siyu:entry:${id}`,
        ...(input.type !== undefined || input.categoryId !== undefined
          ? [`siyu:category:${input.categoryId ?? visibleEntry.categoryId}`]
          : []),
      ]);
      const actor = await this.repository.findActor(tx, userId);
      const entry = await this.repository.findVisibleById(tx, userId, id);
      if (!actor || !entry) throw invisible();
      const membership = entryMembership(userId, entry);
      if (!membership || !validAccess(userId, membership)) throw invisible();
      if (actor.status !== 'ACTIVE' || !hasWriteOwnership(userId, membership, entry)) {
        throw forbidden();
      }
      if (entry.sourceType !== 'MANUAL') {
        throw conflict('ENTRY_SOURCE_MANAGED', '来源账目只能由对应业务模块维护');
      }
      if (entry.version !== input.expectedVersion) {
        throw conflict('ENTRY_VERSION_CONFLICT', '账目已被其他操作修改');
      }

      const nextType = input.type ?? entry.type;
      const nextCategoryId = input.categoryId ?? entry.categoryId;
      if (input.type !== undefined || input.categoryId !== undefined) {
        const category = await this.repository.findCategory(tx, nextCategoryId);
        if (!category || category.ledgerId !== entry.ledgerId || category.type !== nextType) {
          throw badRequest('ENTRY_CATEGORY_INVALID', '分类与账本或账目类型不匹配');
        }
        if (!category.isEnabled) throw conflict('CATEGORY_DISABLED', '分类已停用');
      }

      const nextDate =
        input.businessDate === undefined
          ? entry.businessDate
          : parseBusinessDate(input.businessDate);
      const nextAmount =
        input.amountCent === undefined ? entry.amountCent : BigInt(input.amountCent);
      const nextNote = input.note === undefined ? entry.note : input.note;
      const nextPayment =
        input.paymentMethod === undefined ? entry.paymentMethod : input.paymentMethod;
      const changedFields: string[] = [];
      if (nextType !== entry.type) changedFields.push('type');
      if (nextAmount !== entry.amountCent) changedFields.push('amountCent');
      if (nextCategoryId !== entry.categoryId) changedFields.push('categoryId');
      if (nextDate.getTime() !== entry.businessDate.getTime()) changedFields.push('businessDate');
      if (nextNote !== entry.note) changedFields.push('note');
      if (nextPayment !== entry.paymentMethod) changedFields.push('paymentMethod');
      if (changedFields.length === 0) return entryView(userId, actor, membership, entry);

      const result = await this.repository.updateIfVersion(tx, id, input.expectedVersion, {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.amountCent !== undefined ? { amountCent: nextAmount } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.businessDate !== undefined ? { businessDate: nextDate } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
      });
      if (result.count !== 1) {
        throw conflict('ENTRY_VERSION_CONFLICT', '账目已被其他操作修改');
      }
      const updated = await this.repository.findVisibleById(tx, userId, id);
      if (!updated) throw invisible();
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'ENTRY_UPDATED',
        targetId: id,
        requestId,
        beforeJson: { version: entry.version },
        afterJson: {
          ledgerId: entry.ledgerId,
          type: updated.type,
          sourceType: updated.sourceType,
          version: updated.version,
          changedFields,
        },
      });
      return entryView(userId, actor, membership, updated);
    });
  }

  async delete(
    userId: string,
    id: string,
    expectedVersion: number,
    requestId: string,
  ): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const visibleEntry = await this.repository.findVisibleById(tx, userId, id, true);
      if (!visibleEntry) throw invisible();
      await this.repository.lock(tx, [
        `siyu:couple-ledger:${visibleEntry.ledgerId}`,
        `siyu:entry:${id}`,
      ]);
      const actor = await this.repository.findActor(tx, userId);
      const entry = await this.repository.findVisibleById(tx, userId, id, true);
      if (!actor || !entry) throw invisible();
      const membership = entryMembership(userId, entry);
      if (!membership || !validAccess(userId, membership)) throw invisible();
      if (actor.status !== 'ACTIVE' || !hasWriteOwnership(userId, membership, entry)) {
        throw forbidden();
      }
      if (entry.sourceType !== 'MANUAL') {
        throw conflict('ENTRY_SOURCE_MANAGED', '来源账目只能由对应业务模块维护');
      }

      if (entry.deletedAt !== null) {
        if (entry.version === expectedVersion + 1) {
          return { id: entry.id, deleted: true, version: entry.version };
        }
        throw conflict('ENTRY_VERSION_CONFLICT', '账目删除版本不匹配');
      }
      if (entry.version !== expectedVersion) {
        throw conflict('ENTRY_VERSION_CONFLICT', '账目已被其他操作修改');
      }

      const deletedAt = new Date();
      const result = await this.repository.deleteIfVersion(tx, id, expectedVersion, deletedAt);
      if (result.count !== 1) {
        throw conflict('ENTRY_VERSION_CONFLICT', '账目已被其他操作修改');
      }
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'ENTRY_DELETED',
        targetId: id,
        requestId,
        beforeJson: { version: entry.version },
        afterJson: {
          ledgerId: entry.ledgerId,
          type: entry.type,
          sourceType: entry.sourceType,
          version: entry.version + 1,
          changedFields: ['deletedAt'],
        },
      });
      return { id: entry.id, deleted: true, version: entry.version + 1 };
    });
  }
}
