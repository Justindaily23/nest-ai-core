import { Injectable } from '@nestjs/common';
import { RetrievalRepository } from '../repositories/retrieval.repository';
import { ChunkRepository } from '@/modules/rag/persistence/repositories/chunk.repository';
import {
  FlatRetrievalParams,
  ParentExpandedChunk,
  RetrievedChunk,
} from '../interfaces/retrieval-repository.interface';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { OperationalException } from '@/common/exceptions/operational.exception';

@Injectable()
export class VectorRetrievalService {
  constructor(
    private readonly retrievalRepository: RetrievalRepository,
    private readonly chunkRepository: ChunkRepository,
    @InjectPinoLogger(VectorRetrievalService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Orchestrates flat vector retrieval, filters matches by quality scores,
   * performs strict data integrity validation, and restores stable rank order.
   */
  async retrieveFlat(params: FlatRetrievalParams): Promise<RetrievedChunk[]> {
    const { tenantId, model, queryEmbedding, topK, minScore = 0.7 } = params;

    /**
     * Guard against pathological topK values to protect latency footprints
     *  Here, a reranker model could be used if i were searching through millions
     *  of highly specialized documents like medical and others...for now i pass with this!
     */
    const safeTopK = Math.min(topK, 20);

    // Log the incoming asynchronous request
    this.logger.debug(
      { tenantId, safeTopK },
      'Starting Semantic Vector Search.......',
    );

    // Start times
    const startTime = Date.now();

    // VECTOR SEARCH SIMILARITY SWEEP
    const results = await this.retrievalRepository.search({
      tenantId,
      model,
      queryEmbedding,
      topK: safeTopK,
    });

    // Log performance metrics for the async operation
    const duration = Date.now() - startTime;
    this.logger.info(
      { durationMs: duration, count: results.length },
      'Keyword search finished',
    );

    if (results.length === 0) {
      // Log a warning for empty results to catch potential indexing system errors
      this.logger.warn({ tenantId }, 'No chunks found for the given query');
      return [];
    }

    // SCORE FILTERING ---
    const filtered = results.filter((r) => r.score >= minScore);

    if (filtered.length === 0) {
      this.logger.warn(
        {
          tenantId,
          minScore,
          totalFoundBeforeFilter: results.length,
        },
        'No chunks passed the similarity score threshold',
      );
      return [];
    }

    /**
     *   BULK FETCH RELATIONAL TEXT BLOCKS
     *  It catches a dangerous scenario where your vector search index is out of sync with your main database tables
     */
    const chunkIds = filtered.map((r) => r.chunkId);
    const chunks = await this.chunkRepository.findByIds(tenantId, chunkIds);

    if (chunks.length === 0) {
      this.logger.warn({
        tenantId,
        chunkIds,
        msg: 'Vector results returned chunk IDs with zero matching chunk rows in database truth layer.',
      });
      return [];
    }

    // Allocate internal lookup map for high-speed O(1) correlation matching
    // Note: We index the entire database entity row, not just its content string.
    const chunkMap = new Map(chunks.map((chunk) => [chunk.id, chunk]));

    //  HARD INVARIANT SYSTEM INTEGRITY CHECK ---
    // Extract any vector references that point to orphaned text nodes.
    // This explicitly surfaces storage-layer drift or deletion synchronization bugs.
    const missing = filtered.filter((r) => !chunkMap.has(r.chunkId));

    if (missing.length > 0) {
      const missingChunkIds = missing.map((r) => r.chunkId);

      this.logger.error({
        tenantId,
        missingChunkIds,
        msg: 'Retrieved chunk IDs have no matching content text rows — data integrity violation detected.',
      });

      throw new OperationalException(
        'system',
        'CHUNK_CONTENT_MISSING',
        'Retrieved chunk vector references are missing corresponding data content rows.',
        undefined,
        { missingChunkIds },
      );
    }

    // PURE STABLE ORDER RESTORATION ---
    // Guaranteed non-null assertion (!) because the integrity check above eliminated all possibility of leakage.
    return filtered.map((r) => {
      const dbChunk = chunkMap.get(r.chunkId)!; // Extract the rich DB entity row

      return {
        chunkId: r.chunkId,
        score: r.score,
        content: dbChunk.content, // Read string content from the database row
        documentId: dbChunk.documentId, // Read document ID from the database row
        filename: dbChunk.filename ?? 'Unknown Document', // Read filename from the database row
      };
    });
  }

  async retrieveWithParentExpansion(
    params: FlatRetrievalParams,
  ): Promise<ParentExpandedChunk[]> {
    const flatResults = await this.retrieveFlat(params);
    if (flatResults.length === 0) return [];

    const childIds = flatResults.map((r) => r.chunkId);

    const rows = await this.chunkRepository.findParentsWithChildren(
      params.tenantId,
      childIds,
    );

    if (rows.length === 0) {
      this.logger.warn({
        tenantId: params.tenantId,
        childIds,
        msg: 'Parent expansion returned no rows — falling back to flat results.',
      });
      // Fallback: wrap each child as its own parent.
      // Note: parentChunkId here points to a CHILD role row, not a PARENT.
      // Downstream consumers must handle this gracefully.
      return flatResults.map((r) => ({
        parentChunkId: r.chunkId,
        parentContent: r.content,
        children: [{ chunkId: r.chunkId, content: r.content, score: r.score }],
        score: r.score,
      }));
    }

    const scoreMap = new Map(flatResults.map((r) => [r.chunkId, r.score]));
    const parentMap = new Map<string, ParentExpandedChunk>();

    for (const row of rows) {
      // Defensive guard: skip rows whose childId is not in the score map.
      // This handles concurrent deletion between the vector search and this fetch.
      const score = scoreMap.get(row.childId);
      if (score === undefined) continue;

      if (!parentMap.has(row.parentId)) {
        parentMap.set(row.parentId, {
          parentChunkId: row.parentId,
          parentContent: row.parentContent,
          children: [],
          score,
        });
      }

      const parent = parentMap.get(row.parentId)!;
      parent.children.push({
        chunkId: row.childId,
        content: row.childContent,
        score,
      });

      // Parent inherits the highest score across all its matched children.
      parent.score = Math.max(parent.score, score);
    }

    return [...parentMap.values()].sort((a, b) => b.score - a.score);
  }
}
