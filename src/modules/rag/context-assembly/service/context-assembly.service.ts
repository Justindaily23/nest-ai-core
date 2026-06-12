/**
 * @file context-assembly.service.ts
 *
 * RESPONSIBILITY:
 * Deterministically assemble retrieved parent/child chunks
 * into a token-budget–constrained context structure.
 *
 * NON-GOALS:
 * - No retrieval
 * - No ranking
 * - No prompt formatting
 * - No citations rendering
 *
 * This service is PURE and SYNCHRONOUS by design.
 */

import { Injectable } from '@nestjs/common';
import {
  AssembledContext,
  ContextAssemblyInput,
  ContextBlock,
} from '../interfaces/context-assembly.interface';
import { TokenizerService } from '../../tokenization/tokenizer.service';

@Injectable()
export class ContextAssemblyService {
  constructor(private readonly tokenizer: TokenizerService) {}

  assemble(input: ContextAssemblyInput): AssembledContext {
    const { parents, tokenBudget } = input;

    let remainingTokens = tokenBudget;
    const blocks: ContextBlock[] = [];

    for (const parent of parents) {
      // Count Parent tokens once
      const parentTokens = this.tokenizer.countTokens(parent.parentContent);

      // Hard stop: parent itself cannot fit
      if (parentTokens > remainingTokens) {
        continue;
      }

      let usedTokens = parentTokens;
      const children: ContextBlock['children'] = [];

      for (const child of parent.children) {
        const childTokens = this.tokenizer.countTokens(child.content);

        // Stop adding children once budget is exceeded
        if (usedTokens + childTokens > remainingTokens) {
          break;
        }

        children.push({
          chunkId: child.chunkId,
          content: child.content,
          tokens: childTokens,
        });

        usedTokens += childTokens;
      }

      //skip parents    that cannot contribute any child context
      if (children.length === 0) {
        continue;
      }

      blocks.push({
        parentChunkId: parent.parentChunkId,
        parentContent: parent.parentContent,
        children,
        totalTokens: usedTokens,
        score: parent.score,
      });

      remainingTokens -= usedTokens;

      // Budget exhausted — nothing else can fit
      if (remainingTokens <= 0) {
        break;
      }
    }

    return {
      totalTokens: tokenBudget - remainingTokens,
      budgetTokens: tokenBudget,
      blocks,
    };
  }
}
