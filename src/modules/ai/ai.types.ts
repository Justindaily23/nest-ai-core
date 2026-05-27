export type AIProviderName = 'openai' | 'anthropic' | 'local';

/**
 * Context payload for the LLM provider API.
 * DO NOT confuse with AppRequestContext.actor.type (our backend identity).
 */
export interface AIMessage {
  /**
   * 'system' = AI system prompt instructions.
   * 'user' = Human / consumer prompt input.
   * 'assistant' = Previous AI generated responses.
   */
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/**
 * Options for configuring the AI chat behavior.
 * These are provider-agnostic and will be translated/mapped to specific provider parameters in the implementation layer.
 */
export interface AIChatOptions {
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stopSequences?: string[];
}

/**
 * The Authoritative Unified Request Shape
 */
export interface AIChatRequest {
  readonly provider: AIProviderName;
  readonly model: string;
  readonly messages: readonly AIMessage[];
  readonly options?: AIChatOptions;
}

/**
 * Telemetry and billing metadata returned from the AI provider layer.
 * Used for cost tracking, latency metrics, and enforcement of hard usage limits.
 */
export interface AIResponseMetadata {
  readonly provider: AIProviderName; // e.g., 'openai', 'anthropic', 'local'
  readonly model: string; // specific model used (e.g., 'gpt-4', 'claude-2')
  readonly latencyMs: number; // time taken for the AI provider to respond
  readonly usage: {
    readonly inputTokens: number; // number of tokens in the input prompt (RAG context + user query)
    readonly outputTokens: number; // number of tokens in the AI-generated response
    readonly costUsd: number; // estimated cost in USD
  };
}

/**
 * Standard Blocking Response
 */
export interface AIChatResponse {
  readonly content: string;
  readonly metadata: AIResponseMetadata;
}

/**
 * Streaming Response Chunk
 */
export interface AIChatStreamChunk {
  readonly contentChunk: string;
  readonly metadata?: AIResponseMetadata; // Populated only on the final chunk
}
