import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AccessGuard } from '../auth/auth.guard';
import { AuthRateLimitService } from '../auth/rate-limit.service';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  AcceptCoupleInvitationDto,
  CreateCoupleInvitationDto,
  CreateCoupleLedgerDto,
  TransferCoupleOwnershipDto,
  UpdateCoupleLedgerDto,
} from './ledgers.dto';
import { LedgersService } from './ledgers.service';

@Controller('api/v1')
@UseGuards(AccessGuard)
export class LedgersController {
  constructor(
    @Inject(LedgersService) private readonly ledgers: LedgersService,
    @Inject(AuthRateLimitService) private readonly rateLimit: AuthRateLimitService,
  ) {}

  private success(request: AuthenticatedRequest, data: unknown): object {
    return { success: true, data, requestId: request.requestId };
  }

  private action(request: AuthenticatedRequest, status: string): object {
    return this.success(request, { status });
  }

  @Get('ledgers')
  async list(@Req() request: AuthenticatedRequest): Promise<object> {
    const items = await this.ledgers.list(request.auth.userId);
    return this.success(request, {
      items,
      page: 1,
      pageSize: Math.max(items.length, 1),
      total: items.length,
      hasNext: false,
    });
  }

  @Get('ledgers/:id')
  async detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(request, await this.ledgers.detail(request.auth.userId, id));
  }

  @Post('couple-ledgers')
  async create(
    @Body() body: CreateCoupleLedgerDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('couple-create', request.auth.userId, 5, 3600);
    return this.success(
      request,
      await this.ledgers.createCouple(
        request.auth.userId,
        body.name,
        body.idempotencyKey,
        request.requestId,
      ),
    );
  }

  @Patch('couple-ledgers/:id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateCoupleLedgerDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('couple-invite', request.auth.userId, 10, 600);
    return this.success(
      request,
      await this.ledgers.updateCouple(request.auth.userId, id, body.name, request.requestId),
    );
  }

  @Post('couple-ledgers/:id/invitations')
  async invite(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateCoupleInvitationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.rateLimit.consume('couple-accept', request.auth.userId, 20, 600);
    return this.success(
      request,
      await this.ledgers.createInvitation(
        request.auth.userId,
        id,
        body.idempotencyKey,
        request.requestId,
      ),
    );
  }

  @Post('couple-invitations/accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Body() body: AcceptCoupleInvitationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(
      request,
      await this.ledgers.acceptInvitation(request.auth.userId, body.token, request.requestId),
    );
  }

  @Post('couple-ledgers/:id/leave')
  @HttpCode(HttpStatus.OK)
  async leave(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.ledgers.leave(request.auth.userId, id, request.requestId);
    return this.action(request, 'left');
  }

  @Post('couple-ledgers/:id/transfer-ownership')
  @HttpCode(HttpStatus.OK)
  async transfer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: TransferCoupleOwnershipDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    return this.success(
      request,
      await this.ledgers.transferOwnership(
        request.auth.userId,
        id,
        body.targetUserId,
        request.requestId,
      ),
    );
  }

  @Delete('couple-ledgers/:id')
  async dissolve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<object> {
    await this.ledgers.dissolve(request.auth.userId, id, request.requestId);
    return this.action(request, 'dissolved');
  }
}
