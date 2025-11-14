// src/common/filters/plain-text-exception.filter.ts
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class PlainTextExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let msg = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      msg = this.pickMessage(body);
    } else if (
      typeof exception === 'object' &&
      exception &&
      'message' in (exception as any)
    ) {
      msg = String((exception as any).message || msg);
    }

    // Optional: include known error codes (e.g., Prisma)
    if ((exception as any)?.code) msg = `[${(exception as any).code}] ${msg}`;

    res.status(status).type('text/plain; charset=utf-8').send(msg);
  }

  private pickMessage(body: any): string {
    if (!body) return 'Unknown error';
    if (typeof body === 'string') return body;

    // Nest/ValidationPipe: { message: string | string[], statusCode, error }
    if (Array.isArray(body.message)) return body.message.join('; ');
    if (typeof body.message === 'string') return body.message;

    // Sometimes frameworks return arrays of strings
    if (Array.isArray(body)) return body.join('; ');

    // Fallback—last resort
    return JSON.stringify(body);
  }
}
