import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const MAX_SAFE_CENT = Number.MAX_SAFE_INTEGER;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const trimNullable = ({ value }: { value: unknown }): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
};

export class ListSavingGoalsDto {
  @IsOptional()
  @IsUUID('4')
  ledgerId?: string;

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

export class CreateSavingGoalDto {
  @IsUUID('4')
  ledgerId!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_CENT)
  targetCent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_CENT)
  initialCent!: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  targetDate?: string | null;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 2048)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  coverUrl?: string | null;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 500)
  note?: string | null;

  @Transform(trim)
  @IsString()
  @Length(8, 128)
  @Matches(IDEMPOTENCY_PATTERN)
  idempotencyKey!: string;
}

export class UpdateSavingGoalDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_CENT)
  targetCent?: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  targetDate?: string | null;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 2048)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  coverUrl?: string | null;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 500)
  note?: string | null;
}

export class CreateSavingContributionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_CENT)
  amountCent!: number;

  @IsString()
  @Matches(DATE_PATTERN)
  businessDate!: string;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 500)
  note?: string | null;

  @Transform(trim)
  @IsString()
  @Length(8, 128)
  @Matches(IDEMPOTENCY_PATTERN)
  idempotencyKey!: string;
}

export class UpdateSavingContributionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_CENT)
  amountCent?: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  businessDate?: string;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 500)
  note?: string | null;
}
