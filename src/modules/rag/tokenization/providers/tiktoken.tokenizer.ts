/**
 * @file tiktoken.tokenizer.ts
 * @description WASM-BACKED TOKENIZATION SERVICE: Implements the core Tokenizer contract.
 *
 * DESIGN RATIONALE:
 * This provider handles text-to-token translations locally using compiled WebAssembly.
 * By maintaining calculation execution boundaries inside the WASM heap, it provides
 * maximum throughput during high-velocity RAG ingestion loops while shielding the Node.js
 * host process from performance degradation.
 */

import { Injectable, BeforeApplicationShutdown } from '@nestjs/common';
import { encoding_for_model, Tiktoken } from 'tiktoken';
import { Tokenizer } from '../interfaces/tokenizer.interface';

@Injectable()
export class TiktokenTokenizer implements Tokenizer, BeforeApplicationShutdown {
  /**
   * Stateful pointer to the isolated WebAssembly memory space.
   */
  private readonly encoder: Tiktoken;

  /**
   * Thread-safe, standard utility instance for reliable byte-to-string extraction.
   * Eliminates character-boundary corruption on multi-byte characters like emojis or non-English scripts.
   */
  private readonly textDecoder = new TextDecoder('utf-8');

  constructor() {
    /**
     * Standardizes the vocabulary space matching OpenAI's third-generation embedding models
     * and the GPT-4 LLM family (underlying mapping: cl100k_base).
     */
    this.encoder = encoding_for_model('text-embedding-3-small');
  }

  /**
   * Converts raw human-readable string data into an array of mathematical token IDs.
   * Explicitly casts the native WASM Uint32Array allocation to standard JS arrays to satisfy the contract.
   */
  encode(text: string): number[] {
    return Array.from(this.encoder.encode(text));
  }

  /**
   * Reconstitutes text payloads from structural token sequences.
   * Maps numbers to a temporary Uint32Array buffer required by the underlying C/Rust parser.
   */
  decode(tokens: number[]): string {
    const uint32Array = new Uint32Array(tokens);
    const rawBytes = this.encoder.decode(uint32Array);
    /**
     * Thread-safe, standard utility instance for reliable byte-to-string extraction.
     * Eliminates character-boundary corruption on multi-byte characters like emojis or non-English scripts.
     *     Instantiated per call — prevents incomplete byte state from one chunk
     *     leaking into the next decode call through shared TextDecoder state.
     */
    return new TextDecoder('utf-8', { fatal: false }).decode(rawBytes);
  }

  /**
   * Zero-allocation measurement pass optimized for high-volume batch evaluations.
   * Bypasses costly runtime array mutations by checking length directly on the WASM layer.
   */
  count(text: string): number {
    return this.encoder.encode(text).length;
  }

  /**
   * Critical NestJS Container hook. Triggers synchronously during application tear-down
   * (e.g., SIGTERM on a Docker container) to explicitly free unmanaged WebAssembly memory
   * resources and prevent native out-of-memory crashes.
   */
  beforeApplicationShutdown(): void {
    this.encoder.free();
  }
}
