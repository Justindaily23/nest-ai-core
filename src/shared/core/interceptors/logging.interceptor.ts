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
        this.logger.info(
          {
            system: 'http',
            executionContext,
            metrics: {
              executionDuration,
            },
          },
          'Execution completed',
        );
      }),
      catchError((error) => {
        const durationMs = Date.now() - startTime;

        this.logger.error(
          {
            system: 'http',
            executionContext,
            metrics: {
              durationMs,
            },
            err: error,
          },
          'Execution failed',
        );

        throw error;
      }),
    );
  }
}
