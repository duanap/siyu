import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AdminAuthController } from './admin-auth.controller';
import { UsersController } from './users.controller';

@Module({ imports: [AuthModule], controllers: [UsersController, AdminAuthController] })
export class UsersModule {}
