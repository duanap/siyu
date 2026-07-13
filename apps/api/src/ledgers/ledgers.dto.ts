import { Transform } from 'class-transformer';
import { IsString, IsUUID, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCoupleLedgerDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Length(8, 128)
  idempotencyKey!: string;
}

export class UpdateCoupleLedgerDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;
}

export class CreateCoupleInvitationDto {
  @IsString()
  @Length(8, 128)
  idempotencyKey!: string;
}

export class AcceptCoupleInvitationDto {
  @IsString()
  @Length(32, 256)
  token!: string;
}

export class TransferCoupleOwnershipDto {
  @IsUUID()
  targetUserId!: string;
}
