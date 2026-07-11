import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
const validRequestId = /^[A-Za-z0-9._:-]{8,128}$/;

export interface RequestWithId extends Request {
  requestId: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const incoming = request.header(REQUEST_ID_HEADER);
    request.requestId =
      incoming && validRequestId.test(incoming) ? incoming : `req_${randomUUID()}`;
    response.setHeader(REQUEST_ID_HEADER, request.requestId);
    next();
  }
}
