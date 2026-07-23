import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RecurringModule } from '../recurring/recurring.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [DatabaseModule, AuthModule, RecurringModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
