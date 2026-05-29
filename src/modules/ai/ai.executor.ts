import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { timeout, catchError, tap } from 'rxjs/operators';
import { AIProviderRegistry } from './ai-provider.registry';
import { AIChatRequest, AIChatResponse, AIChatStreamChunk } from './ai.types';
import { OperationalException } from '@/common/exceptions/operational.exception';

@Injectable()
export class AIExecutor {
  private static readonly DEFAULT_TIMEOUT_MS = 30_000;

  constructor(
    private readonly registry: AIProviderRegistry,
    @InjectPinoLogger(AIExecutor.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Executes a standard blocking completion query with built-in timeout boundaries.
   */
  async execute(request: AIChatRequest): Promise<AIChatResponse> {
    const provider = this.registry.resolve(request.provider);
    const start = Date.now();

    try {
      const response = await this.withTimeout(
        () => provider.generate(request),
        AIExecutor.DEFAULT_TIMEOUT_MS,
      );

      // Clean, lightweight logging payload.
      // RequestId, TenantId, Plan, and Actor are automatically appended behind the scenes by Pino!
      this.logger.info(
        {
          provider: request.provider,
          model: request.model,
          metadata: response.metadata,
        },
        'AI blocking execution completed',
      );

      return response;
    } catch (error) {
      const isTimeout =
        error instanceof Error && error.message.includes('timed out');

      this.logger.error(
        {
          provider: request.provider,
          model: request.model,
          durationMs: Date.now() - start,
          err: error,
        },
        isTimeout
          ? 'AI blocking request timed out'
          : 'AI blocking request failed',
      );

      throw new OperationalException(
        'llm',
        isTimeout ? 'AI_TIMEOUT_EXCEEDED' : 'AI_EXECUTION_FAILED',
        isTimeout
          ? 'The AI model network gateway timed out.'
          : 'AI request execution aborted.',
        isTimeout ? 504 : 502,
        error,
      );
    }
  }

  /**
   * Executes a reactive real-time text stream with integrated RxJS timeout tracking boundaries.
   */
  executeStream(request: AIChatRequest): Observable<AIChatStreamChunk> {
    const provider = this.registry.resolve(request.provider);
    const start = Date.now();

    return provider.generateStream(request).pipe(
      // Automatically throws a TimeoutError if no token chunk arrives for 30 seconds
      timeout(AIExecutor.DEFAULT_TIMEOUT_MS),
      tap({
        complete: () => {
          this.logger.info(
            {
              provider: request.provider,
              model: request.model,
              durationMs: Date.now() - start,
            },
            'AI response streaming channel closed cleanly',
          );
        },
      }),
      catchError((error) => {
        const isTimeout = error instanceof TimeoutError;

        this.logger.error(
          {
            provider: request.provider,
            model: request.model,
            durationMs: Date.now() - start,
            err: error,
          },
          isTimeout
            ? 'AI response streaming timed out'
            : 'AI response streaming dropped',
        );

        return throwError(
          () =>
            new OperationalException(
              'llm',
              isTimeout ? 'AI_STREAM_TIMEOUT' : 'AI_STREAM_FAILED',
              isTimeout
                ? 'AI network data token transmission timed out.'
                : 'AI stream disconnected.',
              isTimeout ? 504 : 502,
              error,
            ),
        );
      }),
    );
  }

  /**
   * Low-level safe execution execution runner for Promises.
   */
  private async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timerId: NodeJS.Timeout;

    const timeOutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(
        () => reject(new Error(`AI request timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    try {
      return Promise.race([fn(), timeOutPromise]);
    } finally {
      clearTimeout(timerId!); // Prevents memory leaks by freazing up the event loop instance after completion or error
    }
  }
}
