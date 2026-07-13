import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Category, EntryType, Ledger, LedgerMember } from '@prisma/client';

import { CategoriesRepository } from './categories.repository';

type Membership = LedgerMember & { ledger: Ledger };

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function forbidden(code: string, message: string): ForbiddenException {
  return new ForbiddenException({ code, message });
}

function invisible(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: '分类不存在' });
}

function canCreate(membership: Membership): boolean {
  return membership.role === 'OWNER' || membership.ledger.type === 'COUPLE';
}

function canEdit(userId: string, membership: Membership, category: Category): boolean {
  return !category.isSystem && (membership.role === 'OWNER' || category.creatorUserId === userId);
}

function canToggle(userId: string, membership: Membership, category: Category): boolean {
  return membership.role === 'OWNER' || (!category.isSystem && category.creatorUserId === userId);
}

function categoryView(userId: string, membership: Membership, category: Category): object {
  return {
    id: category.id,
    ledgerId: category.ledgerId,
    creatorUserId: category.creatorUserId,
    type: category.type,
    name: category.name,
    icon: category.icon,
    color: category.color,
    sortOrder: category.sortOrder,
    isSystem: category.isSystem,
    isEnabled: category.isEnabled,
    canEdit: canEdit(userId, membership, category),
    canToggle: canToggle(userId, membership, category),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

@Injectable()
export class CategoriesService {
  constructor(@Inject(CategoriesRepository) private readonly repository: CategoriesRepository) {}

  async list(
    userId: string,
    ledgerId: string,
    type?: EntryType,
    includeDisabled = false,
  ): Promise<object> {
    return this.repository.transaction(async (tx) => {
      const membership = await this.repository.findMembership(tx, userId, ledgerId);
      if (!membership) throw invisible();
      const categories = await this.repository.list(tx, ledgerId, type, includeDisabled);
      return {
        items: categories.map((category) => categoryView(userId, membership, category)),
        permissions: {
          canCreate: canCreate(membership),
          canReorder: membership.role === 'OWNER',
        },
      };
    });
  }

  async create(
    userId: string,
    input: {
      ledgerId: string;
      type: EntryType;
      name: string;
      icon: string;
      color: string;
      idempotencyKey: string;
    },
    requestId: string,
  ): Promise<object> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:category-order:${input.ledgerId}:${input.type}`]);
      const membership = await this.repository.findMembership(tx, userId, input.ledgerId);
      if (!membership) throw invisible();
      if (!canCreate(membership)) throw forbidden('CATEGORY_PERMISSION_DENIED', '无权创建分类');
      const replay = await this.repository.findByIdempotency(tx, userId, input.idempotencyKey);
      if (replay) {
        if (
          replay.ledgerId === input.ledgerId &&
          replay.type === input.type &&
          replay.name === input.name &&
          replay.icon === input.icon &&
          replay.color.toUpperCase() === input.color.toUpperCase()
        )
          return categoryView(userId, membership, replay);
        throw conflict('IDEMPOTENCY_CONFLICT', '幂等键已用于不同的分类请求');
      }
      if (await this.repository.findActiveName(tx, input.ledgerId, input.type, input.name)) {
        throw conflict('CATEGORY_NAME_CONFLICT', '同类型下已存在同名启用分类');
      }
      const category = await this.repository.create(tx, {
        ...input,
        creatorUserId: userId,
        color: input.color.toUpperCase(),
        sortOrder: await this.repository.nextSortOrder(tx, input.ledgerId, input.type),
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'CATEGORY_CREATED',
        targetId: category.id,
        requestId,
        afterJson: { ledgerId: input.ledgerId, type: input.type, name: input.name },
      });
      return categoryView(userId, membership, category);
    });
  }

  async update(
    userId: string,
    categoryId: string,
    input: { name?: string; icon?: string; color?: string },
    requestId: string,
  ): Promise<object> {
    if (input.name === undefined && input.icon === undefined && input.color === undefined) {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', message: '至少提供一个修改字段' });
    }
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:category:${categoryId}`]);
      const category = await this.repository.findById(tx, categoryId);
      if (!category) throw invisible();
      const membership = await this.repository.findMembership(tx, userId, category.ledgerId);
      if (!membership) throw invisible();
      if (!canEdit(userId, membership, category)) {
        throw forbidden(
          category.isSystem ? 'CATEGORY_SYSTEM_IMMUTABLE' : 'CATEGORY_PERMISSION_DENIED',
          category.isSystem ? '系统分类不可编辑' : '无权编辑该分类',
        );
      }
      if (
        input.name &&
        category.isEnabled &&
        (await this.repository.findActiveName(
          tx,
          category.ledgerId,
          category.type,
          input.name,
          category.id,
        ))
      )
        throw conflict('CATEGORY_NAME_CONFLICT', '同类型下已存在同名启用分类');
      const updated = await this.repository.update(tx, categoryId, {
        ...input,
        ...(input.color ? { color: input.color.toUpperCase() } : {}),
      });
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'CATEGORY_UPDATED',
        targetId: categoryId,
        requestId,
        beforeJson: { name: category.name, icon: category.icon, color: category.color },
        afterJson: { name: updated.name, icon: updated.icon, color: updated.color },
      });
      return categoryView(userId, membership, updated);
    });
  }

  async setEnabled(
    userId: string,
    categoryId: string,
    enabled: boolean,
    requestId: string,
  ): Promise<object> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:category:${categoryId}`]);
      const category = await this.repository.findById(tx, categoryId);
      if (!category) throw invisible();
      await this.repository.lock(tx, [`siyu:category-order:${category.ledgerId}:${category.type}`]);
      const membership = await this.repository.findMembership(tx, userId, category.ledgerId);
      if (!membership) throw invisible();
      if (!canToggle(userId, membership, category)) {
        throw forbidden('CATEGORY_PERMISSION_DENIED', '无权启停该分类');
      }
      if (category.isEnabled === enabled) return categoryView(userId, membership, category);
      if (
        enabled &&
        (await this.repository.findActiveName(
          tx,
          category.ledgerId,
          category.type,
          category.name,
          category.id,
        ))
      )
        throw conflict('CATEGORY_NAME_CONFLICT', '存在同名启用分类，无法重新启用');
      const updated = await this.repository.setEnabled(tx, categoryId, enabled);
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: enabled ? 'CATEGORY_ENABLED' : 'CATEGORY_DISABLED',
        targetId: categoryId,
        requestId,
        beforeJson: { isEnabled: category.isEnabled },
        afterJson: { isEnabled: enabled },
      });
      return categoryView(userId, membership, updated);
    });
  }

  async reorder(
    userId: string,
    ledgerId: string,
    type: EntryType,
    categoryIds: string[],
    requestId: string,
  ): Promise<object> {
    return this.repository.transaction(async (tx) => {
      await this.repository.lock(tx, [`siyu:category-order:${ledgerId}:${type}`]);
      const membership = await this.repository.findMembership(tx, userId, ledgerId);
      if (!membership) throw invisible();
      if (membership.role !== 'OWNER') {
        throw forbidden('CATEGORY_PERMISSION_DENIED', '只有账本所有者可以排序分类');
      }
      const categories = await this.repository.list(tx, ledgerId, type, true);
      if (
        categories.length !== categoryIds.length ||
        categories.some((category) => !categoryIds.includes(category.id))
      )
        throw conflict('CATEGORY_REORDER_INVALID', '排序列表必须包含该类型的全部分类');
      if (categories.every((category, index) => category.id === categoryIds[index])) {
        return {
          items: categories.map((category) => categoryView(userId, membership, category)),
          permissions: { canCreate: true, canReorder: true },
        };
      }
      await this.repository.reorder(tx, categoryIds);
      await this.repository.audit(tx, {
        actorUserId: userId,
        action: 'CATEGORIES_REORDERED',
        targetId: ledgerId,
        requestId,
        afterJson: { type, categoryIds },
      });
      const reordered = await this.repository.list(tx, ledgerId, type, true);
      return {
        items: reordered.map((category) => categoryView(userId, membership, category)),
        permissions: { canCreate: true, canReorder: true },
      };
    });
  }
}
