/**
 * @file parent-child-chunker.service.ts
 * @description RAG PIPELINE: Hierarchical Token-Slicing Engine.
 *
 * Architecture: Small-to-large retrieval pattern.
 *   - Children  → embedded and searched (small, overlapping, semantically dense)
 *   - Parents   → returned to LLM as context (large, overlapping at boundary seams)
 *
 * Design invariants:
 *   1. All step sizes are validated ONCE before any loop runs.
 *   2. Parent IDs are derived from their absolute token offset, not a mutable
 *      sequence counter, so IDs remain stable across re-ingestion even if
 *      strategy parameters change.
 *   3. Child IDs are derived from their absolute document token position for
 *      the same stability guarantee.
 *   4. All chunks carry full token offset metadata for source highlighting.
 *   5. tenantId is embedded in every ID and every chunk for multi-tenant isolation.
 */

import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { type Tokenizer } from '../tokenization/interfaces/tokenizer.interface';
import { ChunkingStrategy } from './interfaces/chunking-strategy.interface';
import { ChunkingResult } from './types/chunking-result.type';
import { ParentChunk } from './types/parent-chunk.type';
import { ChildChunk } from './types/child-chunk.type';
import { ChunkRole } from '@/common/enums/chunk-role.enum';
import { DEFAULT_STRATEGY } from './constants/chunking-strategy.constant';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class ParentChildChunkerService {
  constructor(
    private readonly tokenizer: Tokenizer,
    @InjectPinoLogger(ParentChildChunkerService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Slices raw content into hierarchically coupled Parent and Child chunks.
   *
   * Parent window: slides by (parentChunkSize - parentOverlapSize), giving a
   * configurable seam overlap that eliminates cross-boundary blind spots.
   *
   * Child window: slides by (childChunkSize - overlapSize) within each parent,
   * producing the dense overlapping units that get embedded.
   */
  execute(
    tenantId: string,
    documentId: string,
    content: string,
    strategy: ChunkingStrategy = DEFAULT_STRATEGY,
  ): ChunkingResult {
    const parents: ParentChunk[] = [];
    const children: ChildChunk[] = [];

    // --- PHASE 1: ENCODE ---
    const tokens = this.tokenizer.encode(content);

    if (tokens.length === 0) {
      this.logger.debug({
        tenantId,
        documentId,
        msg: 'Empty token stream after encoding; chunking skipped.',
      });
      return { parents, children };
    }

    // --- PHASE 2: VALIDATE STRATEGY (O(1), runs once before any loop) ---
    const childStep = strategy.childChunkSize - strategy.overlapSize;
    const parentStep = strategy.parentChunkSize - strategy.parentOverlapSize;

    if (childStep <= 0) {
      this.logger.error({
        tenantId,
        documentId,
        childChunkSize: strategy.childChunkSize,
        overlapSize: strategy.overlapSize,
        msg: 'Invalid strategy: childChunkSize must be strictly greater than overlapSize.',
      });
      throw new RangeError('CHUNKING_STRATEGY_INVALID');
    }

    if (parentStep <= 0) {
      this.logger.error({
        tenantId,
        documentId,
        parentChunkSize: strategy.parentChunkSize,
        parentOverlapSize: strategy.parentOverlapSize,
        msg: 'Invalid strategy: parentChunkSize must be strictly greater than parentOverlapSize.',
      });
      throw new Error('CHUNKING_STRATEGY_INVALID');
    }

    this.logger.debug({
      tenantId,
      documentId,
      totalTokens: tokens.length,
      parentStep,
      childStep,
      msg: 'Strategy validated. Beginning hierarchical token segmentation.',
    });

    // --- PHASE 3: PARENT + CHILD GENERATION ---
    //
    // Parent IDs use `parentStartOffset` (not a mutable sequence counter) so that
    // IDs are stable: re-ingesting the same document with the same strategy always
    // produces the same IDs, enabling safe vector store upserts.
    //
    // Child IDs use their absolute document start token for the same reason.

    let parentSequence = 0;

    for (
      let parentStartOffset = 0;
      parentStartOffset < tokens.length;
      parentStartOffset += parentStep
    ) {
      const parentEndOffset = Math.min(
        parentStartOffset + strategy.parentChunkSize,
        tokens.length,
      );
      const parentTokens = tokens.slice(parentStartOffset, parentEndOffset);
      const parentContent = this.tokenizer.decode(parentTokens);

      // Stable ID: keyed on absolute token offset, not sequence number.
      const parentId = this.createDeterministicId(
        tenantId,
        documentId,
        ChunkRole.PARENT,
        parentStartOffset,
      );

      const parentChunk: ParentChunk = {
        id: parentId,
        tenantId,
        documentId,
        sequence: parentSequence,
        content: parentContent,
        tokenCount: parentTokens.length,
        metadata: {
          startTokenOffset: parentStartOffset,
          endTokenOffset: parentEndOffset,
        },
      };
      parents.push(parentChunk);

      // --- CHILD GENERATION (scoped within this parent's token slice) ---
      for (
        let localChildStart = 0;
        localChildStart < parentTokens.length;
        localChildStart += childStep
      ) {
        const localChildEnd = Math.min(
          localChildStart + strategy.childChunkSize,
          parentTokens.length,
        );
        const childTokens = parentTokens.slice(localChildStart, localChildEnd);

        // Guard: skip degenerate zero-length slices that can appear at boundaries.
        if (childTokens.length === 0) {
          break;
        }

        const absoluteChildStart = parentStartOffset + localChildStart;
        const absoluteChildEnd = parentStartOffset + localChildEnd;

        // Stable ID: keyed on absolute document token position.
        const childId = this.createDeterministicId(
          tenantId,
          documentId,
          ChunkRole.CHILD,
          absoluteChildStart,
        );

        const childChunk: ChildChunk = {
          id: childId,
          parentId,
          tenantId,
          documentId,
          sequence: children.length, // monotonic; read after push avoids a counter variable
          content: this.tokenizer.decode(childTokens),
          tokenCount: childTokens.length,
          metadata: {
            absoluteStartToken: absoluteChildStart,
            absoluteEndToken: absoluteChildEnd,
            localParentStartToken: localChildStart,
            localParentEndToken: localChildEnd,
          },
        };
        children.push(childChunk);

        // Terminate once the window has consumed the full parent slice.
        // Advancing localChildStart past this point would produce a duplicate
        // of the final boundary chunk on the next iteration.
        if (localChildEnd >= parentTokens.length) {
          break;
        }
      }

      parentSequence++;

      // Terminate once the window has consumed the full token stream.
      if (parentEndOffset >= tokens.length) {
        break;
      }
    }

    this.logger.info(
      {
        tenantId,
        documentId,
        parentsGenerated: parents.length,
        childrenGenerated: children.length,
      },
      'Hierarchical chunking pipeline completed successfully',
    );

    return { parents, children };
  }

  /**
   * Produces a collision-resistant, stable chunk ID.
   *
   * The `position` argument must be an absolute token offset (not a mutable
   * Stable across repeated ingestion of the same document when the chunking strategy remains unchanged.
   *  ingestion runs and remain safe for vector store upsert operations.
   *
   * Scoping by tenantId guarantees isolation within shared database indexes.
   */
  private createDeterministicId(
    tenantId: string,
    documentId: string,
    role: ChunkRole,
    position: number,
  ): string {
    return createHash('sha256')
      .update(`${tenantId}:${documentId}:${role}:${position}`)
      .digest('hex');
  }
}
