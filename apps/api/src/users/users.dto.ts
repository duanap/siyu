import { IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  nickname?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;
}
