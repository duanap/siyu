import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SalaryItemType, UserStatus } from '@prisma/client';

import type {
  CreateSalaryProfileDto,
  CreateSalaryRecordDto,
  ListSalaryRecordsDto,
  SalaryRecordItemDto,
  SalaryTemplateItemDto,
  UpdateSalaryProfileDto,
  UpdateSalaryRecordDto,
} from './salary.dto';
import {
  SalaryRepository,
  type SalaryItemInput,
  type SalaryProfileRecord,
  type SalaryRecordRecord,
} from './salary.repository';

type Actor = { id: string; status: UserStatus };

function invisible(): NotFoundException {
  return new NotFoundException({ code: 'SALARY_NOT_FOUND', message: '工资档案或记录不存在' });
}
function forbidden(): ForbiddenException {
  return new ForbiddenException({
    code: 'SALARY_PERMISSION_DENIED',
    message: '当前账号不能修改工资数据',
  });
}
function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}
function invalid(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}
function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
function parseMonth(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || dateOnly(parsed) !== value || !value.endsWith('-01')) {
    throw invalid('SALARY_MONTH_INVALID', '工资月份必须是有效月份的第一天');
  }
  return parsed;
}
export function previousSalaryMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() - 1, 1));
}

function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function canonicalItems(items: SalaryTemplateItemDto[]) {
  return items.map((item) => ({
    itemType: item.itemType,
    itemCode: item.itemCode,
    itemName: item.itemName,
    amountCent: String(item.amountCent),
    sortOrder: item.sortOrder,
  }));
}
function profileHash(input: CreateSalaryProfileDto): string {
  return requestHash({
    contractVersion: 1,
    name: input.name,
    employerName: input.employerName ?? null,
    payDay: input.payDay,
    defaultSyncEntry: input.defaultSyncEntry,
    defaultItems: canonicalItems(input.defaultItems),
  });
}
function recordHash(input: CreateSalaryRecordDto): string {
  return requestHash({
    contractVersion: 1,
    profileId: input.profileId,
    salaryMonth: input.salaryMonth,
    copyPreviousMonth: input.copyPreviousMonth,
    items: input.items ? canonicalItems(input.items) : null,
  });
}

function normalizeItems(items: SalaryTemplateItemDto[], allowZero: boolean): SalaryItemInput[] {
  const seen = new Set<string>();
  let hasEarning = false;
  const normalized = items.map((item) => {
    if (seen.has(item.itemCode))
      throw invalid('SALARY_ITEM_DUPLICATE', '同一工资模板或记录内项目代码不能重复');
    seen.add(item.itemCode);
    if (item.itemType === 'EARNING') hasEarning = true;
    if (!allowZero && item.amountCent <= 0)
      throw invalid('SALARY_ITEM_AMOUNT_INVALID', '月度工资项目金额必须大于零');
    return { ...item, amountCent: BigInt(item.amountCent) };
  });
  if (!hasEarning) throw invalid('SALARY_EARNING_REQUIRED', '至少需要一个收入项目');
  return normalized;
}

