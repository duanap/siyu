import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';

import { HealthController } from './health.controller';
import { RequestIdMiddleware } from './request-id';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { LedgersModule } from './ledgers/ledgers.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule, LedgersModule],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
