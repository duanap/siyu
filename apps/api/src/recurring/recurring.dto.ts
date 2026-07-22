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
import { EntryType, GenerationMode, RecurringFrequency, RecurringRunStatus } from '@prisma/client';

const MAX_SAFE_CENT = Number.MAX_SAFE_INTEGER;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ListRecurringRulesDto {
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

export class CreateRecurringRuleDto {
  @IsUUID('4')
  ledgerId!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsEnum(EntryType)
  entryType!: EntryType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_CENT)
  amountCent!: number;

  @IsUUID('4')
  categoryId!: string;

  @IsEnum(RecurringFrequency)
  frequency!: RecurringFrequency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1200)
  intervalValue = 1;

  @IsString()
  @Matches(DATE_PATTERN)
  startDate!: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  endDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalOccurrences?: number | null;

  @IsEnum(GenerationMode)
  generationMode!: GenerationMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  reminderDaysBefore = 1;

  @Transform(trim)
  @IsString()
  @Length(8, 128)
  @Matches(IDEMPOTENCY_PATTERN)
  idempotencyKey!: string;
}

export class UpdateRecurringRuleDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsEnum(EntryType)
  entryType?: EntryType;

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
  @IsEnum(RecurringFrequency)
  frequency?: RecurringFrequency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1200)
  intervalValue?: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN)
  endDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalOccurrences?: number | null;

  @IsOptional()
  @IsEnum(GenerationMode)
  generationMode?: GenerationMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  reminderDaysBefore?: number;
}

export class ListRecurringRunsDto {
  @IsOptional()
  @IsEnum(RecurringRunStatus)
  status?: RecurringRunStatus;

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

export class ConfirmRecurringRunDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SAFE_CENT)
  amountCent!: number;

  @Transform(trim)
  @IsString()
  @Length(8, 128)
  @Matches(IDEMPOTENCY_PATTERN)
  idempotencyKey!: string;
}
