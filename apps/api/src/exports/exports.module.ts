import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ExportsController } from './exports.controller';
import { ExportsRepository } from './exports.repository';
import { ExportsService } from './exports.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ExportsController],
  providers: [ExportsRepository, ExportsService],
})
export class ExportsModule {}
