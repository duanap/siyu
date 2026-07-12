import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { readConfig } from '../config';
import type { RequestWithId } from '../request-id';
import { AccessGuard } from './auth.guard';
import { REFRESH_COOKIE, SESSION_SECONDS } from './auth.constants';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest, AuthTokenData } from './auth.types';
import { OAuthService } from './oauth.service';
import { AuthRateLimitService } from './rate-limit.service';

type RequestWithCookies = RequestWithId & { cookies?: Record<string, string> };

@Controller('api/v1/auth')
export class AuthController {
  private readonly config = readConfig();

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(OAuthService) private readonly oauth: OAuthService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  private setRefresh(response: Response, token: string): void {
    response.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: SESSION_SECONDS * 1000,
    });
  }

  private clearRefresh(response: Response): void {
    response.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }

  private assertTrustedOrigin(request: Request): void {
    const origin = request.header('origin');
    if (origin && !this.config.corsOrigins.includes(origin)) {
      throw new ForbiddenException('请求来源不受信任');
    }
  }

  private success(request: RequestWithId, data: AuthTokenData): object {
    return { success: true, data, requestId: request.requestId };
  }

  @Post('register')
  async register(
    @Body() body: RegisterDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<object> {
    await this.rateLimit.consume('register', request.ip || 'unknown', 5, 3600);
    const result = await this.auth.register(body);
    this.setRefresh(response, result.refreshToken);
    return this.success(request, result.data);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<object> {
    await this.rateLimit.consume('login', request.ip || 'unknown', 10, 900);
    const result = await this.auth.login(body.email, body.password);
    this.setRefresh(response, result.refreshToken);
    return this.success(request, result.data);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<object> {
    this.assertTrustedOrigin(request);
    await this.rateLimit.consume('refresh', request.ip || 'unknown', 60, 60);
    const token = request.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('刷新令牌无效');
    const result = await this.auth.refresh(token);
    this.setRefresh(response, result.refreshToken);
    return this.success(request, result.data);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<object> {
    this.assertTrustedOrigin(request);
    await this.rateLimit.consume('logout', request.ip || 'unknown', 30, 60);
    await this.auth.logout(request.cookies?.[REFRESH_COOKIE]);
    this.clearRefresh(response);
    return { success: true, data: { status: 'ok' }, requestId: request.requestId };
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  async forgot(@Body() body: ForgotPasswordDto, @Req() request: RequestWithId): Promise<object> {
    await this.rateLimit.consume('forgot', request.ip || 'unknown', 5, 3600);
    await this.auth.requestReset(body.email);
    return { success: true, data: { status: 'accepted' }, requestId: request.requestId };
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  async reset(@Body() body: ResetPasswordDto, @Req() request: RequestWithId): Promise<object> {
    await this.auth.resetPassword(body.token, body.newPassword);
    return { success: true, data: { status: 'ok' }, requestId: request.requestId };
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessGuard)
  async change(
    @Body() body: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<object> {
    this.assertTrustedOrigin(request);
    const result = await this.auth.changePassword(
      request.auth,
      body.currentPassword,
      body.newPassword,
    );
    this.setRefresh(response, result.refreshToken);
    return this.success(request, result.data);
  }

  @Get('qq/authorize')
  async qqAuthorize(@Req() request: RequestWithId, @Res() response: Response): Promise<void> {
    await this.rateLimit.consume('qq-authorize', request.ip || 'unknown', 20, 600);
    const state = await this.oauth.createState();
    response.redirect(this.auth.qqAuthorizeUrl(state));
  }

  @Get('qq/callback')
  async qqCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: RequestWithId,
    @Res() response: Response,
  ): Promise<void> {
    if (!code || !state) {
      response.redirect(new URL('/?qqCallback=ready', this.config.publicUrl).toString());
      return;
    }

    await this.rateLimit.consume('qq-callback', request.ip || 'unknown', 20, 600);
    const userId = await this.oauth.consumeCallback(code, state);
    const result = await this.auth.createSession(userId);
    this.setRefresh(response, result.refreshToken);
    response.redirect(new URL('/oauth/callback', this.config.publicUrl).toString());
  }
}
