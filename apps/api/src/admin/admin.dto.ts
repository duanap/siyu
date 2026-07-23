import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AdminPageDto {
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

export class AdminUsersQueryDto extends AdminPageDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  search?: string;
}

export class AdminLedgersQueryDto extends AdminPageDto {
  @IsOptional()
  @IsIn(['PERSONAL', 'COUPLE'])
  type?: 'PERSONAL' | 'COUPLE';

  @IsOptional()
  @IsIn(['ACTIVE', 'DISSOLVED'])
  status?: 'ACTIVE' | 'DISSOLVED';
}

export class AdminRunsQueryDto extends AdminPageDto {
  @IsOptional()
  @IsIn(['PENDING', 'GENERATED', 'CONFIRMED', 'SKIPPED', 'FAILED'])
  status?: 'PENDING' | 'GENERATED' | 'CONFIRMED' | 'SKIPPED' | 'FAILED';
}

export class AdminAuditQueryDto extends AdminPageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  action?: string;
}

export class AdminUserStatusDto {
  @IsIn(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}

export class AdminRetryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}