export function calculateSalaryTotals(
  items: Array<{ itemType: SalaryItemType; amountCent: bigint }>,
) {
  let grossCent = 0n;
  let deductionCent = 0n;
  for (const item of items) {
    if (item.itemType === 'EARNING') grossCent += item.amountCent;
    else deductionCent += item.amountCent;
  }
  if (grossCent <= 0n) throw invalid('SALARY_EARNING_REQUIRED', '应发工资必须大于零');
  if (deductionCent > grossCent)
    throw invalid('SALARY_DEDUCTION_EXCEEDS_GROSS', '个人扣除不能大于应发工资');
  if (
    grossCent > BigInt(Number.MAX_SAFE_INTEGER) ||
    deductionCent > BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw invalid('SALARY_AMOUNT_OUT_OF_RANGE', '工资汇总超过安全金额范围');
  return { grossCent, deductionCent, netCent: grossCent - deductionCent };
}

function itemView(
  item:
    SalaryItemInput | SalaryProfileRecord['items'][number] | SalaryRecordRecord['items'][number],
) {
  return {
    ...(Reflect.has(item, 'id') ? { id: (item as { id: string }).id } : {}),
    itemType: item.itemType,
    itemCode: item.itemCode,
    itemName: item.itemName,
    amountCent: Number(item.amountCent),
    sortOrder: item.sortOrder,
  };
}
function profileView(actor: Actor, profile: SalaryProfileRecord) {
  return {
    id: profile.id,
    name: profile.name,
    employerName: profile.employerName,
    payDay: profile.payDay,
    defaultSyncEntry: profile.defaultSyncEntry,
    status: profile.status,
    defaultItems: profile.items.map(itemView),
    canEdit: actor.status === 'ACTIVE' && profile.status === 'ACTIVE',
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}
function recordView(actor: Actor, record: SalaryRecordRecord) {
  return {
    id: record.id,
    profileId: record.profileId,
    profile: record.profile,
    salaryMonth: dateOnly(record.salaryMonth),
    grossCent: Number(record.grossCent),
    deductionCent: Number(record.deductionCent),
    netCent: Number(record.netCent),
    paymentStatus: record.paymentStatus,
    paidDate: record.paidDate ? dateOnly(record.paidDate) : null,
    entryId: record.entryId,
    items: record.items.map(itemView),
    canEdit: actor.status === 'ACTIVE' && record.paymentStatus === 'UNPAID',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class SalaryService {
  constructor(@Inject(SalaryRepository) private readonly repository: SalaryRepository) {}

  async listProfiles(userId: string): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      if (!actor) throw invisible();
      return {
        items: (await this.repository.listProfiles(tx, userId)).map((item) =>
          profileView(actor, item),
        ),
      };
    });
  }

  async createProfile(
    userId: string,
    input: CreateSalaryProfileDto,
    requestId: string,
  ): Promise<object> {
    const hash = profileHash(input);
    const items = normalizeItems(input.defaultItems, true);
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [
        `siyu:salary-profile:${userId}`,
        `siyu:salary-profile-create:${userId}:${input.idempotencyKey}`,
      ]);
      const actor = await this.repository.findActor(tx, userId);
      if (!actor) throw invisible();
      if (actor.status !== 'ACTIVE') throw forbidden();
      const replay = await this.repository.findProfileByIdempotency(
        tx,
        userId,
        input.idempotencyKey,
      );
      if (replay) {
        if (!replay.deletedAt && replay.createRequestHash === hash)
          return profileView(actor, replay);
        throw conflict('IDEMPOTENCY_CONFLICT', '幂等键已用于不同的工资档案请求');
      }
      if (await this.repository.findActiveProfile(tx, userId))
        throw conflict('SALARY_PROFILE_EXISTS', '当前已有有效工资档案');
      const created = await this.repository.createProfile(tx, {
        userId,
        name: input.name,
        employerName: input.employerName ?? null,
        payDay: input.payDay,
        defaultSyncEntry: input.defaultSyncEntry,
        idempotencyKey: input.idempotencyKey,
        createRequestHash: hash,
        items,
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'SALARY_PROFILE_CREATED',
        targetType: 'SALARY_PROFILE',
        targetId: created.id,
        requestId,
        afterJson: { itemCount: items.length },
      });
      return profileView(actor, created);
    });
  }

  async updateProfile(
    userId: string,
    id: string,
    input: UpdateSalaryProfileDto,
    requestId: string,
  ): Promise<object> {
    if (!Object.values(input).some((value) => value !== undefined))
      throw invalid('VALIDATION_FAILED', '至少提供一个修改字段');
    const items = input.defaultItems ? normalizeItems(input.defaultItems, true) : undefined;
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:salary-profile:${id}`]);
      const actor = await this.repository.findActor(tx, userId);
      const current = await this.repository.findProfile(tx, userId, id);
      if (!actor || !current) throw invisible();
      if (actor.status !== 'ACTIVE' || current.status !== 'ACTIVE') throw forbidden();
      const updated = await this.repository.updateProfile(tx, id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.employerName !== undefined ? { employerName: input.employerName } : {}),
        ...(input.payDay !== undefined ? { payDay: input.payDay } : {}),
        ...(input.defaultSyncEntry !== undefined
          ? { defaultSyncEntry: input.defaultSyncEntry }
          : {}),
        ...(items ? { items } : {}),
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'SALARY_PROFILE_UPDATED',
        targetType: 'SALARY_PROFILE',
        targetId: id,
        requestId,
        afterJson: { templateReplaced: Boolean(items) },
      });
      return profileView(actor, updated);
    });
  }

  async listRecords(userId: string, query: ListSalaryRecordsDto): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      if (!actor) throw invisible();
      const result = await this.repository.listRecords(tx, userId, query);
      return {
        items: result.items.map((item) => recordView(actor, item)),
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        hasNext: query.page * query.pageSize < result.total,
      };
    });
  }

  async getRecord(userId: string, id: string): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const actor = await this.repository.findActor(tx, userId);
      const record = await this.repository.findRecord(tx, userId, id);
      if (!actor || !record) throw invisible();
      return recordView(actor, record);
    });
  }

  async createRecord(
    userId: string,
    input: CreateSalaryRecordDto,
    requestId: string,
  ): Promise<object> {
    const hasItems = input.items !== undefined;
    if (hasItems === input.copyPreviousMonth)
      throw invalid('SALARY_ITEM_SOURCE_INVALID', '必须且只能选择显式项目或复制上月');
    const salaryMonth = parseMonth(input.salaryMonth);
    const hash = recordHash(input);
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [
        `siyu:salary-profile:${input.profileId}`,
        `siyu:salary-record:${input.profileId}:${input.salaryMonth}`,
        `siyu:salary-record-create:${userId}:${input.idempotencyKey}`,
      ]);
      const actor = await this.repository.findActor(tx, userId);
      const profile = await this.repository.findProfile(tx, userId, input.profileId);
      if (!actor || !profile) throw invisible();
      if (actor.status !== 'ACTIVE' || profile.status !== 'ACTIVE') throw forbidden();
      const replay = await this.repository.findRecordByIdempotency(
        tx,
        userId,
        input.idempotencyKey,
      );
      if (replay) {
        if (!replay.deletedAt && replay.createRequestHash === hash)
          return recordView(actor, replay);
        throw conflict('IDEMPOTENCY_CONFLICT', '幂等键已用于不同的工资记录请求');
      }
      if (await this.repository.findRecordByMonth(tx, userId, input.profileId, salaryMonth))
        throw conflict('SALARY_MONTH_DUPLICATE', '该工资档案和月份已有有效记录');
      let sourceItems: SalaryRecordItemDto[];
      if (input.items) sourceItems = input.items;
      else {
        const previous = await this.repository.findRecordByMonth(
          tx,
          userId,
          input.profileId,
          previousSalaryMonth(salaryMonth),
        );
        if (!previous)
          throw invalid('SALARY_PREVIOUS_MONTH_NOT_FOUND', '紧邻上月没有可复制的工资记录');
        sourceItems = previous.items.map((item) => ({
          itemType: item.itemType,
          itemCode: item.itemCode,
          itemName: item.itemName,
          amountCent: Number(item.amountCent),
          sortOrder: item.sortOrder,
        }));
      }
      const items = normalizeItems(sourceItems, false);
      const totals = calculateSalaryTotals(items);
      const created = await this.repository.createRecord(tx, {
        userId,
        profileId: input.profileId,
        salaryMonth,
        ...totals,
        idempotencyKey: input.idempotencyKey,
        createRequestHash: hash,
        items,
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'SALARY_RECORD_CREATED',
        targetType: 'SALARY_RECORD',
        targetId: created.id,
        requestId,
        afterJson: { salaryMonth: input.salaryMonth, itemCount: items.length },
      });
      return recordView(actor, created);
    });
  }

  async updateRecord(
    userId: string,
    id: string,
    input: UpdateSalaryRecordDto,
    requestId: string,
  ): Promise<object> {
    const items = normalizeItems(input.items, false);
    const totals = calculateSalaryTotals(items);
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:salary-record:${id}`]);
      const actor = await this.repository.findActor(tx, userId);
      const current = await this.repository.findRecord(tx, userId, id);
      if (!actor || !current) throw invisible();
      if (actor.status !== 'ACTIVE') throw forbidden();
      if (current.paymentStatus === 'PAID')
        throw conflict('SALARY_ALREADY_PAID', '已到账工资记录不能修改');
      const updated = await this.repository.updateRecord(tx, id, { ...totals, items });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'SALARY_RECORD_UPDATED',
        targetType: 'SALARY_RECORD',
        targetId: id,
        requestId,
        afterJson: { itemCount: items.length },
      });
      return recordView(actor, updated);
    });
  }
}
