import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SavingGoalsController } from './saving-goals.controller';
import { SavingGoalsRepository } from './saving-goals.repository';
import { SavingGoalsService } from './saving-goals.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SavingGoalsController],
  providers: [SavingGoalsRepository, SavingGoalsService],
})
export class SavingGoalsModule {}
