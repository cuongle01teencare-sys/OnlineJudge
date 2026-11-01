import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { ApiErrorBody } from '@oj/contracts';
import type { Response } from 'express';
import { DomainError, type DomainErrorKind } from '../domain/domain-error.js';

const STATUS: Record<DomainErrorKind, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
};

/** Maps domain errors and Nest HTTP exceptions to the shared `ApiErrorBody` shape. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let body: ApiErrorBody;

    if (exception instanceof DomainError) {
      body = {
        statusCode: STATUS[exception.kind],
        message: exception.message,
        code: exception.code,
        ...(exception.details ? { details: exception.details } : {}),
      };
    } else if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const raw = typeof payload === 'string' ? payload : (payload as { message?: string | string[] }).message;
      body = {
        statusCode: exception.getStatus(),
        message: Array.isArray(raw) ? raw.join('; ') : (raw ?? exception.message),
      };
    } else {
      this.logger.error(exception);
      body = { statusCode: 500, message: 'Đã xảy ra lỗi hệ thống.' };
    }
    res.status(body.statusCode).json(body);
  }
}
