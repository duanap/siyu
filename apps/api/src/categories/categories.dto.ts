import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { EntryType } from '@prisma/client';

import { CATEGORY_ICON_KEYS } from './category-defaults';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const booleanValue = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false || value === undefined) return false;
  return value;
};

export class ListCategoriesDto {
  @IsUUID()
  ledgerId!: string;

  @IsOptional()
  @IsEnum(EntryType)
  type?: EntryType;

  @IsOptional()
  @Transform(booleanValue)
  @IsBoolean()
  includeDisabled = false;
}

export class CreateCategoryDto {
  @IsUUID()
  ledgerId!: string;

  @IsEnum(EntryType)
  type!: EntryType;

  @Transform(trim)
  @IsString()
  @Length(1, 50)
  name!: string;

  @IsString()
  @IsIn(CATEGORY_ICON_KEYS)
  icon!: string;

  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color!: string;

  @IsString()
  @Length(8, 128)
  idempotencyKey!: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(CATEGORY_ICON_KEYS)
  icon?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color?: string;
}

export class ReorderCategoriesDto {
  @IsUUID()
  ledgerId!: string;

  @IsEnum(EntryType)
  type!: EntryType;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @Type(() => String)
  categoryIds!: string[];
}
