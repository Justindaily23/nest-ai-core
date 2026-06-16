import {
  CallHandler,
  ExecutionContext as NestExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';
import { Observable, Subscription } from 'rxjs';
import { ContextStore } from './context.store';
import { ActorType, AppRequestContext, PlanTier } from './execution-context';

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  intercept(
    context: NestExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    // Fallback gracefully if not an HTTP request (e.g., GraphQL, RPC, Microservices)
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();

    // Extract raw identifiers from headers (no validation or auth logic )
    const requestId =
      (request.headers['x-request-id'] as string) || randomUUID();
    const actorType = (request.headers['x-actor-type'] as ActorType) || 'user';
    const actorId = request.headers['x-actor-id'] as string | undefined;
    const tenantId = request.headers['x-tenant-id'] as string | undefined;

    // Initialize the base context with extracted values and defaults
    const baseContext: AppRequestContext = {
      requestId,
      timestamp: Date.now(),

      actor: {
        type: actorType,
        id: actorId,
      },

      tenant: tenantId ? { id: tenantId } : undefined,

      capabilities: [],

      plan: {
        tier: 'free' as PlanTier,
        hardLimits: {
          requestPerMinute: 60,
          tokenPerMonth: 100_000,
          maxTokenPerRequest: 2_000,
        },
      },

      source: {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
    };

    // Boot up the AsyncLocalStorage context for this request lifecycle
    // Wrap execution natively without breaking RxJS streaming or LLM token streaming
    return new Observable((subscriber) => {
      let subscription: Subscription | undefined;
      ContextStore.run(baseContext, () => {
        const source$ = next.handle();

        subscription = source$.subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    });
  }
}
