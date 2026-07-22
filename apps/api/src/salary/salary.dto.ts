import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { SalaryItemType } from '@prisma/client';

const MAX_SAFE_CENT = Number.MAX_SAFE_INTEGER;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const ITEM_CODE_PATTERN = /^[a-z][a-z0-9_]{0,49}$/;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const trimNullable = ({ value }: { value: unknown }): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
};
const normalizeCode = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class SalaryTemplateItemDto {
  @IsEnum(SalaryItemType)
  itemType!: SalaryItemType;

  @Transform(normalizeCode)
  @IsString()
  @Matches(ITEM_CODE_PATTERN)
  itemCode!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  itemName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_SAFE_CENT)
  amountCent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder!: number;
}

export class SalaryRecordItemDto extends SalaryTemplateItemDto {
  @Min(1)
  declare amountCent: number;
}

export class CreateSalaryProfileDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 100)
  employerName?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  payDay!: number;

  @IsBoolean()
  defaultSyncEntry!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SalaryTemplateItemDto)
  defaultItems!: SalaryTemplateItemDto[];

  @Transform(trim)
  @IsString()
  @Length(8, 128)
  @Matches(IDEMPOTENCY_PATTERN)
  idempotencyKey!: string;
}

export class UpdateSalaryProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @Transform(trimNullable)
  @IsString()
  @Length(1, 100)
  employerName?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  payDay?: number;

  @IsOptional()
  @IsBoolean()
  defaultSyncEntry?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SalaryTemplateItemDto)
  defaultItems?: SalaryTemplateItemDto[];
}

export class ListSalaryRecordsDto {
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number;

  @IsOptional()
  @IsUUID('4')
  profileId?: string;
}

export class CreateSalaryRecordDto {
  @IsUUID('4')
  profileId!: string;

  @IsString()
  @Matches(MONTH_PATTERN)
  salaryMonth!: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SalaryRecordItemDto)
  items?: SalaryRecordItemDto[];

  @IsOptional()
  @IsBoolean()
  copyPreviousMonth = false;

  @Transform(trim)
  @IsString()
  @Length(8, 128)
  @Matches(IDEMPOTENCY_PATTERN)
  idempotencyKey!: string;
}

export class UpdateSalaryRecordDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => SalaryRecordItemDto)
  items!: SalaryRecordItemDto[];
}

export class MarkSalaryPaidDto {
  @IsString()
  @Matches(DATE_PATTERN)
  paidDate!: string;

  @IsBoolean()
  syncEntry!: boolean;

  @Transform(trim)
  @IsString()
  @Length(8, 128)
  @Matches(IDEMPOTENCY_PATTERN)
  idempotencyKey!: string;
}
