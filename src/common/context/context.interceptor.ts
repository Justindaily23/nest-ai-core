import {
  CallHandler,
  ExecutionContext as NestExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { ContextStore } from './context.store';
import { ExecutionContext } from './execution-context';

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  intercept(context: NestExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();

    const baseContext: ExecutionContext = {
      requestId: randomUUID(),
      timestamp: Date.now(),

      actor: {
        type: 'system',
      },

      capabilities: [],

      source: {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
    };

    return new Observable((subscriber) => {
      ContextStore.run(baseContext, async () => {
        try {
          const result = await next.handle().toPromise();
          subscriber.next(result);
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      });
    });
  }
}
