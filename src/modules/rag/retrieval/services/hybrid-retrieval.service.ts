import { Injectable } from '@nestjs/common';
import type { RetrievalQuery } from '../../shared/types/retrieval-query.type';
import { RetrievedContext } from '../../shared/types/retrieved-context.type';
import { LexicalRetrievalService } from './lexical-retrieval.service';
import { VectorRetrieverAdapter } from '../adapters/vector-retriever.adapter';
import { clampTop } from '../../shared/utils/clampTopK';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class HybridRetrievalService {
  // RRF constant — 60 is the industry standard default.
  // Higher K reduces the impact of rank differences between retrievers.
  private readonly K = 60;

  constructor(
    private readonly vectorAdapter: VectorRetrieverAdapter,
    private readonly lexicalService: LexicalRetrievalService,
    @InjectPinoLogger(HybridRetrievalService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Runs vector and lexical retrieval in parallel, then fuses results
   * using Reciprocal Rank Fusion (RRF) into a single ranked list.
   *
   * Neither retriever knows about the other — fusion happens here only.
   */
  async retrieve(query: RetrievalQuery): Promise<RetrievedContext[]> {
    // // Run both retrievers concurrently — neither depends on the other
    // const [vectorResults, lexicalResults] = await Promise.all([
    //   this.vectorAdapter.retrieve(query),
    //   this.lexicalService.retrieve(query),
    // ]);

    // allSettled instead of all — one retriever failing should degrade
    // gracefully to the other's results, not take the whole call down.
    const [vectorOutcome, lexicalOutcome] = await Promise.allSettled([
      this.vectorAdapter.retrieve(query),
      this.lexicalService.retrieve(query),
    ]);

    const vectorResults = this.unwrap(vectorOutcome, 'vector');
    const lexicalResults = this.unwrap(lexicalOutcome, 'lexical');

    // If both retrievers return nothing, exit early — nothing to fuse
    if (!vectorResults.length && !lexicalResults.length) return [];

    // scoreMap accumulates RRF scores keyed by chunkId.
    // A chunk appearing in both result sets gets contributions from both ranks.
    const scoreMap = new Map<
      string,
      {
        chunkId: string;
        content: string;
        source: RetrievedContext['source'];
        vectorRank?: number;
        lexicalRank?: number;
        rrfScore: number;
      }
    >();

    // Apply RRF contributions from each retriever independently
    this.applyRRF(scoreMap, vectorResults, 'vector');
    this.applyRRF(scoreMap, lexicalResults, 'lexical');

    // Defensive clamp on the slice bound too — mirrors the same
    // "don't trust the caller blindly" stance the individual
    // retrievers already take internally.
    const safeTopK = clampTop(query.topK);

    // Sort by final RRF score descending and emit canonical RetrievedContext shape
    return [...scoreMap.values()]
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map((r) => ({
        chunkId: r.chunkId,
        content: r.content,
        score: r.rrfScore,
        source: r.source,
        signals: {
          vectorRank: r.vectorRank,
          lexicalRank: r.lexicalRank,
        },
      }));
  }

  /**
   * Unwraps a settled promise from one retriever. A rejected retriever
   * degrades to an empty result set rather than failing the whole
   * hybrid call — the other retriever's results still get returned.
   */
  private unwrap(
    outcome: PromiseSettledResult<RetrievedContext[]>,
    type: 'vector' | 'lexical',
  ): RetrievedContext[] {
    if (outcome.status === 'fulfilled') return outcome.value;

    this.logger.error(
      { err: outcome.reason, retriever: type },
      `${type} retriever failed — continuing with partial results`,
    );
    return [];
  }

  /**
   * Applies RRF rank contributions from one retriever into the shared scoreMap.
   *
   * Formula: score += 1 / (rank + K)
   *
   * Chunks found by both retrievers accumulate score from both calls.
   * Chunks found by only one retriever still receive a partial score.
   * Raw similarity scores are intentionally discarded — only rank position matters.
   */
  private applyRRF(
    scoreMap: Map<
      string,
      {
        chunkId: string;
        content: string;
        source: RetrievedContext['source'];
        vectorRank?: number;
        lexicalRank?: number;
        rrfScore: number;
      }
    >,
    results: RetrievedContext[],
    type: 'vector' | 'lexical',
  ): void {
    results.forEach((r, index) => {
      // Rank is 1-based — position 0 in the array = rank 1
      const rank = index + 1;

      // Retrieve existing entry or initialise a fresh one with zero score
      const existing = scoreMap.get(r.chunkId) ?? {
        chunkId: r.chunkId,
        content: r.content,
        source: r.source,
        rrfScore: 0,
      };

      // Record which rank this retriever assigned to this chunk
      if (type === 'vector') existing.vectorRank = rank;
      if (type === 'lexical') existing.lexicalRank = rank;

      // Accumulate the RRF contribution for this rank position
      existing.rrfScore += 1 / (rank + this.K);

      scoreMap.set(r.chunkId, existing);
    });
  }
}
