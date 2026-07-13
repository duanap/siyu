import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { LedgersController } from './ledgers.controller';
import { LedgersRepository } from './ledgers.repository';
import { LedgersService } from './ledgers.service';

@Module({
  imports: [AuthModule],
  controllers: [LedgersController],
  providers: [LedgersRepository, LedgersService],
})
export class LedgersModule {}
