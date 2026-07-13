import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

import type { RequestWithId } from './request-id';

interface ErrorBody {
  success: false;
  code: string;
  message: string;
  details: Record<string, unknown>;
  requestId: string;
}

function errorCode(status: number, exception: unknown): string {
  if (exception instanceof HttpException) {
    const exceptionResponse = exception.getResponse();
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const code = (exceptionResponse as Record<string, unknown>).code;
      if (typeof code === 'string') return code;
    }
  }
  if (status === HttpStatus.BAD_REQUEST) return 'VALIDATION_FAILED';
  if (status === HttpStatus.UNAUTHORIZED) return 'AUTH_REQUIRED';
  if (status === HttpStatus.FORBIDDEN) return 'PERMISSION_DENIED';
  if (status === HttpStatus.NOT_FOUND) return 'RESOURCE_NOT_FOUND';
  if (status === HttpStatus.TOO_MANY_REQUESTS) return 'RATE_LIMITED';
  return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
}

function errorMessage(status: number, exception: unknown): string {
  if (status >= 500) return '服务器内部错误';
  if (!(exception instanceof HttpException)) return '请求失败';
  const exceptionResponse = exception.getResponse();
  if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
    const message = (exceptionResponse as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
  }
  return exception.message;
}

function errorDetails(exception: HttpException): Record<string, unknown> {
  const response = exception.getResponse();
  if (typeof response !== 'object' || response === null) return {};
  const message = (response as Record<string, unknown>).message;
  return Array.isArray(message) ? { errors: message } : {};
}

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body: ErrorBody = {
      success: false,
      code: errorCode(status, exception),
      message: errorMessage(status, exception),
      details: exception instanceof HttpException ? errorDetails(exception) : {},
      requestId: request.requestId,
    };

    response.status(status).json(body);
  }
}
