/**
 * @file tokenizer.service.ts
 * @description MODULE FAÇADE: The centralized token orchestration service.
 *
 * DESIGN PRINCIPLE:
 * This service exposes token operations to the rest of your RAG sub-modules.
 * By injecting the `Tokenizer` interface token rather than a concrete class,
 * your core application remains fully decoupled from the underlying engine.
 */

import { Injectable, Inject } from '@nestjs/common';
import { type Tokenizer } from './interfaces/tokenizer.interface';

@Injectable()
export class TokenizerService {
  constructor(
    // We inject using a string token or class reference to decouple the implementation
    @Inject('TOKENIZER_PROVIDER')
    private readonly tokenizer: Tokenizer,
  ) {}

  encode(text: string): number[] {
    return this.tokenizer.encode(text);
  }

  decode(tokens: number[]): string {
    return this.tokenizer.decode(tokens);
  }

  countTokens(text: string): number {
    return this.tokenizer.count(text);
  }
}
