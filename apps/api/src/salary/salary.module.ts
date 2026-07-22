import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SalaryController } from './salary.controller';
import { SalaryRepository } from './salary.repository';
import { SalaryService } from './salary.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SalaryController],
  providers: [SalaryRepository, SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}
