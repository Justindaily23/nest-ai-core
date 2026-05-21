import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { PinoLogger } from 'nestjs-pino';

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
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
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

    // internal structured loggin
    this.logger.error(
      {
        system: 'http',
        context: executionContext,
        statusCode,
        err:
          exception instanceof Error
            ? {
                name: exception.name,
                message: exception.message,
                stack: exception.stack,
              }
            : exception,
      },
      'Unhandled exception',
    );

    //  Clean, standardized API response
    void response.status(statusCode).send({
      success: false,
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
