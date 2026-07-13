import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AccessGuard } from './auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { AuthRateLimitService } from './rate-limit.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AccessGuard, OAuthService, AuthRateLimitService],
  exports: [AccessGuard, JwtModule],
})
export class AuthModule {}
