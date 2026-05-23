import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { PinoLogger } from 'nestjs-pino';
import { HttpExceptionFilterLogPayload } from '../logging/logging.types';
import { serializeException } from '../logging/logger-utils';
import { OperationalException } from '../exceptions/operational.exception';
import { ContextStore } from '../context/context.store';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  // Inject the Pino logger
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const response = ctx.getResponse<FastifyReply>();

    const executionContext = request.routeOptions?.url
      ? `${request.method} ${request.routeOptions.url}`
      : `${request.method} ${request.url}`;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected internal error occurred';

    // Catch custom core/infrastructure system errors
    if (exception instanceof OperationalException) {
      statusCode = exception.statusCode;

      message =
        statusCode >= 500
          ? 'A secure backend operational error occurred. Please contact support.'
          : exception.message;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const errorResponse = exception.getResponse();

      if (typeof errorResponse === 'string') {
        message = errorResponse;
      } else if (typeof errorResponse === 'object' && errorResponse !== null) {
        // Cast to unknown records and extract the message array safely
        const objResponse = errorResponse as Record<string, unknown>;

        if (Array.isArray(objResponse.message)) {
          message = objResponse.message.join(', '); // Squashes pipe error arrays into a readable string
        } else if (typeof objResponse.message === 'string') {
          message = objResponse.message;
        }
      }
    }

    // Safely extract your tracking trace ID out of thin air
    let requestId = 'N/A';
    try {
      requestId = ContextStore.get().requestId;
    } catch {
      // Fallback if the error happened before ContextStore initialized
    }

    // internal structured logging
    const errorLog: HttpExceptionFilterLogPayload = {
      system: 'http',
      endpoint: executionContext,
      statusCode,
      err: serializeException(exception),
    };

    this.logger.error(errorLog, 'Unhandled exception');

    //  Clean, standardized API response
    void response.status(statusCode).send({
      success: false,
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }
}
