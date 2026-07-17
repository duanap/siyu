import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { DebtDirection } from '@prisma/client';

const MAX_SAFE_CENT = Number.MAX_SAFE_INTEGER;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const trimNullable = ({ value }: { value: unknown }): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
};

export class ListDebtsDto {
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

export class CreateDebtDto {
  @IsEnum(DebtDirection)
  direction!: DebtDirection;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  counterpartyName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_CENT)
  principalCent!: number;

  @IsString()
  @Matches(DATE_PATTERN)
  startDate!: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  dueDate?: string | null;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 500)
  note?: string | null;

  @IsOptional()
  @IsBoolean()
  reminderEnabled = false;

  @Transform(trim)
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey!: string;
}

export class UpdateDebtDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  counterpartyName?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  dueDate?: string | null;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 500)
  note?: string | null;

  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;
}

export class CreateDebtTransactionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_CENT)
  amountCent!: number;

  @IsString()
  @Matches(DATE_PATTERN)
  businessDate!: string;

  @IsBoolean()
  syncEntry!: boolean;

  @Transform(trim)
  @IsString()
  @Length(8, 128)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  idempotencyKey!: string;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 500)
  note?: string | null;
}
