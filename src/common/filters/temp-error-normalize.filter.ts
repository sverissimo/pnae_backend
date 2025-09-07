import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * TEMPORARY filter: normalize all error responses to a plain string message.
 * Purpose: work around mobile/frontend bug that expects a plain string and
 * cannot handle objects like { msg: '...' }.
 * Remove this filter once the frontend is fixed.
 */
@Catch()
export class TempErrorNormalizeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.BAD_REQUEST;
    let message = 'Erro inesperado';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      // resp can be string or object. Try to extract a string message.
      if (typeof resp === 'string') {
        message = resp;
      } else if (resp && typeof resp === 'object') {
        // common shapes: { message: 'x' } or { message: ['a','b'] } or { error: 'x' }
        const asAny = resp as any;
        if (Array.isArray(asAny.message)) {
          message = asAny.message.join('; ');
        } else if (typeof asAny.message === 'string') {
          message = asAny.message;
        } else if (typeof asAny.error === 'string') {
          message = asAny.error;
        } else {
          // fallback to JSON stringify but prefer a single-line string
          try {
            message = JSON.stringify(asAny);
          } catch {
            message = String(asAny);
          }
        }
      }
    } else if (exception && typeof exception === 'object') {
      // non-Http exceptions: try to read common properties
      const asAny = exception as any;
      if (typeof asAny.message === 'string') message = asAny.message;
      else if (asAny?.response && typeof asAny.response === 'string')
        message = asAny.response;
      else {
        try {
          message = JSON.stringify(asAny);
        } catch {
          message = String(asAny);
        }
      }
    } else if (typeof exception === 'string') {
      message = exception;
    }

    // Final normalization: ensure it's a single string, no newlines
    message = (message || 'Erro inesperado')
      .toString()
      .replace(/\s+/g, ' ')
      .trim();

    // Respond with plain string body to satisfy the buggy mobile client
    res.status(status).send(message);
  }
}
