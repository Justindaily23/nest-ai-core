import { Observable } from 'rxjs';
import { AIChatRequest, AIChatResponse, AIChatStreamChunk } from './ai.types';

export interface AIProvider {
  /**
   * Executes a standard blocking completion query.
   * Ideal for classification, summarization, or structured JSON tasks.
   */
  generate(request: AIChatRequest): Promise<AIChatResponse>;

  /**
   * Executes a real-time reactive data stream completion query.
   * Required for low-latency interactive text streaming generation.
   */
  generateStream(request: AIChatRequest): Observable<AIChatStreamChunk>;
}
