import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { PinoLogger } from 'nestjs-pino';
import { FastifyRequest } from 'fastify';
import { HttpInterceptorLogPayload } from '../../common/logging/logging.types';
import { serializeException } from '../../common/logging/logger-utils';

@Injectable()
export class SystemLoggingInterceptor implements NestInterceptor {
  // Injecting the pino logger to use for logging the request context
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<FastifyRequest>();
    const { method, url } = request;
    const startTime = Date.now();
    const executionContext = `${context.getClass().name}.${context.getHandler().name}`;

    return next.handle().pipe(
      tap(() => {
        // Calculate the execution duration of the request
        const executionDuration = Date.now() - startTime;

        // Log a clean structured benchmark for perfomance tracing/monitoring
        const successLog: HttpInterceptorLogPayload = {
          system: 'http',
          executionContext,
          http: { method, url },
          metrics: {
            executionDuration,
          },
        };
        this.logger.info(successLog, 'Execution completed');
      }),
      catchError((error) => {
        const durationMs = Date.now() - startTime;

        const errorLog: HttpInterceptorLogPayload = {
          system: 'http',
          executionContext,
          http: { method, url },
          metrics: {
            durationMs,
          },
          err: serializeException(error), // Reusable normalization
        };

        this.logger.error(errorLog, 'Execution failed');

        throw error;
      }),
    );
  }
}
