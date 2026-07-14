import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CategoriesController],
  providers: [CategoriesRepository, CategoriesService],
})
export class CategoriesModule {}
