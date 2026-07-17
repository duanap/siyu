import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DebtsController } from './debts.controller';
import { DebtsRepository } from './debts.repository';
import { DebtsService } from './debts.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DebtsController],
  providers: [DebtsRepository, DebtsService],
})
export class DebtsModule {}
