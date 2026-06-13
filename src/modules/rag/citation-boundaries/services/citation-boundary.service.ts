/**
 * @file citation-boundary.service.ts
 *
 * RESPONSIBILITY:
 * Convert assembled context blocks into citation-safe units.
 *
 * GUARANTEES:
 * - Each unit maps to exactly one chunk
 * - Citation IDs are deterministic
 * - Parent/child boundaries are preserved
 *
 * NON-GOALS:
 * - Prompt formatting
 * - Citation rendering
 * - Token counting (already done)
 */

import { Injectable } from '@nestjs/common';
import { AssembledContext } from '../../context-assembly/interfaces/context-assembly.interface';
import {
  CitationBoundaryContext,
  CitationUnit,
  CitationIndexMap, // NEW: must be added to interface
} from '../interfaces/citation-boundary.interface';

@Injectable()
export class CitationBoundaryService {
  build(context: AssembledContext): CitationBoundaryContext {
    if (!context?.blocks?.length) {
      return { units: [], totalTokens: 0, citationMap: {} };
    }

    const units: CitationUnit[] = [];
    const citationMap: CitationIndexMap = {}; // short ID → real DB keys
    let totalTokens = 0;
    let seq = 1;

    for (const block of context.blocks) {
      if (!block?.children?.length) continue;

      for (const child of block.children) {
        if (!child?.content || typeof child.tokens !== 'number') continue;

        const citationId = String(seq++);

        // Map is returned to caller — not buried inside the unit
        citationMap[citationId] = {
          parentChunkId: block.parentChunkId,
          chunkId: child.chunkId,
        };

        units.push({
          citationId,
          content: child.content,
          tokens: child.tokens,
          // No DB keys leaked into prompt-facing fields
        });

        totalTokens += child.tokens;
      }
    }

    return { units, totalTokens, citationMap };
  }
}
