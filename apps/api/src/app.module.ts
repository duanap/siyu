import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';

import { HealthController } from './health.controller';
import { RequestIdMiddleware } from './request-id';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { DatabaseModule } from './database/database.module';
import { DebtsModule } from './debts/debts.module';
import { EntriesModule } from './entries/entries.module';
import { LedgersModule } from './ledgers/ledgers.module';
import { RecurringModule } from './recurring/recurring.module';
import { SalaryModule } from './salary/salary.module';
import { SavingGoalsModule } from './saving-goals/saving-goals.module';
import { StatisticsModule } from './statistics/statistics.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    LedgersModule,
    CategoriesModule,
    DebtsModule,
    EntriesModule,
    RecurringModule,
    SalaryModule,
    SavingGoalsModule,
    StatisticsModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
