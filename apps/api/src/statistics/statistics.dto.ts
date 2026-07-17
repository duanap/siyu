import { IsOptional, IsUUID, Matches } from 'class-validator';

export class StatisticsQueryDto {
  @IsUUID('4')
  ledgerId!: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}
