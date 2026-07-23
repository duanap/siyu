import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

const BUSINESS_DATE = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

export class ExportEntriesDto {
  @IsUUID('4')
  ledgerId!: string;

  @IsOptional()
  @Matches(BUSINESS_DATE)
  startDate?: string;

  @IsOptional()
  @Matches(BUSINESS_DATE)
  endDate?: string;
}

export class ExportSalaryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number;
}
