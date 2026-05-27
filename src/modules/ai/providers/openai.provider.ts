import { Injectable } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { AIProvider } from '../ai.provider';
import { AIChatRequest, AIChatResponse, AIChatStreamChunk } from '../ai.types';

@Injectable()
export class OpenAIProvider implements AIProvider {
  /**
   * Executes a standard blocking completion query.
   */
  async generate(request: AIChatRequest): Promise<AIChatResponse> {
    const start = Date.now();

    // Simulated network delay placeholder
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      content: `Simulated OpenAI response for model: ${request.model}`,
      metadata: {
        provider: 'openai',
        model: request.model,
        latencyMs: Date.now() - start,
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          costUsd: 0.0006, // Real calculation strategy in Phase 2
        },
      },
    };
  }

  /**
   * Executes a real-time reactive data stream completion query.
   */
  generateStream(request: AIChatRequest): Observable<AIChatStreamChunk> {
    const start = Date.now();

    // Simulated stream sequence emitting words step-by-step
    const chunks = ['Hello ', 'from ', 'OpenAI ', 'stream!'];

    return from(chunks).pipe(
      map((chunk, index) => {
        const isLast = index === chunks.length - 1;

        return {
          contentChunk: chunk,
          metadata: isLast
            ? {
                provider: 'openai',
                model: request.model,
                latencyMs: Date.now() - start,
                usage: {
                  inputTokens: 10,
                  outputTokens: 4,
                  costUsd: 0.00012,
                },
              }
            : undefined, // Metadata is only attached to the final token payload chunk
        };
      }),
    );
  }
}
