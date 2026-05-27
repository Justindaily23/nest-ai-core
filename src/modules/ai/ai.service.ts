import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AIExecutor } from './ai.executor';
import { AIChatRequest, AIChatResponse, AIChatStreamChunk } from './ai.types';

@Injectable()
export class AIService {
  constructor(private readonly executor: AIExecutor) {}

  /**
   * Dispatches a standard blocking completion request directly to the central execution hub.
   * Ideal for discrete background tasks such as summarization or data structuring.
   */
  generate(request: AIChatRequest): Promise<AIChatResponse> {
    return this.executor.execute(request);
  }

  /**
   * Dispatches a reactive data stream request directly to the central execution hub.
   * Required for rendering low-latency live conversational user interface text blocks.
   */
  generateStream(request: AIChatRequest): Observable<AIChatStreamChunk> {
    return this.executor.executeStream(request);
  }
}
