import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { EntryPaymentMethod, EntryType } from '@prisma/client';

const MAX_SAFE_CENT = Number.MAX_SAFE_INTEGER;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const trimOptional = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
};
const trimNullable = ({ value }: { value: unknown }): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
};

class EntryFieldsDto {
  @IsOptional()
  @IsEnum(EntryType)
  type?: EntryType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_CENT)
  amountCent?: number;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/)
  businessDate?: string;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 500)
  note?: string | null;

  @IsOptional()
  @IsEnum(EntryPaymentMethod)
  paymentMethod?: EntryPaymentMethod | null;
}

export class ListEntriesDto {
  @IsUUID('4')
  ledgerId!: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;

  @IsOptional()
  @IsEnum(EntryType)
  type?: EntryType;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsUUID('4')
  creatorUserId?: string;

  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @Length(1, 100)
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class CreateEntryDto {
  @IsUUID('4')
  ledgerId!: string;

  @IsEnum(EntryType)
  type!: EntryType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_CENT)
  amountCent!: number;

  @IsUUID('4')
  categoryId!: string;

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/)
  businessDate!: string;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 500)
  note?: string | null;

  @IsOptional()
  @IsEnum(EntryPaymentMethod)
  paymentMethod?: EntryPaymentMethod | null;

  @Transform(trim)
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey!: string;
}

export class UpdateEntryDto extends EntryFieldsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class DeleteEntryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
