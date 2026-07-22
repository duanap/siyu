import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RecurringController } from './recurring.controller';
import { RecurringRepository } from './recurring.repository';
import { RecurringService } from './recurring.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [RecurringController],
  providers: [RecurringRepository, RecurringService],
  exports: [RecurringService],
})
export class RecurringModule {}
