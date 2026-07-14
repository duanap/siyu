import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { EntriesController } from './entries.controller';
import { EntriesRepository } from './entries.repository';
import { EntriesService } from './entries.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [EntriesController],
  providers: [EntriesRepository, EntriesService],
})
export class EntriesModule {}
