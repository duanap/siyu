import { Controller, Get, Req } from '@nestjs/common';
import type { SuccessResponse } from '@siyu/shared-types' with { 'resolution-mode': 'import' };

import type { RequestWithId } from './request-id';

export interface HealthData {
  status: 'ok';
  service: 'siyu-api';
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Get()
  getHealth(@Req() request: RequestWithId): SuccessResponse<HealthData> {
    return {
      success: true,
      data: {
        status: 'ok',
        service: 'siyu-api',
        timestamp: new Date().toISOString(),
      },
      requestId: request.requestId,
    };
  }
}
